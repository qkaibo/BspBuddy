# Component: ResultPanel

> 状态: confirmed | 最后一次与 WorkBuddy 参考对比: 2026-08-03

## WorkBuddy 参考设计（来源：specs/Results.md L9-20, specs/plan/04-results.md L31）

WorkBuddy 的右侧结果面板包含**四视图**：

| Tab | 名称 | 内容 |
|-----|------|------|
| 1 | **概览** | 任务摘要 + 执行统计 + 产物概览（综合仪表板，非纯文件树） |
| 2 | **浏览器** | 网页预览或可直接打开的结果页面 |
| 3 | **变更** | 本次任务带来的文件修改 |
| 4 | **产物** | 任务生成的文件和交付物 |

## 当前 BspBuddy 实现 vs WorkBuddy 参考差异

| 差异 | WorkBuddy | BspBuddy 当前 | 严重性 |
|------|-----------|---------------|--------|
| Tab 1 名称/语义 | "概览" — 综合仪表板 | "产物" (Artifacts) — 仅文件列表 | 🔴 结构级 |
| Tab 4 名称/语义 | "产物" — 任务交付物 | "文件" (WorkspaceFiles) — 工作空间文件树 | 🔴 结构级 |
| "概览"综合视图 | 任务摘要+统计+产物概览 | **完全缺失** — 无等效视图 | 🔴 功能缺失 |
| 面板打开按钮位置 | 对话区内第 4 个按钮 | 全局顶栏 Panel On/Off | 🟡 交互位置 |

## 概述
右侧结果面板，包含四个 Tab（产物/文件/变更/浏览器），仅在 chat 视图且 `visible === true` 时渲染。宽度固定 40%。

## 所属视图
主内容区右侧 — 仅在 `activeView === 'chat'` 且 `visible === true` 时渲染

## Props 接口

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| artifacts | `Artifact[]` | 是 | — | Agent 生成的产物列表 |
| workspacePath | `string \| undefined` | 否 | — | 工作空间路径，传给 ArtifactView 和 WorkspaceFiles |
| visible | `boolean` | 是 | — | 是否显示面板 |
| onToggle | `() => void` | 是 | — | 关闭面板回调（设置 visible=false） |
| changes | `Array<{ filePath: string; description: string; addedLines?: number; removedLines?: number }>` | 否 | `[]` | 文件变更列表 |

## 渲染结构

- `Container (条件: visible, width:40%, flex col, bg-card, flexShrink:0)`
  - `Header (Tab 栏, borderBottom)`
    - `Tab 按钮 (循环: TABS.map)`
      - `图标 + 标签 (Artifacts / Files / Changes / Browser)`
      - `底部 accent 高亮条 (条件: isActive)`
    - `X 关闭按钮 → onToggle`
  - `Content (flex:1, overflow:hidden)`
    - `ArtifactView (条件: activeTab === 'artifacts')`
      - `artifacts + workspacePath + onPreviewInBrowser`
    - `WorkspaceFiles (条件: activeTab === 'files')`
      - `workspacePath`
    - `DiffView (条件: activeTab === 'diff')`
      - `changes` prop（从 App.tsx 的 fileChanges state 传入）
    - `BrowserPreview (条件: activeTab === 'browser')`
      - `htmlContent`（从 ArtifactView 的 onPreviewInBrowser 设置）

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| hidden | `visible === false` | 不渲染（return null） |
| visible | `visible === true` | 40% 宽度右侧面板 |
| tab-artifacts | `activeTab === 'artifacts'` | 产物列表 |
| tab-files | `activeTab === 'files'` | 工作空间文件树 |
| tab-diff | `activeTab === 'diff'` | 文件变更统计列表 |
| tab-browser | `activeTab === 'browser'` | 内嵌 iframe HTML 预览 |

## 交互行为

- 点击 Tab 按钮 → 切换 `activeTab` 状态，对应渲染子组件
- 点击 X 关闭按钮 → 调用 `onToggle()`，父组件设置 `visible=false`
- ArtifactView 中点击 HTML 预览 → 调用 `handlePreviewInBrowser(html)`，设置 `previewHtml` 并切换到 browser Tab
- Panel On/Off 按钮（App.tsx 顶栏）→ 切换 `panelVisible` 状态

## IPC 依赖

ResultPanel 本身不直接调用 IPC。子组件的 IPC 依赖：
| Channel | 方向 | 用途 |
|---------|------|------|
| LIST_DIR | renderer → main | WorkspaceFiles 递归读取工作空间目录 |
| READ_FILE | renderer → main | WorkspaceFiles 读取文件内容预览 |
| WRITE_FILE | renderer → main | ArtifactView 下载/保存产物 |

## 子组件依赖

| 组件 | 用途 |
|------|------|
| ArtifactView | 产物列表（文件名+类型图标+大小+预览/下载） |
| WorkspaceFiles | 工作空间文件树 |
| DiffView | 文件变更列表（filePath + description + +/- 行数） |
| BrowserPreview | iframe 内嵌 HTML 预览 |

## 注意事项

1. **[实现差异] DiffView 数据来源**: 之前 `changes` 写死为 `[]`（已修复），现在通过 App.tsx 的 `fileChanges` state 传入。但 DiffView 本身只显示**统计列表**（filePath + description + addedLines/removedLines），而非 SPEC 描述的"左侧文件列表 + 右侧 diff 对比 (originalContent vs newContent)"。
2. **[实现差异] BrowserPreview 使用 iframe**: SPEC 描述使用 Electron `<webview>` 标签，实际代码使用 `<iframe sandbox>`。且无地址栏/刷新按钮。
3. **Tab 标签为英文**: Artifacts / Files / Changes / Browser，与 SPEC 的中文描述（产物/文件/变更/浏览器）不一致。
4. **previewHtml 仅在内存中**: `previewHtml` 状态仅在 ArtifactView 的 `onPreviewInBrowser` 回调时设置，无持久化，切换 Tab 后数据保留在组件 state 中。
5. **WorkspaceFiles 仅在 ResultPanel 中可用**: 用户无法在非 chat 视图下访问文件树（因为 ResultPanel 仅在 `activeView === 'chat'` 时渲染）。
6. **Panel 开关状态由父组件控制**: `visible` prop 完全由 App.tsx 的 `panelVisible` state 控制，ResultPanel 内的 Tab 状态（`activeTab`）在面板关闭后保留（组件 unmount 后丢失）。
