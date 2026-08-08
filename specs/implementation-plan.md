# WorkBuddy Implementation Plan

> 将 BspBuddy 从代码助手重构为 WorkBuddy 办公助手，6 个 Phase 覆盖 Agent 内核、三模式 UI、右侧结果面板、任务管理、办公工具链、对话交互打磨。

## Architecture Overview

### Current State
- 两栏布局: Sidebar + ChatPanel/WelcomeScreen
- Agent: CodeAgent (代码生成 system prompt, `file_read/write/edit/search` 工具)
- 无模式切换, 无模型选择器, 无右侧面板, 无文件上传, 无持久化

### Target Architecture
```
src/
├── main/services/
│   ├── agent.ts          [REWRITE] 办公 Agent (替换 code-agent.ts)
│   ├── ai.ts             [KEEP]    OpenAI client (添加多模型配置)
│   ├── orchestrator.ts   [KEEP]    计划编排执行
│   ├── ipc-handlers.ts   [MODIFY]  新增 IPC 通道
│   ├── fs-service.ts     [KEEP]    文件系统操作
│   └── tools/
│       ├── file.ts        [KEEP]    基础文件读写
│       ├── file-code.ts   [DELETE]  代码工具
│       ├── office.ts      [NEW]     Word/Excel/PPT/PDF 生成
│       ├── search.ts      [NEW]     网络搜索
│       └── registry.ts    [KEEP]    工具注册表
├── main/
│   └── python-bridge.ts   [NEW]     Python sidecar 管理器
├── renderer/App.tsx       [REWRITE] 三栏布局(左+中+右)
├── components/
│   ├── Sidebar.tsx         [REWRITE] 任务分组/搜索/筛选/右键菜单
│   ├── ChatPanel.tsx       [REWRITE] 模式切换/上传/时间线/停止
│   ├── WelcomeScreen.tsx   [MODIFY] 添加三种模式入口
│   ├── ModeSwitch.tsx      [NEW]    Ask/Craft/Plan 三按钮
│   ├── ModelSelector.tsx   [NEW]    5 模型下拉
│   ├── ResultPanel.tsx     [NEW]    右侧面板容器
│   ├── ArtifactView.tsx    [NEW]    产物列表
│   ├── WorkspaceFiles.tsx  [NEW]    工作空间文件树+预览
│   ├── DiffView.tsx        [NEW]    变更 diff
│   ├── BrowserPreview.tsx  [NEW]    内置浏览器
│   ├── Timeline.tsx        [NEW]    执行时间线
│   └── UploadZone.tsx      [NEW]    拖拽/粘贴/@引用
├── hooks/
│   ├── useAgent.ts         [MODIFY] 添加模式/模型/文件上下文/停止
│   ├── useSession.ts       [NEW]    会话持久化
│   └── usePython.ts        [NEW]    Python sidecar 状态
└── lib/
    └── types.ts            [MODIFY] 扩展类型定义
```

---

## Phase 1: Agent 内核改造 + 三模式 UI

**目标**: Agent 理解办公任务(生成周报/分析Excel/做PPT), 用户可选 Ask/Craft/Plan 模式

### 1.1 重写 Agent System Prompt (`src/main/services/agent.ts`)
- 角色: "办公助手" 替代 "代码助手"
- 支持 Office 工具: `word_generate`, `excel_analyze`, `ppt_create`, `pdf_parse`, `web_search`
- 模式感知: Craft 模式直接执行, Plan 模式只出计划不执行
- 删除 `src/main/services/code-agent.ts`

### 1.2 注册 Office 工具 (`src/main/services/tools/office.ts`)
- `word_generate` — 接收 markdown 内容 + 文件路径 → 生成 .docx
- `excel_analyze` — 读取/分析 Excel, 生成图表数据
- `ppt_create` — 生成 .pptx
- `pdf_parse` — 提取 PDF 文本
- 每个工具通过 `python-bridge.ts` 调用 Python sidecar

### 1.3 注册搜索工具 (`src/main/services/tools/search.ts`)
- `web_search` — DuckDuckGo 搜索, 返回 title/url/snippet

### 1.4 删除代码工具 (`src/main/services/tools/file-code.ts`)
- 移除 `file_edit`, `code_search`

### 1.5 Python Bridge (`src/main/python-bridge.ts`)
- 使用 `python-shell` 调用 Python 脚本
- 管理 Python 环境检测和 pip 依赖安装
- 通信协议: stdin/stdout JSON

