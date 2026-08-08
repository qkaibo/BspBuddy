# Component: App Layout

> 状态: **outdated**（实现未对齐截图）| 文档更新: 2026-08-04
> ⚠️ **欢迎态整屏权威参考已改为截图文档**（优先级高于下方旧 ASCII）：
> **[`workbuddy-reference-layout.spec.md`](./workbuddy-reference-layout.spec.md)**（WorkBuddy v5.3.8，2026-08-04）

## WorkBuddy 参考布局

### 截图确认要点（权威）

欢迎态为**左侧栏 + 中间欢迎/Composer**，无 BspBuddy 式全局顶栏、无底部状态栏；侧栏含品牌+版本、上方 PrimaryNav、任务/空间双折叠、Footer 头像区。完整 ASCII 与结构树见权威文档。

与下方「旧 ASCII」的差异要点：
- 旧图把对话标题栏 4 按钮 + 右侧结果面板画成默认骨架 → **本截图为欢迎空态**，未见对话顶栏与结果面板（对话态另待截图）
- 旧图侧栏强调「任务列表 + 底头像」、未画上方合并导航 → 截图为 **PrimaryNav 在上** + 任务/空间双 Section
- 「无全局顶栏 / 无底栏」在欢迎态截图中成立；BspBuddy 仍有 44px 顶栏 + 26px 底栏 → **未对齐**

### 旧文档推测 ASCII（已过时 — 来源：specs/workbuddy.md L64, specs/Quickstart.md L40-53）

```
┌───────────────────────────────────────────────────────────┐
│ ┌──────────┬──────────────────────────┬────────────────┐  │
│ │          │ [对话区标题栏]            │                │  │
│ │          │ 🔍 📤 🕐 📋              │                │  │
│ │ 左侧     │                          │ 右侧结果面板    │  │
│ │ 任务列表 │ 消息列表                  │ 概览/浏览器    │  │
│ │ (240px)  │ + 输入框                  │ 变更/产物      │  │
│ │          │ + 模式/模型/工作空间      │ (40%)          │  │
│ │          │                          │                │  │
│ │ 用户头像  │                          │                │  │
│ └──────────┴──────────────────────────┴────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**旧关键特征（文字推断，部分仍可能适用于对话态，但不得覆盖截图欢迎态）：**
- **无全局顶栏** — 标题和 4 个操作按钮（搜索/分享/历史/显示详情面板）在**对话区内部**的标题栏（来源：`Conversation.md` L18-26）
- **无底部状态栏** — 38 篇 WorkBuddy SPEC 均未提及
- 右侧 4 Tab：**概览**/浏览器/变更/产物，"概览"包含任务摘要+执行统计+产物概览（来源：`Results.md` L9-20, `plan/04-results.md` L31）

## 当前 BspBuddy 实现 vs 截图 / 旧参考差异

| 差异 | 截图或旧参考 | BspBuddy 当前 | 严重性 |
|------|-------------|---------------|--------|
| 欢迎态整屏结构 | 见 `workbuddy-reference-layout.spec.md` | 仍有全局顶栏+底栏；侧栏/欢迎区未按截图 | 🔴 架构级 |
| 全局顶栏 | 欢迎态截图无 | 有 44px 全局顶栏（所有视图可见） | 🔴 架构级 |
| 底部状态栏 | 截图无 | 有 26px 底部状态栏 | 🔴 架构级 |
| 结果面板 Tab | 旧文：概览/浏览器/变更/产物（对话态待截图） | 产物/文件/变更/浏览器 | 🟡 语义级 / 待截图 |
| 对话内顶栏按钮 | 旧文 4 个（含"显示详情面板"） | 3 个（缺面板切换） | 🟡 功能缺失 / 待截图 |

## 概述
BspBuddy 应用的根组件，负责整体布局、状态管理、视图路由和 IPC 通信。管理全局状态包括会话列表、活跃视图、工作空间、产物等。

## 所属视图
根组件 — `src/renderer/App.tsx`，整个渲染进程入口

## Props 接口

无外部 Props。App 是根组件，直接通过 hooks 和 IPC client 管理所有状态。

## 状态管理

| 状态 | 类型 | 来源 | 说明 |
|------|------|------|------|
| messages | `Message[]` | `useAgent()` | 当前会话消息列表 |
| activePlan | `TaskPlan \| null` | `useAgent()` | 当前执行计划 |
| isProcessing | `boolean` | `useAgent()` | Agent 是否正在执行 |
| mode | `AgentMode` | `useAgent()` | 当前工作模式 |
| modelId | `string` | `useAgent()` | 当前模型 ID |
| sessions | `Session[]` | 本地 state | 会话列表 |
| workspacePath | `string \| undefined` | 本地 state | 工作空间路径 |
| panelVisible | `boolean` | 本地 state | 结果面板是否可见 |
| artifacts | `Artifact[]` | 本地 state | Agent 生成的产物 |
| fileChanges | `FileChange[]` | 本地 state | 文件变更列表 |
| currentSessionId | `string \| undefined` | 本地 state | 当前会话 ID |
| activeView | `ViewType` | 本地 state | 当前激活的功能视图 |
| collapsed | `boolean` | 本地 state | 侧边栏是否折叠 |
| expertContext | `{ expert?, sessionId? }` | 本地 state | 专家上下文 |

### ViewType 枚举

```typescript
type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' |
               'mailbox' | 'activate-mailbox' | 'settings' | 'pricing' | 'data' |
               'memory' | 'cloud-agent'
