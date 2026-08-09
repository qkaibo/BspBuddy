---
id: agents-004
title: A2A 专家委托协议
type: prd
related: [agents-001, agents-002, agents-003, runtime-01]
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
- [ ] 委托完成后的结果（artifacts）能正确显示在对话中
- [ ] 本地 LLM 的对话内容不经过服务器中转（仅委托任务描述传给专家，本地上下文留在本地）
- [ ] ChatPanel 输入框上方显示当前对话的资源 tag 栏（专家/技能/SOP/知识库），可动态添加/移除
- [ ] 召唤专家后自动将该专家加入资源 tag 栏