### 1.6 模式切换 UI (`src/components/ModeSwitch.tsx`)
- Ask / Craft / Plan 三个按钮, 蓝色高亮当前模式
- 点击切换时更新 hint 文字: "仅问答" / "直接执行" / "先生成计划"
- 插入到 ChatPanel 输入框上方

### 1.7 更新类型 (`src/lib/types.ts`)
- 移除 `CodeEdit` 引用
- 新增 `OfficeArtifact`, `ModelConfig`
- 新增 IPC 通道: `PYTHON_EXEC`, `PYTHON_STATUS`, `SEARCH_WEB`, `STOP_TASK`

### 1.8 更新 IPC (`src/main/services/ipc-handlers.ts`)
- 修改 EXECUTE_TASK 使用新 agent (替代 codeAgent)
- 新增 PYTHON_EXEC handler
- 新增 SEARCH_WEB handler
- 新增 STOP_TASK handler (AbortController)

### Acceptance
- 输入"帮我写一份周报" → Agent 输出 Word 生成计划
- Ask 模式: 只回复文字, 不执行
- Plan 模式: 输出步骤列表, 等待用户确认
- Craft 模式: 直接执行全部步骤

---

## Phase 2: 文件上传 + 工作空间选择

### 2.1 UploadZone 组件 (`src/components/UploadZone.tsx`)
- 拖拽文件到输入框 → 读取为 base64/data URL
- Ctrl+V 粘贴图片 → 显示缩略图
- @ 输入触发文件选择 (调用 `dialog.showOpenDialog`)
- 已选文件显示为 chips, 可删除

### 2.2 工作空间选择器
- 输入框左下角文件夹图标 → 打开系统文件选择器
- 选中后显示当前工作空间路径

### 2.3 更新 ChatPanel
- 导入 UploadZone, 嵌入到 textarea 上方
- 文件列表作为上下文传递到 sendMessage

### Acceptance
- 拖拽 .xlsx 文件 → 显示文件名 chip → 发送时传递路径到 Agent
- Ctrl+V 粘贴截图 → 显示缩略图 → 发送时传递 image data

---

## Phase 3: 右侧结果面板 (四视图)

### 3.1 ResultPanel 容器 (`src/components/ResultPanel.tsx`)
- 右侧可折叠面板 (宽度 40%)
- 四个 Tab: 产物 | 文件 | 变更 | 浏览器
- Tab 切换, 默认显示产物

### 3.2 ArtifactView (`src/components/ArtifactView.tsx`)
- 列表展示 Agent 生成的文件 (文件名 + 类型图标 + 大小)
- 点击下载/预览 (markdown/html 可内联预览)

### 3.3 WorkspaceFiles (`src/components/WorkspaceFiles.tsx`)
- 文件树 (基于 workspacePath 递归读取)
- 点击文件名 → 右侧预览区显示内容
- 顶部标签切换已打开文件

### 3.4 DiffView (`src/components/DiffView.tsx`)
- 展示任务涉及的文件变更 (diff 对比)
- 前端 diff: 记录 originalContent vs newContent

### 3.5 BrowserPreview (`src/components/BrowserPreview.tsx`)
- 使用 Electron `<webview>` 标签或 iframe
- 预览 HTML 产物

### 3.6 更新 App.tsx
- 三栏布局: Sidebar(240px) | ChatPanel(flex) | ResultPanel(40%)
- ResultPanel 可折叠 (面板按钮切换)
- useAgent 返回的 artifacts/files 传给 ResultPanel

### Acceptance
- Agent 生成 .docx → 产物 Tab 显示文件, 可下载
- 文件 Tab 显示工作空间文件树
- HTML 产物 → 浏览器 Tab 可预览

---

## Phase 4: 模型选择器 + 任务列表完善

### 4.1 ModelSelector (`src/components/ModelSelector.tsx`)
- 输入框上方下拉菜单
- 5 个模型选项: MiniMax / 智谱GLM / Kimi / DeepSeek / 混元
- 选中模型传递到 useAgent → IPC
- 更新 ai.ts 支持 model 参数切换

### 4.2 任务列表完善 (`src/components/Sidebar.tsx`)
- 两个 Tab: "任务" / "空间"
- "任务" Tab: 最近任务列表 (标题 + 状态 + 时间)
- "空间" Tab: 按工作空间分组的任务列表
- 搜索框: 过滤任务标题
- 状态筛选: 下拉选择状态
- 任务右键菜单: 置顶/重命名/删除/打开文件夹

