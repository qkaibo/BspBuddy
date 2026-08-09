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

## 五、总结

| Phase | 内容 | 文件 | 工作量 |
|-------|------|------|--------|
| A | 后端 A2A 端点 | `backend/app/a2a/` + `main.py` 注册 | 中（~200 LOC） |
| B | Sidecar A2A 客户端 | `python/bspbuddy_runtime/a2a/` + `core.py` | 中（~150 LOC） |
| C | 前端 expertId 传递 + ExpertCenter 召唤修复 + ChatPanel 专家名展示 | `ExpertCenter.tsx` + `useAgent.ts` + `App.tsx` + `ChatPanel.tsx` + `ipc-handlers.ts` + `sidecar-service.ts` | 中（~80 LOC diff） |
| D | 对话资源上下文（ConversationContextBar） | 新增 `ConversationContextBar.tsx` + 修改 `ChatPanel.tsx` + `App.tsx` + 接入现有 pickers | 中（~150 LOC） |
| E | 会话持久化补充 expertContext/expertResources | `useSession.ts` + `App.tsx` | 小（~30 LOC diff） |

**核心设计原则**：
- 本地 LLM 的对话内容不经过服务器，只有显式委托的任务描述发给专家
- 服务器端已有的 `agent_loop.py` 不做大改动，A2A 端点是薄包装层
- 委托是 LLM 自主决定的（通过 tool call），不是强制性的——简单问题仍然由本地 LLM 直接回答
