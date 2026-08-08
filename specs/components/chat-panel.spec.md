# Component: ChatPanel

> 状态: confirmed | 最后一次与 WorkBuddy 参考对比: 2026-08-03

## WorkBuddy 参考设计（来源：specs/Conversation.md L18-26）

对话区顶部标题栏包含 4 个操作按钮（从左到右）：
1. **对话内搜索** — 输入关键词快速查找目标对话内容
2. **分享任务** — 自动生成公开链接，分享到任意渠道
3. **历史提问** — 查看任务内历史对话记录，支持点击跳转
4. **显示详情面板** — 打开右侧边栏，查看产物/全部文件/文件变更/内置浏览器

## 当前 BspBuddy 实现 vs WorkBuddy 参考差异

| 差异 | WorkBuddy | BspBuddy 当前 | 严重性 |
|------|-----------|---------------|--------|
| 标题栏按钮数量 | 4 个 | 3 个（缺"显示详情面板"按钮） | 🟡 功能缺失 |
| 面板切换入口 | 对话区内按钮 | 全局顶栏 Panel On/Off | 🟡 交互位置 |
| 文件上传 | 文件内容传 Agent | 仅拼文件名到 `[Attached files:]` | 🟡 实现不完整 |
| 历史按钮 | 有 handler | 无 onClick handler | 🟡 死按钮 |
| 分享 | 生成公开链接 | 仅复制首条消息前 50 字符 | 🟡 简化实现 |

## 概述
对话主体面板，包含消息列表、时间线、输入区域（模式切换 + 模型选择 + 上传 + 权限选择 + 文本输入 + 发送/停止）。

## 所属视图
主内容区 — `activeView === 'chat'` 且 `hasMsg === true` 时渲染

## Props 接口

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| messages | `Message[]` | 是 | — | 对话消息列表 |
| activePlan | `TaskPlan \| null` | 是 | — | 当前执行计划 |
| isProcessing | `boolean` | 是 | — | 是否正在执行 |
| mode | `AgentMode` | 是 | — | 当前工作模式 |
| workspacePath | `string \| undefined` | 否 | — | 工作空间路径 |
| modelId | `string` | 是 | — | 当前模型 ID |
| onModeChange | `(mode: AgentMode) => void` | 是 | — | 模式切换回调 |
| onModelChange | `(model: ModelOption) => void` | 是 | — | 模型切换回调 |
| onSend | `(text: string) => void` | 是 | — | 发送消息回调 |
| onStop | `() => void` | 是 | — | 停止执行回调 |
| onSelectWorkspace | `() => void` | 是 | — | 选择工作空间回调 |

## 渲染结构

- `Container (flex col, h-full)`
  - `消息区 (flex:1, overflow:auto)`
    - `搜索栏 (条件: searchOpen)`
      - `SearchIcon + input + X 关闭按钮`
    - `Timeline (条件: activePlan 存在)`
      - `步骤行 (循环: plan.steps)`
    - `消息行 (循环: messages.map)`
      - `用户消息 (role === 'user')`
        - `右对齐蓝色气泡`
      - `AI 消息 (role === 'assistant')`
        - `Task Plan 卡片 (条件: msg.plan?.steps.length > 0)`
          - `Sparkles 图标 + "Task Plan" 标题`
          - `步骤列表 (循环: msg.plan.steps.map)`
        - `内容气泡 (条件: msg.content)`
          - `灰色背景卡片, pre-wrap 文本`
    - `Thinking 动画 (条件: isProcessing && !activePlan)`
      - `Loader2 旋转图标 + "Thinking..."`
    - `Progress 卡片 (条件: activePlan 存在)`
      - `进度条 (doneCount/totalCount)`
      - `步骤列表 (循环: activePlan.steps.map)`
        - `StepDot + 描述文字`
  - `输入区 (padding, borderTop, bg-card)`
    - `模式/模型行`
      - `ModeSwitch (mode, onChange)`
      - `ModelSelector (selectedId, onChange)`
    - `权限选择行`
      - `PermissionSelector (mode, onChange)`
    - `输入框区域 (bg-input, borderRadius)`
      - `UploadZone (files, onAdd, onRemove, workspacePath, onSelectWorkspace)`
      - `输入行`
        - `textarea (placeholder 随 mode 变化)`
        - `停止按钮 (条件: isProcessing, 红色背景 Square 图标)`
        - `发送按钮 (条件: !isProcessing, accent 背景 Send 图标)`
    - `底部工具栏`
      - `工作空间选择 (FolderOpen 图标 + 路径名)`
      - `操作按钮组`
        - `搜索 (SearchIcon toggle)`
        - `分享 (Share2, 复制到剪贴板)`
        - `历史 (Clock 图标, 无 handler) [实现差异]`
        - `提示文字 (随 mode 变化)`
  - `PermissionConfirmModal (条件: pendingRequest 存在)`

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| default | `messages.length > 0` | 消息列表 + 输入框 |
| processing | `isProcessing === true` | 发送按钮变为红色停止按钮，可能有 Thinking 动画或进度条 |
| no-plan | `isProcessing && !activePlan` | "Thinking..." 旋转动画 |
| with-plan | `activePlan !== null` | Timeline + Progress 卡片 |
| empty-files | `uploadedFiles.length === 0` | 仅文本输入 |
| with-files | `uploadedFiles.length > 0` | 文件 chips 列表 + 文本输入 |
| search-open | `searchOpen === true` | 顶部搜索栏展开 |

