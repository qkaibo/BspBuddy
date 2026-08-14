# agents-03 — A2A 专家委托协议

> 对应文档: `docs/prd/agents-004-a2a-delegation.md`
> 协议标准: Google A2A (Agent-to-Agent) Protocol v1.0
> Status: 🟡 P0 开发中 | 分支: 待创建

## 功能概要

本地 Agent 运行时（Sidecar）直连本地 LLM。当用户召唤了某个服务器端专家后，本地 LLM 通过 A2A 协议委托任务给服务器端的 `agent_loop.py`，获取该专家的 persona、SOP 工作流、通用技能、知识库检索等能力。

**核心理由**：本地 LLM 调用不能走服务器中转，但专家特有的能力（SOP 工作流引擎、通用技能执行器、知识库多阶段检索）都在服务器端。A2A 是为此场景设计的标准协议——Agent 委托 Agent，而非 Agent 调用工具。

## 与现有组件的关系

```
本地 Sidecar (python/bspbuddy_runtime)
  │
  │ 新增: delegate_to_expert 工具（A2A 客户端）
  │       + Expert Agent Card 发现与注册
  │
  ▼
后端 A2A 端点（新增）
  │
  │ 复用: agent_loop.handle_turn(ChatTurnRequest(agent_id=...))
  │       existing: _get_persona_prompt、_list_published_skills、
  │                 _tools_with_general_skills、visible_knowledge_base_ids
  │
  ▼
ChatPanel (已有，前端展示)
  │
  │ 新增: 委托状态展示（"正在委托 PM 专家..."）
  │       + artifacts 下载/预览
  │       + 输入框上方专家名条（✨ 正在对话: 项目管理专家）
```

## 一、改动范围

```
新增:
  backend/app/a2a/__init__.py          ← A2A 模块入口
  backend/app/a2a/agent_card.py        ← Agent Card 构建逻辑
  backend/app/a2a/router.py            ← A2A REST 端点（Agent Card + tasks/send SSE）
  backend/app/a2a/schema.py            ← A2A 请求/响应 Pydantic schema
  python/bspbuddy_runtime/a2a/__init__.py
  python/bspbuddy_runtime/a2a/client.py ← A2A 客户端（发现 Agent Card + 发送任务 + 流式接收）
  docs/prd/agents-004-a2a-delegation.md  ← PRD（已创建）
  docs/plans/agents-03-a2a-delegation.md ← 本文件

修改:
  backend/app/main.py                  ← 注册 A2A router
  python/bspbuddy_runtime/server/core.py ← 初始化时拉取 Agent Cards，注册 delegate_to_expert 工具
  python/bspbuddy_runtime/server/turns.py ← 可选：prompt 中包含可用专家描述
  src/main/services/sidecar-service.ts ← SidecarInitializeParams 加 backendUrl/authToken；SidecarStartTurnParams 加 expertId
  src/main/services/ipc-handlers.ts    ← EXECUTE_TASK context 加 expertId+expertInfo；EXPERT_SUMMON 改 FastAPI 优先；_planViaBackend 注入专家 persona
  src/main/services/expert-service.ts  ← （不改，仅 reader）
  src/renderer/App.tsx                 ← handleSend 传 expertInfo；ChatPanel 加 expertName prop
  src/hooks/useAgent.ts                ← sendMessage 接受 expertId + expertInfo
  src/components/ExpertCenter.tsx      ← handleSummon 不再依赖 IPC，直接用已加载 expert 构造欢迎语（修复 ID 不匹配静默失败）
  src/components/ChatPanel.tsx         ← 输入框上方显示当前对话专家名称（✨ 正在对话: 项目管理专家）
  docs/README.md                       ← 更新索引
```

## 二、Phase A：后端 A2A 端点（核心）

### A1. Agent Card 端点

为每个在线专家生成标准 A2A Agent Card。

**文件**: `backend/app/a2a/agent_card.py`

