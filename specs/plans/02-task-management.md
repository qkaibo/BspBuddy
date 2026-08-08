# 02 — 任务管理 (Create-Task + Task-Management)

> 对应 SPEC: `specs/Create-Task.md`, `specs/Task-Management.md`
> Status: ✅ P0-P2 已完成

## 功能概要

任务列表：新建/切换/搜索/筛选/右键菜单。任务管理：6种状态追踪 + 7种操作 + 多任务并行。

## 已实现

| 功能点 | 实现位置 | 说明 |
|--------|----------|------|
| 新建任务 | `App.tsx` → `handleNewSession` | 生成 UUID，重置 messages/artifacts/panel |
| 任务列表 (Tasks Tab) | `Sidebar.tsx` | 标题 + 日期 + 活跃高亮 |
| 空间分组 (Spaces Tab) | `Sidebar.tsx` | 按 workspace 字段分组 |
| 搜索过滤 | `Sidebar.tsx` | 实时过滤任务标题 |
| 右键菜单 | `Sidebar.tsx` | Pin/Rename/Delete/Open folder |
| 会话持久化 | `useSession.ts` + IPC handlers | 自动保存/加载/列表/删除 |
| 多任务切换 | `App.tsx` → `handleSelectSession` | 加载 messages + plan + workspace + mode + modelId |

## 待完善

| 功能点 | 描述 | 任务 |
|--------|------|------|
| 6种任务状态 | pending/running/completed/failed/paused/cancelled | 【P3-2a】`TaskPlan` 增加完整状态枚举，Sidebar 显示状态图标 |
| 7种操作 | 重命名/删除/置顶/归档/导出/复制/分享 | 【P3-2b】右键菜单增加完整操作，归档功能存到 sessions/archive/ |
| 状态筛选下拉 | 按状态筛选任务列表 | 【P3-2c】Sidebar 增加状态筛选 dropdown |
| 多任务并行指示器 | 同时运行多个任务时的 UI 提示 | 【P3-2d】Top bar 显示并行任务数 |

## 文件清单

```
src/components/Sidebar.tsx         - 双 Tab + 搜索 + 右键菜单
src/hooks/useSession.ts            - save/load/list/delete
src/main/services/ipc-handlers.ts  - SESSION_SAVE/LOAD/LIST/DELETE
src/renderer/App.tsx               - handleNewSession/handleSelectSession
```
