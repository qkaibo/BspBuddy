---
id: agents-004
title: A2A 专家委托协议
type: prd
related: [agents-001, agents-002, agents-003, agents-005, runtime-01]
---

## 概述

本地 Agent 运行时（Python Sidecar）直连本地 LLM，对话内容严禁经过服务器中转。但当用户召唤了某个专家后，本地 Agent 需要能够**委托任务**给服务器端的专家执行引擎（`agent_loop.py`），获取专家特有的 persona、SOP 工作流、通用技能、知识库检索等能力。

采用 **Google A2A (Agent-to-Agent) Protocol v1.0** 作为委托协议，以标准化的方式实现「本地 Agent 委托服务器端专家 Agent」的通信。

类型标记如下：

**"本地 Agent"** = 运行在 Electron 侧的 Python Sidecar，直连本地 LLM，不可中转对话内容。
**"远端专家"** = 运行在 BspBuddy 后端 `agent_loop.py` 的 Agent，拥有 persona、SOP/技能/知识库绑定。

---

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 桌面用户 | 在本地对话中召唤 PM 专家，让专家分析需求文档并生成迭代计划 | 本地 LLM 速度快但不具备专业方法论；委托给有 SOP 的 PM 专家获得结构化输出 |
| 桌面用户 | 委托技术专家审查一段代码，专家调用了 Code Review SOP + 知识库中的编码规范 | 专家的 SOP 驱动多步骤工作流不是一次 LLM 调用能替代的 |
| 桌面用户 | 委托客服专家，专家反问用户收集信息 → 查询知识库 → 生成回复 | 专家有状态地执行多轮任务，中间可能反问澄清 |

---

## 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 专家能力发现 | 本地 Sidecar 从后端拉取所有在线专家的 Agent Card，注册为本地可委托工具 |
| 2 | 任务委托 | 本地 LLM 决定需要专家能力时，通过 A2A `tasks/send` 发起委托 |
| 3 | 流式响应 | 委托后流式接收专家的执行过程（SSE 事件 → 本地界面实时展示） |
| 4 | 结果回传 | 专家完成后的 artifacts（文件、结构化数据）回传给本地 Agent，由本地 LLM 对用户做最终回复 |

---

## 数据模型

### Agent Card

每个专家暴露为一个 A2A Agent Card，描述其能力和入口：

```
AgentCard {
  name: "PM Expert",
  description: "资深产品经理，擅长需求分析、PRD撰写、迭代规划",
  url: "https://bspbuddy.local/a2a/agents/pm-expert",
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  skills: [
    { id: "requirements-analysis", name: "需求分析", description: "分析需求文档，输出功能清单" },
    { id: "prd-generation", name: "PRD 生成", description: "根据需求生成结构化 PRD" },
  ],
  defaultInputModes: ["text", "file"],
  defaultOutputModes: ["text", "file"],
}
```

### 委托请求 → ChatTurnRequest 映射

A2A `tasks/send` 的消息体映射到后端已有的 `ChatTurnRequest`：

| A2A 字段 | ChatTurnRequest 字段 | 说明 |
|----------|---------------------|------|
| `message.parts[].text` | `user_message` | 用户输入文本 |
| `message.parts[].file` | `user_attachments` | 附件文件 |
| `taskId` | `session_id`（新建或复用） | 会话 ID |
| URL path 中的 `agent_id` | `agent_id` | 专家 ID |

---

## 页面与字段

本 PRD 不引入新 UI 页面。交互发生在两个已有层面：

### 1. 本地聊天界面（已有）