```python
def build_agent_card(db: Session, agent_profile: AgentProfile) -> dict:
    """从 AgentProfile + AgentResourceBinding 构建 A2A Agent Card"""

    bindings = get_active_bindings(db, agent_profile.tenant_id, agent_profile.id)

    skills = []
    for b in bindings:
        if b.resource_type == "sop_skill":
            sop = get_sop(db, b.resource_id)
            if sop:
                skills.append({"id": sop.id, "name": sop.name, "description": sop.description, "type": "sop"})
        elif b.resource_type == "general_skill":
            gs = get_general_skill(db, b.resource_id)
            if gs:
                skills.append({"id": gs.slug, "name": gs.name, "description": gs.description, "type": "general_skill"})

    return {
        "name": agent_profile.name,
        "description": agent_profile.description or agent_profile.name,
        "url": f"{BASE_URL}/a2a/agents/{agent_profile.id}",
        "provider": {"organization": "BspBuddy", "url": BASE_URL},
        "capabilities": {"streaming": True, "pushNotifications": False},
        "skills": skills,
        "defaultInputModes": ["text", "file"],
        "defaultOutputModes": ["text", "file"],
        "version": "1.0.0",
    }
```

### A2. tasks/send 端点（SSE 流式）

接收 A2A `message/send` 请求 → 转换为 `ChatTurnRequest` → 调用已有 `agent_loop.handle_turn()` → SSE 流式返回。

**文件**: `backend/app/a2a/router.py`

```
POST /a2a/agents/{agent_id}/tasks

Request body:
{
  "message": {
    "role": "user",
    "parts": [
      { "text": "帮我分析这个需求文档，制定迭代计划" },
      { "file": { "name": "需求文档.md", "mimeType": "text/markdown", "bytes": "<base64>" } }
    ]
  },
  "metadata": { "session_id": "optional-existing-session-id" }
}

Response: SSE stream
event: status
data: {"state": "working", "message": "正在分析需求文档..."}

event: artifact
data: {"name": "迭代计划.md", "parts": [{"text": "# 迭代计划\n..."}]}

event: status
data: {"state": "completed"}

event: final
data: {"artifacts": [...], "stopReason": "completed"}
```

内部转换逻辑：

```python
@router.post("/a2a/agents/{agent_id}/tasks")
async def agent_task(agent_id: str, request: A2ATaskRequest):
    # 1. 校验 agent 存在且在线
    agent = get_agent(agent_id)
    if not agent or agent.status != "active":
        raise HTTPException(404)

    # 2. 解析消息 → ChatTurnRequest
    turn_request = ChatTurnRequest(
        tenant_id=agent.tenant_id,
        agent_id=agent_id,
        user_id=request.user_id,
        session_id=request.metadata.get("session_id"),
        user_message=extract_text(request.message),
        user_attachments=extract_files(request.message),
    )

    # 3. 调用 agent_loop 流式版本
    return StreamingResponse(
        agent_loop.handle_turn_streaming(turn_request),
        media_type="text/event-stream",
    )
```

### A3. handle_turn 流式适配

`agent_loop.handle_turn()` 当前是同步返回。新增 `handle_turn_streaming()` 包装。

**最小改动方案**：不修改现有 `handle_turn()`：

```python
async def handle_turn_streaming(self, request: ChatTurnRequest) -> AsyncGenerator[str, None]:
    """SSE streaming wrapper around handle_turn"""
    yield format_sse("status", {"state": "working"})

    result = await self.handle_turn(request)

    for artifact in result.artifacts:
        yield format_sse("artifact", {"name": artifact.name, "parts": artifact.parts})

    yield format_sse("status", {"state": "completed"})
    yield format_sse("final", {"artifacts": result.artifacts, "stopReason": "completed"})
```

---

## 三、Phase B：Python Sidecar A2A 客户端

### B1. 专家发现 & 工具注册

**文件**: `python/bspbuddy_runtime/a2a/client.py`

