# 01 — 新建任务栏 (Task-Bar)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Task-Bar.md`
> Status: ✅ P0-P2 已完成

## 功能概要

WorkBuddy 的核心输入区：四种工作模式切换、动态模型选择、工作空间设置、技能挂载、权限管理。

## 已实现

| 功能点 | 实现位置 | 说明 |
|--------|----------|------|
| 模式切换 | `ModeSwitch.tsx` | 四模式（Ask/Craft/Plan/Design），输入框左侧下拉，蓝色高亮当前模式 |
| 模型选择 | `ModelSelector.tsx` | 输入框下方左起第二个，动态加载本机/云端模型 |
| 权限模式 | `PermissionSelector.tsx` | 输入框下方，与模型选择同行 |
| 工作空间选择 | `ChatPanel.tsx` 底部 | 输入框下方最左侧第一个，显示当前工作区名称 |
| 底部工具栏 | `ChatPanel.tsx` | 输入框下方最右侧：搜索/分享/历史图标 |
| 模式感知 placeholder | `ChatPanel.tsx` | Ask: "Ask a question..." / Craft: "Describe your task..." |
| 模型定义 | `types.ts` → `AVAILABLE_MODELS` | 每个模型含 id/name/provider/description |

## 待完善

| 功能点 | 描述 | 任务 |
|--------|------|------|
| 技能选择器 | 输入框上方显示已安装技能 chips，勾选后注入 Agent context | 【P3-3d】创建 `SkillSelector.tsx` 组件，从 Skills-Market 读取已安装列表 |
| 连接器面板 | 输入框旁展示已连接的外部服务状态图标 | 【P3-3e】依赖 08-connector plan 完成后集成 |
| 权限模式指示器 | 当前权限模式显示：默认(沙箱) / 完全放开 | 【P3-3f】依赖 10-permission plan 完成后集成 |
| 模型→API 实际切换 | 当前 modelId 只在前端选择，未传给 ai.ts 切换 API endpoint | 【P3-1a】更新 `ipc-handlers.ts` 的 EXECUTE_TASK 携带 modelId，`ai.ts` 支持多模型配置 |

## 文件清单

```
src/components/ModeSwitch.tsx      - 四模式下拉组件
src/components/ModelSelector.tsx   - 动态模型下拉菜单
src/components/ChatPanel.tsx       - 集成 ModeSwitch + ModelSelector + workspace
src/lib/types.ts                   - AgentMode, ModelOption, AVAILABLE_MODELS
```