```
┌─────────────────────────────────────────┐
│  ChatPanel                              │
│                                         │
│  [用户]: 帮我分析这个需求文档             │
│                                         │
│  [BspBuddy]:                            │
│  🔄 正在委托 PM 专家分析...             │
│                                         │
│  [PM 专家]:                             │
│  📋 需求分析结果：                       │
│  1. 功能模块 A ...                      │
│  2. 功能模块 B ...                      │
│  [附件: PRD草稿.md]                     │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ 输入框                            │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**交互链**：
- 用户发消息 → 本地 LLM 判断是否需要委托 → 是 → 本地 Sidecar 调用 `delegate_to_expert(expertId, task)` 工具
- 本地 Sidecar → HTTP POST `{backend}/a2a/agents/{expertId}/tasks`（流式）
- 后端 A2A 端点 → `agent_loop.handle_turn(ChatTurnRequest(agent_id=expertId, ...))` → SSE 流式返回
- 本地 Sidecar 逐事件转发给 Electron 主进程 → ChatPanel 实时渲染

**专家对话直连路径（Electron UI 召唤专家后）**：
- ChatPanel → `EXECUTE_TASK`（含 `expertId` + `streamMessageId`）→ `_planViaA2A`
- `_planViaA2A` 消费 SSE；`stream_delta` / `status` 经 `A2A_CHAT_STREAM` 推送 renderer，边收边渲染
- Planner 判定 `answer_only` 时：若专家有 MCP/技能，**仅闲聊**可短路；业务问题仍进 conversation Harness（Planner 上下文不含 MCP 清单）
- Harness 已产出可用 `reply_fragment` 时，可跳过最终 Response 重写 LLM
- ChatPanel 助手气泡以 Markdown 渲染（标题、列表、**表格**、代码块）
- 专家直连时助手气泡显示「A2A · 专家名」标记；过程区展示规划/能力调用/MCP 调用轨迹（含是否命中 MCP）
- 专家已绑定 MCP 但本轮全部不可达时：气泡徽章显示 **「MCP 不可达」**（红色），正文明确说明不可达的服务器与原因；不空转多轮搜空工作区
- 技术答复排版：字段对照优先用「列表 + 行内 code」，避免把整表挤成一行；若用 GFM 表格必须多行（表头 / 分隔行 / 数据行分行），渲染器支持 `remark-gfm` 表格样式
- **代码块样式（聊天气泡）**：浅灰底 + 左侧行号 gutter + 右侧代码（非深色终端风）；正文出现 `L110` / `L110-L119`（可带路径）时，gutter **从该源文件行号起算**，不是从 1 起；路径可收成块上方标题栏。渲染前会把「正文与 \`\`\` 同一行」、列表内缩进 fence、未闭合 fence 规范成合法 Markdown，避免原始 \`\`\` 泄漏到气泡。
- 代码库/BSP 技术问答（经 MCP 检索）结构约定：
  1. **先给默认现状**（证据里是否已有目标档位/默认值），再给「若无则怎么加 / 若有仍不生效查什么」
  2. 正文必须带 **路径 + 行号（或片段行范围）+ 短代码/配置摘录**；禁止只有教科书式编码说明而无命中文件
  3. 检索片段截断时：换关键词再搜（如具体字段名、注释关键字），或明确写「片段截断、以下据注释/相邻命中」；禁止臆造未出现的完整赋值
  4. 主路径写清楚后，次要路径（如 ADSP 为主时的 Kernel TCPM/`snk-pdos`）最多一句附注，避免双路径并列抢注意力
  5. 实际调用过 MCP 时，文末保留「本次调用 MCP：服务器 / 工具」引用块（见 `mcp-reply-citation` 技能）

### 1b. 专家执行轨迹（可见性）

```
┌─────────────────────────────────────────┐
│  [助手气泡]                              │
│  A2A · QCM4490 充电专家  MCP 不可达      │
│  · 正在规划本轮任务                      │
│  · MCP 不可达 · QCM4490代码数据库        │
│  · 调用 capability_search                │
│  · 调用 MCP · search_code · 完成 · 623ms │
│  ─────────────────────────────────      │
│  （Markdown 正文）                       │
└─────────────────────────────────────────┘
```

交互：`A2A_CHAT_STREAM` 推送 `status` / `trace` / `delta`；`complete` 携带本轮 `capability_trace` 汇总（含 `mcp_unavailable`）。

**轨迹耗时（调试）**：工具 / MCP / 能力步在终态文案后附加耗时，格式 `· 完成 · 623ms`（失败 / 结果未知同理）；`duration_ms` 优先取 invocation `finished_at - started_at`，live 推送取本步实测。状态类文案（「正在规划」「准备调用」）可不带耗时。

**真流式（Phase H）**：
- 规划 / 工具调用 / MCP 失败等进度在 **turn 进行中** 即推送，不得等 `handle_turn` 整轮结束再假回放
- 实现约束：用内存 `live_sink` 队列，禁止第二 SQLite 连接轮询（会 wedge）
- A2A SSE 不得阻塞 FastAPI event loop（长 turn 时其它 API 仍应可响应）
- Electron `_planViaA2A` 必须用 UTF-8 `StringDecoder` + 按 `\n\n` 拆 SSE 帧；禁止对每个 TCP chunk 直接 `toString('utf-8')`（中文 reply 会被拆坏 → JSON 解析失败 → 气泡变成「未收到专家正文」）
- **空正文兜底（Phase H3）**：若 SSE 结束时仍无 `stream_replace` / `complete.reply`，主进程必须用本轮 `sessionId` 回拉 `GET /api/chat/sessions/{id}/messages` 取最新 assistant 正文再填气泡；禁止在后端已入库的情况下展示「未收到专家正文」

**决策环（Phase I）**：专家执行引擎（Harness TaskAgent）默认使用 **OpenAI 原生 function calling（`tools=` / `tool_calls`）**，可同轮并行多个工具；结束经合成工具 `harness_finish`。禁止以自研 JSON action（`generate_json` 吐 `{"action":"tool"|...}`）作为 OpenAI Chat Completions 协议下的默认路径。

### 2. 专家绑定编辑（已有）

无需改动。已有 `ExpertBindings` 中的 `sopSkills`、`skills`、`mcpServers`、`knowledgeBases`、`connectors`、`modelId` 由 A2A 委托路径中的 `agent_loop.py` 自动消费。

### 3. 对话资源上下文（ConversationContextBar）

对话有两个入口来引入专家/资源，职责不同：

| 入口 | 行为 | Session |
|------|------|---------|
| 专家列表「召唤」 | 专家是对话主角，自动注入 persona | **新建独立 session** |
| 对话内 `+ 添加资源` | 只给当前对话添加上下文 tag | 同一 session |

#### 页面布局

```
┌─────────────────────────────────────────┐
│  ChatPanel                              │
│                                         │
│  [消息列表...]                           │
│                                         │
│  [+ 添加资源] [PM 专家 ×] [需求SOP ×]     │  ← 对话框和输入框之间
│  ┌──────────────────────────────────┐   │
│  │ 📁 拖拽文件到此处上传             │   │
│  ├──────────────────────────────────┤   │
│  │ [模式▼] 输入框...          [发送]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  选择工作区 | 模型▼ | 权限▼ | ...       │
└─────────────────────────────────────────┘
```

#### 召唤专家 → 新建 Session 流程

```
ExpertCenter 点"召唤"
  → handleSummonExpert(expert, sessionId, welcomeMessage)
    ├─ sessions += { id, title: 专家名, active: true }     ← 侧边栏新条目
    ├─ currentSessionId = id                                ← 切换当前 session
    ├─ messages = [欢迎消息]                                 ← 清空旧对话，写入欢迎语
    ├─ activeResources = [{ 该专家 }]                        ← tag 栏显示
    └─ expertContext = { expert, sessionId }                ← 记录当前专家