```python
class A2AClient:
    """Minimal A2A client for agent discovery and task delegation"""

    def __init__(self, backend_url: str):
        self.backend_url = backend_url

    async def discover_agents(self) -> list[dict]:
        """GET /a2a/agents → return list of Agent Cards"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.backend_url}/a2a/agents")
            resp.raise_for_status()
            return resp.json()

    async def send_task_streaming(self, agent_url: str, message: str):
        """POST {agent_url}/tasks → SSE stream"""
        body = {
            "message": {"role": "user", "parts": [{"text": message}]},
            "metadata": {},
        }

        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{agent_url}/tasks", json=body) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        yield json.loads(line[5:].strip())
```

### B2. Sidecar core.py 初始化

```python
# server/core.py

async def _on_initialize(self, params):
    # ... existing init (tool registry, workspace) ...

    # Fetch Agent Cards from backend
    self._agent_cards = await a2a_client.discover_agents(self._backend_url)

    # Register delegate_to_expert tool
    self._tool_registry.register(
        name="delegate_to_expert",
        description=(
            "将任务委托给专门的 AI 专家执行。"
            "当用户的任务需要专业领域知识时使用。"
            "不要为简单问题或普通对话使用此工具。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "expert_id": {
                    "type": "string",
                    "description": f"专家 ID。可用专家: {self._describe_agents()}",
                },
                "task": {
                    "type": "string",
                    "description": "要委托给专家的任务描述",
                },
            },
            "required": ["expert_id", "task"],
        },
        handler=self._handle_delegate_to_expert,
        is_external=False,
    )

async def _handle_delegate_to_expert(self, args):
    """Execute delegate_to_expert tool"""
    expert_id = args["expert_id"]
    task = args["task"]

    agent = self._agent_cards_by_id.get(expert_id)
    if not agent:
        return {"error": f"未找到专家: {expert_id}"}

    results = []
    async for event in self._a2a_client.send_task_streaming(agent["url"], task):
        results.append(event)

    final = next((e for e in results if e.get("type") == "final"), None)
    if final:
        return {"result": final.get("content"), "artifacts": final.get("artifacts", [])}
    return {"error": "专家未返回结果", "events": results}
```

### B3. 委托执行流程

```
1. Python Sidecar ReAct 循环中 tool_use → _handle_delegate_to_expert
2. httpx POST 到后端 A2A 端点（SSE 流式接收）
3. 结果包装为 tool result 返回给 LLM
4. 本地 LLM 用专家结果生成最终回复给用户
```

> Python Sidecar 直接用 `httpx` 发 HTTP 请求。委托内容是用户显式想要交给专家处理的任务描述，不包含本地对话上下文。

---

## 四、Phase C：前端专家上下文传递（已实现）

### C1. 原始问题

`handleSummonExpert` 存了 `expertContext` 但后续从未被消费。且 `handleSummon` 完全依赖 `EXPERT_SUMMON` IPC，后端专家 ID（`agent-xxx`）与本地专家 ID（`expert-builtin-*`）不匹配时静默失败——无错误提示。

### C2. 实现

**`src/components/ExpertCenter.tsx`** — `handleSummon` 不再依赖 IPC。直接用已加载的 expert 对象（name/title/methodology/toolChain）构造欢迎语，IPC 仅用于获取服务端 sessionId（best-effort，失败不阻塞召唤）：

```typescript
async function handleSummon(expert: Expert) {
  const welcomeMessage = `👋 你好！我是${expert.title || expert.name}。\n\n${expert.methodology ? `我的专长：${expert.methodology}\n` : ''}${expert.toolChain?.length > 0 ? `工具链：${expert.toolChain.join('、')}\n` : ''}\n请描述你的任务，我将以专家身份为你提供专业支持。`
  // IPC is best-effort for sessionId only
  onSummonExpert?.(expert, sessionId, welcomeMessage)
  onClose()
}
```

**`src/hooks/useAgent.ts`** — `sendMessage` 加 `expertId` 和 `expertInfo` 参数，完整传递到 IPC：

```typescript
const sendMessage = useCallback(async (
  content: string,
  modelId?: string,
  expertId?: string,
  expertInfo?: { name: string; title: string; methodology: string; toolChain: string[]; persona: string },
): Promise<{ artifacts?: Artifact[] }> => {
  const response = await ipc.invoke(IPC_CHANNELS.EXECUTE_TASK, content, mode, modelId, { expertId, expertInfo })
}, [mode, messages, isProcessing])
```