## 交互行为

- Enter 键 → 如果有文本，发送消息（附带附件文件列表拼接到消息文本）[实现差异：文件以文本形式拼接而非实际传输]
- Shift+Enter → 换行（默认 textarea 行为）
- 点击发送按钮 → `sendMessage()`，清空 inputText 和 uploadedFiles
- 点击停止按钮 → `onStop()`，调用 IPC `AGENT_STOP`
- 点击模式切换 → `onModeChange(mode)`，placeholder 文字随模式变化
- 点击模型选择 → `onModelChange(model)`，切换模型下拉菜单
- 点击搜索图标 → 切换 `searchOpen`，展开搜索输入框
- 点击分享按钮 → 将首条消息前 50 字符复制到剪贴板 [实现差异：功能极简，未实现完整分享流程]
- 点击历史按钮 → **无 handler，无功能** [实现差异]
- 点击工作空间文件夹 → `onSelectWorkspace()`，App 内触发 `IPC_CHANNELS.FILE_DIALOG`
- 上传文件 → `uploadedFiles` 更新，显示文件 chips；发送时文件名拼入消息文本（如 `[Attached files: a.txt, b.png]`）
- 权限确认弹窗 → 用户允许/拒绝后调用 `respondToRequest` / `dismissRequest`

## IPC 依赖

ChatPanel 本身不直接调用 IPC（通过 props 回调间接触发）。其子组件使用的 IPC：
| Channel | 方向 | 用途 |
|---------|------|------|
| AGENT_STOP | renderer → main | 停止执行（onStop → stopAgent） |
| FILE_DIALOG | renderer → main | 选择工作空间（onSelectWorkspace → handleSelectWorkspace） |
| PERMISSION_CHECK | renderer → main | 权限确认弹窗回调 |

## 子组件依赖

| 组件 | 用途 |
|------|------|
| ModeSwitch | 工作模式切换按钮组 |
| ModelSelector | 模型选择下拉菜单 |
| UploadZone | 文件拖拽/粘贴/@引用 |
| Timeline | 执行步骤时间线展示 |
| PermissionSelector | 权限模式选择下拉 |
| PermissionConfirmModal | 高风险操作权限确认弹窗 |

## 注意事项

1. **[实现差异] 文件上传**: `uploadedFiles` 在 `handleSend` 时被清空，文件内容并未实际传给后端 Agent，仅将文件名拼入消息文本（`[Attached files: ...]`）。Plan 03 标注此为 P3 待完善项。
2. **[实现差异] 历史按钮无功能**: `Clock` 图标按钮无 `onClick` handler，仅为占位 UI。Plan 03 标注需创建 `HistoryPrompt` 组件。
3. **[实现差异] 搜索仅 toggle**: `searchOpen` 控制搜索框显隐，`searchQuery` 状态存在但未实际过滤/高亮消息。Plan 03 标注此为 P3 待完善项。
4. **[实现差异] 分享功能极简**: 仅复制首条消息前 50 字符到剪贴板，非 SPEC 描述的"自动生成公开链接"。
5. **[实现差异] 品牌名称**: 分享文本和底部提示中使用 `WorkBuddy`，应改为 `BspBuddy`。
6. **[实现差异] 无面板切换按钮**: SPEC 描述 ChatPanel 顶栏应有"显示详情面板"切换按钮（对话内切换右侧结果区），代码中无此功能（#11 待修复项）。
7. **placeholder 随模式变化**: ask → "Ask a question..." / craft → "Describe your task, I'll execute it..." / plan → "Describe your task, I'll make a plan..." / design → 无特殊 placeholder
8. **模式提示文字**: ask 显示 "Answers for reference only"，其他显示 "WorkBuddy may make mistakes"
