# 01 — 新建任务栏 (Task-Bar)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Task-Bar.md`
> Status: ✅ P0-P2 已完成

## 功能概要

WorkBuddy 的核心输入区：三种工作模式切换、五个 AI 模型选择、工作空间设置、技能挂载、权限管理。

## 已实现

| 功能点 | 实现位置 | 说明 |
|--------|----------|------|
| 三模式切换 | `ModeSwitch.tsx` | Ask/Craft/Plan 按钮组，蓝色高亮当前模式 |
| 五模型选择 | `ModelSelector.tsx` | DeepSeek/混元/GLM/Kimi/MiniMax 下拉 |
| 工作空间选择 | `ChatPanel.tsx` 底部 + App.tsx | 文件夹图标 → 系统选择器 |
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
src/components/ModeSwitch.tsx      - 三模式按钮组
src/components/ModelSelector.tsx   - 五模型下拉菜单
src/components/ChatPanel.tsx       - 集成 ModeSwitch + ModelSelector + workspace
src/lib/types.ts                   - AgentMode, ModelOption, AVAILABLE_MODELS
```