**`src/renderer/App.tsx`** — `handleSend` 传递 `expertInfo`（完整数据，避免 IPC handler 重新查后端）；ChatPanel 显示当前专家名：

```typescript
const expertInfo = expertContext?.expert
  ? { name: expertContext.expert.name, title: expertContext.expert.title, methodology: expertContext.expert.methodology, toolChain: expertContext.expert.toolChain, persona: expertContext.expert.persona }
  : undefined

// ChatPanel props:
expertName={expertContext?.expert?.title || expertContext?.expert?.name}
```

**`src/main/services/ipc-handlers.ts`** — `_planViaBackend` 优先用 `expertInfo`（直接从 UI 传入，不需重新查），兜底 `expertId` 回查 FastAPI；`EXPERT_SUMMON` handler 改为 FastAPI 优先，失败回退本地：

```typescript
// _planViaBackend signature:
async function _planViaBackend(userInput, mode, modelId, expertId?, expertInfo?)
// Expert hint injection:
if (expertInfo) {
  expertHint = `\n## 当前专家身份\n你正在以「${expertInfo.title}」的身份回答。...`
} else if (expertId) {
  // fallback: local + FastAPI lookup
}
```

**`src/components/ChatPanel.tsx`** — 输入框上方显示当前对话专家名：

```typescript
interface Props {
  // ... existing ...
  expertName?: string  // 新增
}

// UI: 在 UploadZone 和文字输入框之间
{expertName && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
    <Sparkles size={13} />
    正在对话: {expertName}
  </div>
)}
```

### C3. 设计原则

- **数据直传，不重新查询**：ExpertCenter 已有完整 Expert 对象，直接传 `expertInfo` 到 IPC handler，避免主进程重新调 FastAPI 导致的二次失败
- **召唤不阻塞**：`handleSummon` 不再等待 IPC 成功才显示欢迎语。IPC 调用是 best-effort，用于获取服务端 sessionId
- **fallback 边界清晰**：`expertInfo` 不存在时才用 `expertId` 回查

### C4. 调用链

```
ExpertCenter 点「召唤专家」
  │ handleSummon(expert) → 直接用 expert 构造欢迎语 + sessionId
  ▼
App.tsx handleSummonExpert → setExpertContext({ expert })
  │ setMessages([welcomeMsg]) → 切到 chat
  ▼
用户输入 → handleSend
  │ sendMessage(t, modelId, expertId, expertInfo)
  ▼
ipcMain.handle(EXECUTE_TASK, content, mode, modelId, { expertId, expertInfo })
  ├─ 本地模型 → _planViaSidecar(expertId)
  └─ 云端模型 → _planViaBackend(expertInfo)  ← 直接注入 persona 到 system prompt
```


---

## 四之附：Phase D — 对话资源上下文（ConversationContextBar）

### D1. 概述

输入框上方新增 `ConversationContextBar` 组件，以 tag 形式展示当前对话已激活的专家/技能/SOP/知识库。用户可通过 `+` 按钮弹出选择器动态添加/移除资源。追加 tag 资源的信息被注入到 `EXECUTE_TASK` 的 system prompt 中作为对话上下文。

### D2. 数据模型

```typescript
interface ActiveResource {
  id: string
  type: 'expert' | 'skill' | 'sop' | 'knowledge'
  name: string
}
```

App.tsx 维护 `activeResources: ActiveResource[]` 状态。`handleSummonExpert` 将专家追加到列表（而非替换）。`handleSend` 将列表传给 `sendMessage`。

### D3. 组件：ConversationContextBar

**Props**：
```typescript
interface Props {
  resources: ActiveResource[]
  onAdd: (resource: ActiveResource) => void
  onRemove: (id: string) => void
}
```

**UI 结构**：
```
┌──────────────────────────────────────────────┐
│ [👤 PM 专家 ×] [📊 数据分析师 ×]              │
│ [📋 需求分析SOP ×] [📚 编码规范KB ×]    [+ 添加] │
└──────────────────────────────────────────────┘
```

每个 tag 显示类型图标 + 名称 + × 按钮。`+ 添加` 按钮打开 Popover，包含 Tab：专家 / 技能 / SOP / 知识库，复用已有 picker 组件（SkillPicker、SopSkillPicker、KnowledgePicker）。

### D4. 数据流

```
App.tsx
  activeResources: ActiveResource[]
  ├─ handleSummonExpert → 新建独立 session，专家是对话主角
  │    └─ sessions += { id, title: 专家名, active: true }
  │    └─ currentSessionId = id
  │    └─ messages = [欢迎消息]
  │    └─ activeResources = [{ 该专家 }]
  │    └─ expertContext = { expert, sessionId }
  ├─ + 添加资源 → 只加 tag，不建新 session
  └─ handleSend → sendMessage(..., activeResources)

