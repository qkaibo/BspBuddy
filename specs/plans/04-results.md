# 04 — 结果查看 (Results)

> 对应 SPEC: `specs/Results.md`
> Status: ✅ P0-P2 已完成

## 功能概要

右侧结果面板：四视图 Tab（产物/文件/变更/浏览器），可折叠/展开。

## 已实现

| 功能点 | 实现位置 | 说明 |
|--------|----------|------|
| 结果面板容器 | `ResultPanel.tsx` | 右侧 40% 宽度，可折叠 |
| 四 Tab 切换 | `ResultPanel.tsx` tabs | 产物/文件/变更/浏览器 |
| 产物列表 | `ArtifactView.tsx` | 文件名 + 类型图标 + 大小 + 预览/下载 |
| 文件树 | `WorkspaceFiles.tsx` | 递归读取目录，展开/折叠 |
| 变更 diff | `DiffView.tsx` | 文件名 + 描述 + ±行数 |
| 浏览器预览 | `BrowserPreview.tsx` | iframe sandbox 内嵌 HTML |
| Panel toggle | `App.tsx` top bar | "Panel On/Off" 按钮 |

## 待完善

| 功能点 | 描述 | 任务 |
|--------|------|------|
| 产物预览 (Markdown) | ArtifactView 的 Preview 按钮未实现渲染 | 【P3-4a】Markdown 渲染器 (react-markdown)，弹窗或内联展开 |
| 产物预览 (HTML) | HTML 产物点击后应切换到 Browser Tab | 【P3-4b】ArtifactView 点击 HTML → setActiveTab('browser') + setPreviewHtml |
| 产物打开/下载 | Download 按钮未实现 | 【P3-4c】调用 shell.openPath / IPC 写入下载 |
| 文件树预览内容 | 点击文件后右侧显示内容 | 【P3-4d】WorkspaceFiles 点击文件 → IPC READ_FILE → 渲染 |
| Diff 真实数据 | DiffView 目前传空数组 | 【P3-4e】Agent 执行时记录 fileBefore/fileAfter，传给 DiffView |
| 概览 Tab | Results 面板还有一个"概览"Tab(带总结) | 【P3-4f】Overview 组件：任务摘要 + 执行统计 + 产物概览 |

## 文件清单

```
src/components/ResultPanel.tsx     - 右侧面板容器
src/components/ArtifactView.tsx    - 产物列表
src/components/WorkspaceFiles.tsx  - 文件树
src/components/DiffView.tsx        - 变更 diff
src/components/BrowserPreview.tsx  - 浏览器预览
```
