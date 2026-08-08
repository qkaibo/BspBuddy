# Component: ModeSwitch

> 状态: confirmed

## 概述
工作模式切换按钮组，支持 4 种模式：问一问(ask)、做一做(craft)、想一想(plan)、设计(design)。显示在 ChatPanel 输入区上方。

## 所属视图
chat — `ChatPanel.tsx` 输入区第一行

## Props 接口

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| mode | `AgentMode` | 是 | — | 当前活跃模式 |
| onChange | `(mode: AgentMode) => void` | 是 | — | 模式切换回调 |

### AgentMode 类型

```typescript
// 定义在 src/lib/types.ts
type AgentMode = 'craft' | 'ask' | 'plan' | 'design'
```

### 模式定义（组件内部常量）

| 模式 ID | 中文标签 | 图标 | hint 提示 |
|---------|----------|------|-----------|
| `ask` | 问一问 | MessageCircle | 仅问答、咨询、建议 |
| `craft` | 做一做 | Wand2 | 直接执行任务、生成产物 |
| `plan` | 想一想 | ListChecks | 生成执行计划，确认后执行 |
| `design` | 设计 | Palette | Ardot 画布生成设计稿 |

## 渲染结构

- `Container (flex, gap:4px, bg-input, borderRadius:8px)`
  - `Mode 按钮 (循环: MODES.map)`
    - `图标 (14px) + 中文标签`
    - `激活态 (条件: mode === m.id)`
      - `白色背景 + accent 文字色 + 阴影 + 加粗`
    - `非激活态 (条件: mode !== m.id)`
      - `透明背景 + text-secondary 文字色`
    - `title 属性: hint 提示文字`

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| ask-active | `mode === 'ask'` | "问一问" 按钮高亮（白色背景+蓝色文字+阴影） |
| craft-active | `mode === 'craft'` | "做一做" 按钮高亮 |
| plan-active | `mode === 'plan'` | "想一想" 按钮高亮 |
| design-active | `mode === 'design'` | "设计" 按钮高亮 |

## 交互行为

- 点击任一模式按钮 → 调用 `onChange(m.id)`，触发父组件模式切换
- 父组件 `ChatPanel` 通过 `onModeChange` prop 将模式变化传给 App，App 调用 `useAgent().setMode()`
- 模式切换后，ChatPanel 的 placeholder 文字随之变化
- 模式切换后，ChatPanel 底部的提示文字随之变化（ask: "Answers for reference only"，其他: "WorkBuddy may make mistakes"）

## IPC 依赖

无。ModeSwitch 是纯 UI 组件，仅通过 props 与父组件通信。

## 子组件依赖

无。

## 注意事项

1. **[实现差异] design 模式**: SPEC 的 `ui-layout.md` 只描述 3 种模式（Ask/Craft/Plan），代码实际有 4 种（加入了 `design` 模式）。`design` 模式对应 Ardot 设计创意画布功能，但在 ChatPanel 的 placeholder 和底部提示中没有为 design 模式添加专门文案。
2. **[实现差异] 模式值类型**: `AgentMode` 定义在 `types.ts` 中包含 `'design'`，但 ChatPanel 的 placeholder 逻辑只处理了 ask/craft/plan 三种（第 178 行 `mode === 'ask' ? ... : mode === 'plan' ? ... : ...`），design 模式会 fallback 到 craft 的提示文案。
3. **模式行为由 Agent 决定**: ModeSwitch 本身只负责 UI 切换，实际的行为差异（ask 只读、craft 可写、plan 先生成计划）由后端 `ai.ts` + `ipc-handlers.ts` 根据 `mode` 参数实现不同处理逻辑。
4. **设计模式导航**: 用户需要通过侧边栏点击 "Design" 入口进入 DesignCreativeTab，但 ChatPanel 的 ModeSwitch 中也存在 design 按钮。这两个入口的 design 功能可能不一致（ChatPanel 中的 design 模式可能未被完整实现）。
