# 03 — 任务对话 (Conversation)

> 对应 SPEC: `specs/Conversation.md`
> Status: ✅ P0-P2 已完成

## 功能概要

对话输入区：@引用文件、拖拽上传、粘贴图片、发送/停止、模式切换、模型选择。

## 已实现

| 功能点 | 实现位置 | 说明 |
|--------|----------|------|
| 对话消息列表 | `ChatPanel.tsx` | user/assistant 角色渲染，Markdown 内容 |
| 输入框 | `ChatPanel.tsx` textarea | Enter 发送，Shift+Enter 换行 |
| 拖拽上传 | `UploadZone.tsx` → onDrop | 读取 fileName + path + size，显示 chip |
| Ctrl+V 粘贴 | `UploadZone.tsx` → onPaste | 图片转 dataURL，其他文件显示 chip |
| @ 引用菜单 | `UploadZone.tsx` → showAtMenu | 弹出文件浏览选项 |
| 停止按钮 | `ChatPanel.tsx` → Square 红色按钮 | isProcessing 时发送按钮变停止 |
| 模式切换 | `ModeSwitch.tsx` | 输入框上方三按钮 |
| 模型选择 | `ModelSelector.tsx` | 输入框上方下拉 |
| 对话搜索 | `ChatPanel.tsx` → searchOpen | 搜索图标 → 搜索框 → 过滤消息 |
| 执行进度条 | `ChatPanel.tsx` activePlan | doneCount/totalCount 进度条 + 步骤列表 |
| Empty 状态 | `WelcomeScreen.tsx` | 技能卡片 + 推荐 prompt |

## 待完善

| 功能点 | 描述 | 任务 |
|--------|------|------|
| @引用实际文件 | @ 菜单目前只有浏览按钮，无真实文件列表 | 【P3-3a】@ 时 IPC 调用 LIST_DIR 显示当前工作空间文件 |
| 粘贴图片传给 Agent | 粘贴的 dataURL 未随 message 发送 | 【P3-3b】sendMessage 时附带 uploadedFiles 到 IPC context |
| 消息高亮搜索 | 搜索框目前只 toggle，无高亮逻辑 | 【P3-3c】messages.filter + 高亮匹配文本的 CSS |
| 历史提问 | 历史按钮显示之前的 prompt 列表 | 【P3-3d】`HistoryPrompt` 组件，从 messages 提取 user 消息 |

## 文件清单

```
src/components/ChatPanel.tsx       - 对话主体
src/components/UploadZone.tsx      - 拖拽/粘贴/@引用
src/components/ModeSwitch.tsx      - 模式切换
src/components/ModelSelector.tsx   - 模型选择
src/components/WelcomeScreen.tsx   - 空状态
```
