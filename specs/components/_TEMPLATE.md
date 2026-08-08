# Component: <组件名>

> 状态: draft | confirmed | implemented | outdated

## 概述
一句话描述。

## 所属视图
属于哪个视图/页面（sidebar / chat / result-panel / settings / ...）

## Props 接口

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|

事件的回调类型也要写清楚（如 `onSend: (text: string) => void`）

## 渲染结构

用缩进文本树描述 DOM 结构，标注条件渲染和循环：
- `Container (flex col, h-full)`
  - `Header (条件: 有 title 时渲染)`
    - `Title: {title}`
  - `Body`
    - `List`
      - `Item (循环: items.map)`
        - `Icon`
        - `Label: {item.label}`

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| default | 正常渲染 | ... |
| loading | 数据加载中 | Spinner/骨架屏 |
| empty | 数据为空 | "暂无数据" 提示 |
| error | 出错 | 错误消息 + 重试按钮 |

## 交互行为

每条用 `- 触发条件 → 响应行为` 格式
- 点击"新建任务"按钮 → 调用 onNewSession()，切换到 chat 视图
- Ctrl+Enter → 发送消息

## IPC 依赖

列出组件通过 `createIpcClient()` 调用的 IPC channels 及用途：
| Channel | 方向 | 用途 |
|---------|------|------|

## 子组件依赖

| 组件 | 用途 |
|------|------|

## 注意事项
设计约束、已知坑、待定决策等。
