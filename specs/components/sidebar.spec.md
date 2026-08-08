# Component: Sidebar

> 状态: **outdated**（实现未对齐截图）| 文档更新: 2026-08-04
> ⚠️ **旧的文档推测已过时。** 权威侧栏/欢迎区布局以截图确认文档为准：
> **[`workbuddy-reference-layout.spec.md`](./workbuddy-reference-layout.spec.md)**（WorkBuddy v5.3.8，2026-08-04）

## WorkBuddy 参考设计

### 权威来源（截图 confirmed）

完整结构见 [`workbuddy-reference-layout.spec.md`](./workbuddy-reference-layout.spec.md)。截图侧栏与下方「旧推测」的关键差异：

| # | 旧文档推测（已过时） | 截图确认 |
|---|---------------------|----------|
| 1 | 主导航在侧栏**底部**（插件/专家/连接器/项目） | PrimaryNav 在**任务列表上方** |
| 2 | 「任务 / 空间」**互斥双 Tab** | **双折叠 Section**，任务与空间同时可见 |
| 3 | 专家、技能、连接器**分散入口** | 单行合并：**专家·技能·连接器** |
| 4 | 「更多」展开邮箱等 | 「更多」+ 同行灰字 **资料库·灵感** |
| 5 | 常驻搜索框 + 状态下拉 | Header 仅 **折叠 / 搜索 / 筛选图标** |
| 6 | 任务项强制状态文字标签 | 标题 + 相对时间；偶发色点，无强制状态字 |

### 旧文档推测（已过时 — 勿再作为实现对齐目标）

> 来源曾为：`specs/Quickstart.md` L40-53, `specs/Task-Management.md` L12-16

WorkBuddy 侧边栏结构（**文字推断，已被截图纠正**）：
- **顶部**：新建任务按钮
- **双 Tab**：任务 / 空间
- **搜索框**：搜索任务
- **任务列表**：按工作空间/文件夹分组
- **底部**：用户头像（来源：`Quickstart.md` L48）

## 当前 BspBuddy 实现 vs 截图参考差异

| 差异 | 截图（权威） | BspBuddy 当前 | 严重性 |
|------|-------------|---------------|--------|
| 主导航位置与文案 | 上方：新建/助理/项目/专家·技能·连接器/自动化/更多 | 底部：插件/专家/连接器/项目/更多→邮箱 | 🔴 未对齐 |
| 任务/空间 | 双折叠同时可见 | 互斥 Tab | 🔴 未对齐 |
| 底部用户头像 | 头像+显示名 \| Bell \| Link | 头像 + 弹出菜单；铃铛在头部且 disabled | 🟡 部分 |
| 显式 Chat 入口 | 截图欢迎态无独立 Chat 项 | 只能点任务回聊天 | 🟡 待确认 |

## 概述
左侧导航栏，提供任务列表、空间分组、状态筛选、功能导航入口和用户头像区。支持折叠/展开。

## 所属视图
全局 — 始终在 App 根布局左侧渲染

## Props 接口

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| sessions | `Session[]` | 是 | — | 所有会话列表 |
| onNewSession | `() => void` | 是 | — | 新建任务回调 |
| onSelectSession | `(id: string) => void` | 是 | — | 选中会话回调 |
| collapsed | `boolean` | 是 | — | 是否折叠为窄图标栏 |
| activeView | `ViewType`（见下方） | 否 | `'chat'` | 当前活跃视图，用于高亮侧边栏导航 |
| onNavigate | `(view: ViewType) => void` | 否 | — | 切换到指定视图 |

### ViewType（Sidebar 本地定义）

```typescript
type ViewType = 'chat' | 'plugins' | 'experts' | 'connectors' | 'projects' |
               'mailbox' | 'activate-mailbox' | 'settings' | 'pricing' | 'data' |
               'memory' | 'cloud-agent'
```

### Session 类型（本地定义）

| 属性 | 类型 | 说明 |
|------|------|------|
| id | `string` | 会话唯一标识 |
| title | `string` | 会话标题 |
| date | `string` | 最后活跃日期 |
| active | `boolean` | 是否当前活跃 |
| workspace | `string?` | 所属工作空间 |
| status | `'in_progress' \| 'completed' \| 'failed' \| 'pending' \| 'planning' \| 'archived'`? | 任务状态，默认视为 `'pending'` |

## 渲染结构

- `Container (flex col, h-full, bg-sidebar, 240px / 52px 过渡)`
  - `头部区 (borderBottom, flex row)`
    - `通知铃铛 (Bell 图标, disabled, 条件: 始终可见)`
    - `新建任务按钮 (accent 蓝色背景, Plus 图标 + "新建任务", 条件: 始终可见)`
  - `Tab 切换 (条件: !collapsed)`
    - `"任务" 按钮 (LayoutDashboard 图标)`
    - `"空间" 按钮 (FolderOpen 图标)`
  - `搜索 + 筛选区 (条件: !collapsed)`
    - `搜索框: Search 图标 + input (placeholder: "搜索任务...")`
    - `状态筛选下拉 (select, 7 个选项): 全部 / 进行中 / 已完成 / 失败 / 待处理 / 规划中 / 已归档`
  - `内容区 (flex:1, overflow:auto)`
    - `任务列表 (条件: activeTab === 'tasks')`
      - `Session 条目 (循环: filtered.map)`
        - `MessageSquare 图标`
        - `标题 + 日期 + 状态圆点 + 状态标签 (条件: !collapsed)`
        - `状态颜色: 进行中=蓝 / 已完成=绿 / 失败=红 / 待处理=黄 / 规划中=紫 / 已归档=灰`
    - `空间分组 (条件: activeTab === 'spaces')`
      - `分组标题 (循环: workspaceGroups)`
        - `FolderOpen 图标 + 空间名`
        - `任务条目 (循环: wsSessions.map)`
  - `右键菜单 (条件: contextMenu !== null, fixed 定位, 7 项)`
    - `置顶 (Pin) / 打开文件夹 (FolderOpen) / 重命名 (Edit3) / 保存到工作空间 (Download) / 分享 (Share2) / 删除 (Trash2, danger) / 归档 (Archive)`
  - `导航区 (borderTop)`
    - `主导航按钮 (4 个)`
      - `插件 (Puzzle) / 专家 (Users) / 连接器 (Link) / 项目 (Building2)`
      - `图标 + 文字 (条件: !collapsed)`
      - `高亮 (条件: isNavActive(item.id))`
    - `"更多▾" 下拉 (MoreHorizontal 图标 + ChevronDown)`
      - `展开 → "我的邮箱" (mailbox)`
      - `折叠状态: 直接跳转 mailbox`
  - `底部区 (borderTop, 条件: 始终可见)`
    - `用户头像按钮 (圆形, accent 背景, "U" 文字 + "User" 标签)`
    - `头像弹出菜单 (条件: avatarMenuOpen, 从底部向上弹出)`
      - `设置 / 记忆 / 定价 / 数据管理`
      - `点击任意项 → onNavigate(id) + 关闭菜单`