### Acceptance
- 切换模型后, Agent 使用对应模型 API
- 任务列表按空间分组显示
- 右键菜单可重命名/删除任务

---

## Phase 5: 会话持久化

### 5.1 useSession hook (`src/hooks/useSession.ts`)
- `saveSession(id, messages, plan, workspace)`
- `loadSession(id)`
- `listSessions()`
- 存储: `app.getPath('userData')/sessions/<id>.json`

### 5.2 IPC 通道
- `SESSION_SAVE` / `SESSION_LOAD` / `SESSION_LIST` / `SESSION_DELETE`

### 5.3 集成
- App 启动时加载所有会话 → 渲染任务列表
- 切换任务时加载对应 messages + plan
- 每次发送消息后自动保存

### Acceptance
- 关闭重开应用 → 任务列表恢复
- 点击历史任务 → 对话和计划恢复

---

## Phase 6: 对话交互打磨 + Python Sidecar 实际安装

### 6.1 执行时间线 (`src/components/Timeline.tsx`)
- 每个 step 显示为卡片: 工具图标 + 描述 + 状态 + 耗时
- running: 旋转动画, completed: 绿色勾, failed: 红色叉
- 点击可展开查看详情 (params + result)

### 6.2 停止按钮
- isProcessing 时, 发送按钮变为停止按钮 (红色方块)
- 点击 → `ipc.invoke('agent:stop')` → AbortController.abort()

### 6.3 对话内搜索 + 历史提问
- ChatPanel 顶栏搜索图标 → 展开搜索框 → 高亮匹配消息
- 历史按钮 → 显示历史提问列表 → 点击跳转

### 6.4 Python 依赖安装
- 脚本: `scripts/setup-python.sh` / `setup-python.ps1`
- 安装 python-docx, openpyxl, matplotlib, python-pptx, PyMuPDF, duckduckgo-search

### 6.5 集成测试
- 端到端: 输入需求 → Agent 规划 → Python 生成 → 右侧面板展示

### Acceptance
- 任务执行时显示时间线, 可查看每步详情
- 点击停止 → Agent 中止, 输入框恢复
- 搜索对话内容可高亮匹配

---

## File Change Summary

| 操作 | 文件 | 说明 |
|------|------|------|
| NEW | `src/main/services/agent.ts` | 办公 Agent (替代 code-agent.ts) |
| NEW | `src/main/services/tools/office.ts` | Word/Excel/PPT/PDF 工具 |
| NEW | `src/main/services/tools/search.ts` | 网络搜索工具 |
| NEW | `src/main/python-bridge.ts` | Python sidecar 桥接 |
| NEW | `src/components/ModeSwitch.tsx` | 三模式切换按钮 |
| NEW | `src/components/ModelSelector.tsx` | 5 模型下拉 |
| NEW | `src/components/ResultPanel.tsx` | 右侧面板容器 |
| NEW | `src/components/ArtifactView.tsx` | 产物列表 |
| NEW | `src/components/WorkspaceFiles.tsx` | 工作空间文件树 |
| NEW | `src/components/DiffView.tsx` | 变更 diff |
| NEW | `src/components/BrowserPreview.tsx` | 内置浏览器 |
| NEW | `src/components/Timeline.tsx` | 执行时间线 |
| NEW | `src/components/UploadZone.tsx` | 拖拽/粘贴/@引用 |
| NEW | `src/hooks/useSession.ts` | 会话持久化 |
| NEW | `src/hooks/usePython.ts` | Python 状态 |
| NEW | `scripts/setup-python.ps1` | Python 依赖安装 |
| DELETE | `src/main/services/code-agent.ts` | 代码 Agent (替换) |
| DELETE | `src/main/services/tools/file-code.ts` | 代码工具 (替换) |
| MODIFY | `src/lib/types.ts` | 扩展类型 + IPC 通道 |
| MODIFY | `src/main/services/ipc-handlers.ts` | 新增 IPC handler |
| MODIFY | `src/main/services/ai.ts` | 多模型配置 |
| MODIFY | `src/renderer/App.tsx` | 三栏布局 |
| MODIFY | `src/components/ChatPanel.tsx` | 模式/上传/时间线/停止 |
| MODIFY | `src/components/Sidebar.tsx` | 分组/搜索/筛选/菜单 |
| MODIFY | `src/components/WelcomeScreen.tsx` | 三种模式入口 |
| MODIFY | `src/hooks/useAgent.ts` | 模式/模型/文件/停止 |
| MODIFY | `package.json` | 添加 python-shell 依赖 |