ChatPanel
  ├─ ConversationContextBar(resources, onAdd, onRemove)
  │   └─ onAdd → Popover picker → setActiveResources([...prev, resource])
  │   └─ onRemove → setActiveResources(prev.filter(r => r.id !== id))
  └─ 发送时 resources 注入到 system prompt 的"可用上下文资源"部分
```

### D5. 改动范围

```
新增:
  src/components/ConversationContextBar.tsx  ← Tag 栏 + +按钮 + Popover picker

修改:
  src/components/ChatPanel.tsx    ← 替换 expertName 单行条为 ConversationContextBar
  src/renderer/App.tsx           ← activeResources 状态管理；handleSummonExpert 追加专家
  src/hooks/useAgent.ts          ← sendMessage 接受 activeResources；注入到 EXECUTE_TASK context
  src/main/services/ipc-handlers.ts ← _planViaBackend 注入 resources 到 system prompt
  docs/prd/agents-004-a2a-delegation.md ← 新增"对话资源上下文"章节
  docs/plans/agents-03-a2a-delegation.md ← 本 Phase D
```


## 四之附：Phase E — 对话资源会话持久化

### E1. 问题

召唤专家后创建新 session，`expertContext` 和 `activeResources` 保存在 React state 中，但未被 `saveSession` 持久化到磁盘。关闭应用再打开后这两个状态丢失，标签栏变空。

### E2. 修复

| 文件 | 改动 |
|------|------|
| `src/hooks/useSession.ts` | `SessionData` 接口新增 `expertContext?` 和 `activeResources?` 字段；`saveSession` 函数签名新增两个可选参数并写入 session 对象 |
| `src/renderer/App.tsx` | `saveSession` 调用处传入 `expertContext` 和 `activeResources`；`handleSelectSession` 恢复时调用 `setExpertContext` 和 `setActiveResources` |

### E3. 数据流

```
App.tsx useEffect (messages变化)
  → saveSession(..., expertContext, activeResources)
    → IPC SESSION_SAVE → userData/sessions/<id>.json

App.tsx handleSelectSession(id)
  → loadSession(id) → IPC SESSION_LOAD
  → setExpertContext(session.expertContext)
  → setActiveResources(session.activeResources)