## 6 种任务状态

| status | 标签 | 颜色 |
|--------|------|------|
| `in_progress` | 进行中 | #3b82f6 (蓝) |
| `completed` | 已完成 | #22c55e (绿) |
| `failed` | 失败 | #ef4444 (红) |
| `pending` | 待处理 | #f59e0b (黄) |
| `planning` | 规划中 | #a855f7 (紫) |
| `archived` | 已归档 | #6b7280 (灰) |

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| default | 正常渲染 | 完整侧边栏，当前任务高亮 |
| collapsed | `collapsed === true` | 52px 窄栏，仅图标，无文字，铃铛/新建/导航/头像仍可见 |
| empty | `sessions` 为空或 filtered 后为空 | 内容区空白，无任务卡片 |
| tabs-switched | `activeTab === 'spaces'` | 按工作空间分组显示 |
| context-menu | 右键点击任务卡片 | fixed 定位浮层菜单（7 项） |
| avatar-menu | 点击用户头像 | 底部向上弹出菜单（4 项） |
| more-expanded | 点击"更多▾" | 展开显示"我的邮箱"子项 |

## 交互行为

- 点击"新建任务"按钮 → 调用 `onNewSession()`，App 内重置 state 并切换到 chat
- 点击任务条目 → 调用 `onSelectSession(id)`，加载该会话的 messages/plan/workspace
- 右键任务条目 → 显示上下文菜单（置顶/打开文件夹/重命名/保存到工作空间/分享/删除/归档）
- 选择重命名 → `prompt('新名称：')`，获取新名称后仅关闭菜单，**无持久化操作** [实现差异：handleRename 为 no-op]
- 选择删除 → 调用 `closeContextMenu()`，但 **无实际删除逻辑** [实现差异]
- 选择置顶/打开文件夹/保存到工作空间/分享/归档 → 仅关闭菜单，无实际功能 [实现差异]
- 点击 Tab "任务"/"空间" → 切换 `activeTab` 状态
- 输入搜索词 → 实时过滤 `sessions.filter(title.includes(search))`
- 选择状态筛选 → 按 status 字段过滤，默认 `'all'` 不筛选
- 点击主导航入口 → 调用 `onNavigate(item.id)`，App 内设置 `activeView`
- 点击"更多▾" → 展开/收起"我的邮箱"子入口
- 折叠状态下点击"更多"图标 → 直接导航到 mailbox
- 点击用户头像 → 弹出菜单（设置/记忆/定价/数据管理）
- 点击顶部汉堡按钮 ☰（在 App.tsx 顶栏）→ 切换 `collapsed` 状态

## IPC 依赖

侧边栏本身不直接调用 IPC。会话数据通过父组件 App 传入：
| Channel | 方向 | 用途 |
|---------|------|------|
| SESSION_LIST | renderer → main | App 启动时加载会话列表 |
| SESSION_LOAD | renderer → main | 点击任务时加载会话数据 |
| SESSION_SAVE | renderer → main | 自动保存（在 App.tsx useEffect 中） |
| SESSION_DELETE | renderer → main | 删除会话（计划中，handleDelete 未调用） |

## 子组件依赖

无外部子组件依赖。Sidebar 内部自行管理所有 UI（搜索、筛选、导航、上下文菜单、头像菜单）。

## 注意事项

1. **[实现差异] 重命名/删除/右键菜单项为 no-op**: `handleRename` 仅调用 `prompt()` 获取新名称，未调用 IPC 持久化；其余右键菜单项（置顶/打开文件夹/保存到工作空间/分享/删除/归档）均仅关闭菜单，无实际功能逻辑
2. **[实现差异] 无 Chat 显式导航入口**: 用户只能通过点击任务回到聊天视图，侧边栏导航列表中没有独立的 "Chat" 入口
3. **[实现差异] 通知铃铛禁用**: Bell 图标为 `disabled` 状态（opacity: 0.5, cursor: default），通知功能暂未实现
4. **状态筛选下拉**: 搜索框下方新增 `select` 下拉，支持按 6 种任务状态过滤任务列表
5. **功能导航精简**: 主要功能入口 4 个（插件/专家/连接器/项目），邮箱通过"更多▾"展开访问，技能和 MCP 已移入 PluginPanel 内部子 Tab
6. **底部为用户头像区**: 点击头像弹出菜单，可导航至设置/记忆/定价/数据管理，不再展示 CreditDisplay、版本号或设置/数据按钮行