```

#### + 添加资源 → 同一 Session 流程

```
ChatPanel 内点"+"添加专家
  → onAdd({ id, type: 'expert', name })
    ├─ activeResources += [该资源]     ← tag 栏追加
    └─ 不建新 session，不发欢迎语
```

#### 添加资源弹出面板

点击 `+ 添加资源` 弹出 Popover，包含 Tab 切换：

| Tab | 数据源 | 对应 Picker |
|-----|--------|-------------|
| 专家 | `EXPERT_LIST` | 列表选择（搜索+勾选） |
| 技能 | `SKILL_LIST` | SkillPicker（已有） |
| SOP | `SOP_LIST` | SopSkillPicker（已有） |
| 知识库 | `KNOWLEDGE_LIST` | KnowledgePicker（已有） |

#### Tag 交互

- 每个 tag 显示图标 + 名称 + `×` 关闭按钮
- 点击 `×` 从当前对话移除该资源
- 相同资源不重复添加
- `+ 添加资源` 固定在最左侧，tags 向右排列

#### 数据模型

```typescript
interface ActiveResource {
  id: string
  type: 'expert' | 'skill' | 'sop' | 'knowledge'
  name: string
}
```

App.tsx 维护 `activeResources: ActiveResource[]` 状态。发送消息时作为 context 传入 EXECUTE_TASK，注入到 system prompt 的「可用资源」部分。

---

## API 依赖

> **外部 IDE / 客户端鉴权：** 调用下列端点须带用户 Bearer Token。凭证的签发、列表与吊销见独立 PRD [`agents-005`](./agents-005-a2a-access-token.md)（设置 → A2A 接入）；不在本 PRD 的聊天委托路径内实现申请 UI。

### 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/agents` | GET | 返回所有在线专家的 Agent Card 列表 |
| `/a2a/agents/{agent_id}` | GET | 返回单个专家的 Agent Card |
| `/a2a/agents/{agent_id}/tasks` | POST | 创建任务（委托），返回 SSE 流 |