```

> 注：`'skills'`、`'mcp'`、`'design'` 已移除。Skill/MCP 作为 PluginPanel 内部子 Tab 渲染，Design 路由已移除。

## 渲染结构

- `Root (100vh, flex, bg-root)`
  - `Sidebar (始终渲染, 左侧)`
    - `sessions, collapsed, activeView, 各回调`
  - `主区域 (flex:1, flex col)`
    - `顶栏 (44px, bg-card, borderBottom)`
      - `左侧`
        - `汉堡按钮 ☰ → setCollapsed(!collapsed)`
        - `会话标题 (sessions 中 active 的 title 或 'BspBuddy')`
      - `右侧`
        - `"企业智能体" 按钮 → setActiveView('cloud-agent')`
        - `Panel On/Off 按钮 → setPanelVisible`
        - `状态指示器 (isProcessing ? 'Processing...' : 'Ready')`
    - `内容区 (flex:1, flex, overflow:hidden)`
      - `视图路由 (按 activeView 条件渲染)`
        - `'chat' (hasMsg) → ChatPanel`
        - `'chat' (!hasMsg) → WelcomeScreen`
        - `'plugins' → PluginPanel (onClose + workspacePath)`
        - `'experts' → ExpertCenter`
        - `'memory' → MemoryPanel`
        - `'connectors' → ConnectorPanel`
        - `'projects' → ProjectPanel`
        - `'pricing' → PricingPanel`
        - `'data' → DataPanel`
        - `'settings' → SettingsPanel`
        - `'mailbox' → MailboxPanel`
        - `'activate-mailbox' → ActivateMailbox`
        - `'cloud-agent' → CloudAgentPanel`
      - `ResultPanel (条件: activeView === 'chat' && panelVisible)`
  - `底部状态栏 (26px, bg-card, borderTop)`
    - `左侧: "BspBuddy v0.2"`
    - `右侧: 状态指示点 + (isProcessing ? 'Processing' : 'Ready')`

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| default | 启动后 | Sidebar + WelcomeScreen |
| has-message | `messages.length > 0` | Sidebar + ChatPanel (+ ResultPanel 如 panelVisible) |
| panel-on | `panelVisible === true` | 40% 宽度 ResultPanel |
| panel-off | `panelVisible === false` | 无右侧面板 |
| sidebar-collapsed | `collapsed === true` | 52px 窄侧边栏 |
| processing | `isProcessing === true` | 黄色状态点 + "Processing" |
| ready | `isProcessing === false` | 绿色状态点 + "Ready" |

## 交互行为

- 点击新建任务 → `handleNewSession()`: 生成 UUID，重置 messages/artifacts/fileChanges/panelVisible，添加新 session
- 点击选择会话 → `handleSelectSession(id)`: 通过 `loadSession` 加载 messages/plan/workspace/mode/modelId
- 点击发送消息 → `handleSend(text)`: 调用 `sendMessage`，收集 artifacts 和 fileChanges，自动显示结果面板
- 点击停止 → `stopAgent()`: 通过 useAgent 停止执行
- 点击选择工作空间 → `handleSelectWorkspace()`: 调用 `IPC_CHANNELS.FILE_DIALOG`，结果设置 workspacePath
- 侧边栏导航 → `setActiveView(view)`: 切换功能面板
- 汉堡菜单 → `setCollapsed(!collapsed)`: 折叠/展开侧边栏
- Panel On/Off → `setPanelVisible(!panelVisible)`: 切换结果面板
- 召唤专家 → `handleSummonExpert()`: 设置 expertContext，切到 chat，添加欢迎消息
- 专家团执行 → `handleTeamExecute()`: 调用 `IPC_CHANNELS.EXPERT_TEAM_EXECUTE`，切到 chat
- 设置中检查更新 → `ipc.invoke(IPC_CHANNELS.UPDATE_CHECK)`
- 邮箱注入对话 → `ipc.invoke(IPC_CHANNELS.MAIL_CONTEXT)` → `handleSend()`

## IPC 依赖

| Channel | 方向 | 用途 |
|---------|------|------|
| FILE_DIALOG | renderer → main | 选择工作空间目录 |
| UPDATE_CHECK | renderer → main | 检查应用更新 |
| MAIL_CONTEXT | renderer → main | 邮箱 → 获取邮件上下文注入对话 |
| EXPERT_TEAM_EXECUTE | renderer → main | 专家团执行任务 |
| SESSION_SAVE | renderer → main | 自动保存会话（useEffect） |
| SESSION_LOAD | renderer → main | 加载会话数据 |
| SESSION_LIST | renderer → main | 启动时加载会话列表 |
| SESSION_DELETE | renderer → main | 删除会话（计划中） |

## 子组件依赖

| 组件 | 用途 |
|------|------|
| Sidebar | 左侧导航栏 |
| WelcomeScreen | 空状态首页 |
| ChatPanel | 对话主体 |
| ResultPanel | 右侧结果面板 |
| PluginPanel | 插件管理（含 skills / mcp 子 Tab） |
| ExpertCenter | 专家中心 |
| MemoryPanel | 记忆管理 |
| ConnectorPanel | 连接器管理 |
| ProjectPanel | 项目协作 |
| PricingPanel | 定价页面 |
| DataPanel | 数据管理 |
| SettingsPanel | 系统设置 |
| MailboxPanel | Agent 邮箱 |
| ActivateMailbox | 激活邮箱 |
| CloudAgentPanel | 企业智能体 |
| PermissionConfirmModal | 权限确认弹窗（在 ChatPanel 内） |

## 注意事项

1. **品牌名称**: 顶栏 fallback 标题已修正为 `'BspBuddy'`，状态栏版本号也已修正为 `BspBuddy v0.2`。
2. **自动保存逻辑**: `useEffect` 监听 `[messages, activePlan, currentSessionId]` 变化后自动调用 `saveSession`，存在潜在的性能问题（每次消息变化都写磁盘）。
3. **`handleSend` 类型**: `sendMessage` 返回 `Artifact[]` 和 `fileChanges`（通过 `result.artifacts` 和 `result.fileChanges`），但这些字段来自 IPC handler 返回的 `ToolResult`，类型安全依赖运行时保证。
4. **专家/专家团消息处理**: `handleSummonExpert` 直接调用 `setMessages` 添加欢迎消息，绕过了通常的 `sendMessage` 流程。`handleTeamExecute` 先添加欢迎消息再调用 `handleSend`。
5. **视图路由使用条件链**: 使用 `if/else if` 条件渲染而非 switch/router 模式，12 个视图的渲染逻辑集中在一个 JSX 表达式中。
6. **PluginPanel 接收 workspacePath**: `PluginPanel` 现在接收 `workspacePath` prop，供其内部 MCP 子 Tab 使用。
7. **顶栏新增"企业智能体"按钮**: 顶栏右侧新增 accent 配色的"企业智能体"按钮，点击切换到 `cloud-agent` 视图。