```


---

## 四之附：Phase F — A2A 专家对话延迟优化

### F1. 问题

召唤绑定了 MCP/技能的专家（如 QCM4490）后，对话体感严重卡顿：长时间 loading 后突然出全文。根因：

1. harness_v2 把 `answer_only` 强制抬成 conversation task → 多轮 LLM + MCP
2. 有 task 结果时仍强制再跑一次 Response LLM
3. Electron `_planViaA2A` / `useAgent` 等 SSE 整轮结束后才插入助手消息
4. 假流式每 8 字 `db.commit`；能力鉴权每次 `CapabilityManifestBuilder.build`

### F2. 改动

| 文件 | 改动 |
|------|------|
| `backend/app/core/harness_v2_engine.py` | 有 MCP/技能时：仅**闲聊**保留 `answer_only`；业务问题仍抬升 conversation（Planner 看不到 MCP，否则会空答） |
| `backend/app/core/response_generator.py` | Harness 已产出可用 reply 时跳过最终重写 LLM |
| `backend/app/core/harness_capability_invoker.py` | 单次 run 内缓存授权 manifest |
| `backend/app/core/agent_loop.py` | v2 假流式 delta 不逐 chunk commit；加大 chunk |
| `backend/app/a2a/router.py` | SSE event 名取 `event` 字段 |
| `src/lib/types.ts` | 新增 `A2A_CHAT_STREAM` |
| `src/main/services/ipc-handlers.ts` | `_planViaA2A` 边收边 `webContents.send` |
| `src/hooks/useAgent.ts` | 预插助手气泡，订阅流式 delta |
| `src/components/ChatMarkdown.tsx` + `ChatPanel.tsx` | 助手消息 Markdown：GFM 表格；**代码块浅灰底 + 左侧行号**（非黑底终端风）；`L110` 紧跟 fence 时行号对齐源文件 |
| `backend/app/llm/prompts/response_generator_prompt.md` + `response_generator.py` | 允许并要求技术回答用 Markdown，不再禁止代码围栏；重写时保留路径/行号/摘录结构 |
| `backend/app/llm/prompts/harness_agent_prompt.md` | `reply_fragment` 内可用 Markdown；BSP 问答：先默认现状再改法、强制路径摘录、截断再搜、次要路径降噪 |
| `backend/skills/mcp-reply-citation/SKILL.md` | MCP 文末引用 + 正文路径/行号摘录要求 |
| `backend/app/core/agent_loop.py` | v2 流式：后台跑 turn，轮询 `harness_invocations` 推送 MCP/能力调用进度 |
| `src/lib/types.ts` | `Message.trace`（viaA2A / expertName / steps） |
| `src/hooks/useAgent.ts` + `ChatPanel.tsx` | 展示专家徽章与调用轨迹 |

### F3. 验收

- [ ] 闲聊「介绍一下自己」：有 MCP 专家可走 answer_only 短路
- [ ] 业务问（如 FV 配置）：仍进 Harness，可调 MCP/技能
- [ ] UI 在 SSE delta 到达时更新气泡；代码块以等宽块展示，非 raw markdown 糊成一团
- [ ] 真查 MCP 的任务仍可走 Harness（Planner 主动 `start_new_task` 时）

### F4. Phase G — MCP 不可达 / 空工具时的延迟止血（实测）

**实测（2026-08-12）**：A2A 问 QCM4490「FV 配置」总耗时 **~101s**；`mcp_called=False`；QCM4490 MCP `http://10.2.137.73:8765/sse` **连接被拒绝**，H618 MCP 超时。几乎全部时间耗在 6～7 次串行 LLM，工具执行本身 <0.1s。

| 改动 | 目的 |
|------|------|
| `capability_manifest.py` | `discovered_tools` 为空时短超时尝试 `list_mcp_tools`；失败则记入 unavailable，避免假装有 MCP |
| `harness_v2_engine.py` | conversation 且清单无可用 MCP 工具时，`max_actions` 上限改为 3 |
| `harness_agent_prompt.md` | 明确：MCP 不可达且工作区空时尽快 `finish`，禁止空转 search/glob |

验收目标：MCP 宕机时同类问题墙钟从 ~100s 降到约 **30–45s**，并明确告知「MCP 不可达」而非空等。

### F5. Phase G2 — MCP 挂了必须显式提示（硬早退 + UI）

**问题**：即使用户能等完，气泡上只有「未调用 MCP」，不够醒目；且仍可能空转多轮 LLM。

| 改动 | 目的 |
|------|------|
| `harness_v2_engine.py` | 专家**已绑定 MCP** 且探测全部不可达（含 stale `discovered_tools`）时：**跳过 Harness LLM**，直接回复「MCP 不可达」+ 服务器名/原因；写 `mcp_unavailable` 事件 |
| `agent_loop.py` | `capability_trace` 携带 `mcp_unavailable` / 原因；合成轨迹步 `MCP 不可达` |
| `types.ts` / `ipc-handlers.ts` / `useAgent.ts` / `ChatPanel.tsx` | 徽章优先显示红色 **「MCP 不可达」**（覆盖「未调用 MCP」） |