### 复用现有逻辑

| 内部组件 | 说明 |
|----------|------|
| `agent_loop.handle_turn(ChatTurnRequest)` | 核心执行引擎，已支持 agent_id、persona、资源过滤 |
| `expertService.getExpert(id)` | 获取专家基本信息（本地兜底） |
| `fastApiFetch('/api/chat/agents')` | 从后端获取专家列表（已有） |

---

## 页面关系

```
ExpertCenter (已有)
  │
  │ 召唤专家 → 新建独立 session
  ▼
ChatPanel (新 session，专家是对话主角)
  │
  │ 用户发消息，本地 LLM 判断需委托
  ▼
Sidecar delegate_to_expert 工具
  │
  │ HTTP POST /a2a/agents/{id}/tasks (SSE)
  ▼
后端 A2A 端点 → agent_loop.py
  │
  │ SSE 流式事件
  ▼
ChatPanel 实时渲染

─────────────────────

ChatPanel 内 + 添加资源
  │
  │ 不建新 session，只加 tag
  ▼
同一 ChatPanel，tag 显示在输入框上方
  │
  │ activeResources 注入 system prompt
  ▼
LLM 回复时参考这些上下文资源
```

---

## A2A vs MCP vs 直接 REST — 选型理由

| 维度 | A2A | MCP 反向 | 直接 REST |
|------|-----|---------|----------|
| Agent 间委托 | ✅ 原生支持 | ❌ 工具调用模型，无 agent 语义 | ❌ 需自行设计 |
| 能力发现 | ✅ Agent Card（标准化） | 需手动配置 | 需手动配置 |
| 流式 + 异步 | ✅ 内置 SSE + Task 生命周期 | 可用但非设计目标 | 需自行实现 |
| 多轮澄清 | ✅ `input-required` 状态 | ❌ | ❌ |
| 业界标准 | ✅ Linux Foundation，v1.0 稳定 | 成熟（2025-11-25） | — |

> 结论：A2A 的设计目的与本场景完全吻合——「独立 Agent 之间的任务委托」。MCP 解决的是 Agent ↔ Tool 的问题，不适合此场景。直接 REST 可以快速实现但没有标准化能力发现和 Task 生命周期管理。

---

## 验收标准

- [ ] 后端暴露 `/a2a/agents/{agent_id}` Agent Card 端点，包含专家的名称、描述、技能列表
- [ ] 后端暴露 `/a2a/agents/{agent_id}/tasks` 端点，接收 `task/send` 请求，返回 SSE 流
- [ ] 本地 Sidecar 中注册 `delegate_to_expert` 工具，参数含 `expertId` 和 `taskDescription`
- [ ] 本地 Sidecar 能拉取并注册所有在线专家的 Agent Card
- [ ] 用户召唤专家后发消息，本地 LLM 能判断是否需要委托并调用 `delegate_to_expert`
- [ ] 委托过程中聊天界面实时展示专家的执行过程
- [ ] 专家直连对话：SSE `stream_delta` 到达即更新气泡，不等 `EXECUTE_TASK` 整轮返回
- [ ] 有 MCP 绑定的专家，闲聊/`answer_only` 不强制进入多轮 Harness
- [ ] 委托完成后的结果（artifacts）能正确显示在对话中
- [ ] 本地 LLM 的对话内容不经过服务器中转（仅委托任务描述传给专家，本地上下文留在本地）
- [ ] ChatPanel 输入框上方显示当前对话的资源 tag 栏（专家/技能/SOP/知识库），可动态添加/移除
- [ ] 召唤专家后自动将该专家加入资源 tag 栏