验收：MCP 宕机（含网关可达但工具后端挂掉）时墙钟目标 **≤20s**；正文与徽章均出现「MCP 不可达」。

**修正（Phase I 联调）**：单次工具查询超时（如 gRPC `Timeout expired` / `InactiveRpcError CANCELLED`）**不算** MCP 不可达，应把错误回灌模型重试；仅连接拒绝 / unreachable / `MCP_UNAVAILABLE` 等连通性失败才硬早退。

**修正（PDO 空答）**：`HarnessCapabilityInvoker` MCP 成功时写 `{"success":true,"result":...}`，但 `_bounded_capability_result` 只把 `data` 回灌模型 → 模型看见 `data:null` 误判「搜空」。回灌须兼容 `data` / `result`。

### F6. Phase H — 真流式（中途 SSE，非假回放）

**问题**：`_handle_turn_stream_v2` 在 `handle_turn` 整轮结束后才吐 `stream_delta`/`capability_trace`；A2A 路由在 async 里同步迭代，event loop 被堵。用户感知仍是「卡住很久突然全文」。此前用第二 SQLite 连接轮询会 wedge（CloseWait），不可回退。

| 改动 | 目的 |
|------|------|
| `observability/event_log.py` | 可选 `live_sink`：`record` 时同步推内存事件（不依赖第二 DB 读） |
| `agent_loop.py` `_handle_turn_stream_v2` | **独立 Session 线程**跑 `handle_turn`；主生成器只从内存队列 yield `status` / `capability_progress`；结束后再补 trace + reply delta + complete |
| `a2a/router.py` | 生产者线程 + `asyncio` 队列拉取，**不阻塞** event loop；可发 heartbeat |

验收：
- [ ] 提问后 **≤2s** 能收到非 `working` 的进度（如「正在规划」/工具调用）
- [ ] MCP 调用开始/失败在全文出现前即可在轨迹区看到
- [ ] 健康检查/其他 API 在长 turn 期间仍可响应（event loop 未堵死）
- [ ] 不出现此前 SQLite wedge / 大量 CloseWait
- [ ] 轨迹不去重刷屏：同文案 status /「MCP 不可达 · tool」只出现一次（live + summary 合并）
- [ ] 专家回合结束后桌面气泡展示完整 reply，禁止用空 content 覆盖成 `Done.`（保留已流式内容）

### F7. Phase H2 — 桌面「Done.」吞答 + 轨迹双计

**问题（实测）**：Harness 已写出完整 FV 指南并入库，桌面却显示 `Done.`；轨迹里同一 `search_aosp` 先「调用工具」再「调用MCP」，且多轮重复搜索。

| 改动 | 目的 |
|------|------|
| `useAgent.ts` | 终态合并：`response.content` 为空时保留气泡已有流式正文，绝不回落成 `Done.` |
| `ipc-handlers.ts` `_planViaA2A` | 从 `complete.reply` / 嵌套 data 兜底取全文；finish 前若仍空则打日志 |
| `agent_loop` live map | `search_aosp` 等按 MCP 标注；汇总步与 live 同 id |
| `harness_agent_prompt.md` | MCP 检索命中后尽快 finish，避免无意义连搜 |

### F8. Phase H3 — SSE 丢正文时回拉会话消息

**问题（实测）**：Harness 已 `assistant_message_created` 并入库完整 FV 指南，轨迹显示「已调用 MCP / 正在生成回复」，桌面气泡仍为「未收到专家正文」。根因是 Electron 侧 `fullText` 为空（长回合末帧未进 `fullText`），不是专家没答。

| 改动 | 目的 |
|------|------|
| `_planViaA2A` | 跟踪 SSE `sessionId`；`finish` 时若正文为空 → `GET /api/chat/sessions/{id}/messages` 取最新 assistant |
| `useAgent.ts` | 终态合并后再清 `streamMessageIdRef`；按 `messageId` 仍可接受迟到的 replace |
| 日志 | `finish() with empty reply` 时打印已见 event kinds / sessionId |

验收：人为丢掉 replace 时，桌面仍能显示与 DB 一致的专家正文。

### F9. Phase I — Harness 原生 tools=（AgentCore 线协议）

**问题（实测对照）**：决策步用 `generate_json` + 强制单 tool + DeepSeek 默认高 thinking，单轮墙钟常 7～40s（同题对照 ~22s）；原生 `tools=` 同场景 ~3～5s，且可并行多个检索。

| 文件 | 改动 |
|------|------|
| `backend/app/llm/client.py` | 新增 `complete_with_tools`（非流式 `tools=` / 解析 `tool_calls`） |
| `backend/app/core/harness_agent.py` | 决策环改 messages + 原生 tools；同轮并行 invoke；合成 `harness_finish`；非 OpenAI 协议 fallback `generate_json`；**tool 名 sanitize**（`general_skill.*` → `^[a-zA-Z0-9_-]+$`） |
| `backend/app/llm/prompts/harness_agent_prompt.md` | 去掉「只输出 JSON / 每轮一个 tool」；改为 function calling + 可并行检索 |

**不做（本期）**：专家迁 Sidecar；决策 LLM 真流式；改 TurnPlanner / ResponseGenerator / A2A / Electron。

验收：
- [x] FV 类决策步墙钟量级秒级（非 20s+），span 无 JSON repair
- [x] 可并行 ≥2 个 `search_aosp`（或等价 MCP tool），仍经 `HarnessCapabilityInvoker`
- [x] 非 OpenAI Chat Completions 协议不炸（走旧 JSON 路径）
- [ ] G2 MCP 不可达早退仍有效

---

## 五、总结

| Phase | 内容 | 文件 | 工作量 |
|-------|------|------|--------|
| A | 后端 A2A 端点 | `backend/app/a2a/` + `main.py` 注册 | 中（~200 LOC） |
| B | Sidecar A2A 客户端 | `python/bspbuddy_runtime/a2a/` + `core.py` | 中（~150 LOC） |
| C | 前端 expertId 传递 + ExpertCenter 召唤修复 + ChatPanel 专家名展示 | `ExpertCenter.tsx` + `useAgent.ts` + `App.tsx` + `ChatPanel.tsx` + `ipc-handlers.ts` + `sidecar-service.ts` | 中（~80 LOC diff） |
| D | 对话资源上下文（ConversationContextBar） | 新增 `ConversationContextBar.tsx` + 修改 `ChatPanel.tsx` + `App.tsx` + 接入现有 pickers | 中（~150 LOC） |
| E | 会话持久化补充 expertContext/expertResources | `useSession.ts` + `App.tsx` | 小（~30 LOC diff） |
| F | A2A 专家对话延迟优化（流式 UI + answer_only 短路） | harness_v2 / response_generator / invoker / agent_loop / a2a router / ipc-handlers / useAgent | 中 |
| G | MCP 不可达早退 + 空工具发现 | capability_manifest / harness_v2 / harness_agent_prompt | 小 |
| G2 | MCP 挂了硬早退 + UI「MCP 不可达」徽章 | harness_v2 / agent_loop / ChatPanel / useAgent / ipc-handlers | 小 |
| H | 真流式：内存队列 live_sink + A2A 异步让出 | event_log / agent_loop / a2a router | 中 |
| H2/H3 | 桌面吞答修复 + 空正文回拉 messages | ipc-handlers / useAgent | 小 |
| I | Harness 原生 tools=（AgentCore 线协议） | `llm/client.py` / `harness_agent.py` / `harness_agent_prompt.md` | 中 |
| I+ | 轨迹步终态附加耗时（`· 完成 · Nms`） | `agent_loop.py` / `harness_agent.py` / types | 小 |

**核心设计原则**：
- 本地 LLM 的对话内容不经过服务器，只有显式委托的任务描述发给专家
- 服务器端已有的 `agent_loop.py` 不做大改动，A2A 端点是薄包装层
- 委托是 LLM 自主决定的（通过 tool call），不是强制性的——简单问题仍然由本地 LLM 直接回答
