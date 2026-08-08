# Component: WorkBuddy Reference Layout（整屏参考布局）

> 状态: **confirmed**（截图确认）
> 优先级: **高于**旧文档推测（Task-Management / Quickstart / ui-layout 旧 ASCII 等）
> 记录日期: 2026-08-04
> 参考产品版本: WorkBuddy **v5.3.8**
> 截图来源:
> `C:\Users\qkaib\.cursor\projects\d-work-BspBuddy\assets\c__Users_qkaib_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-d50dcc11-8a76-413a-b749-3415520df67e.png`

## 概述

基于真实 WorkBuddy 桌面端截图记录的**整屏欢迎态布局**。本文档是 BspBuddy UI 对齐的权威参考；旧 SPEC / plans 中基于文字推断的侧栏与欢迎区结构若与本文冲突，以本文为准。

**品牌约束：**
- 参考描述中的产品名可为 **WorkBuddy**（截图原样）
- BspBuddy 实现与对外文案一律使用 **BspBuddy**，包名 `bspbuddy`
- 本文描述的是参考产品 UI，**尚未在 BspBuddy 中完整实现**（待开发 / 待决策处已标注）

## 所属视图

全局欢迎态（无活跃对话消息时的主屏）— 左侧栏始终可见 + 中间欢迎/Composer 区。  
对话态、右侧结果面板等未出现在本截图中，见「截图未覆盖」章节。

---

## ASCII 整体布局图

```
┌─ 系统菜单栏: WorkBuddy | 编辑(E) | 窗口(W) | 帮助(H) ─────────────── [─ □ ×] ─┐
│                                                                              │
│  ┌─ Sidebar ─────────────┐  ┌─ Main (Welcome) ─────────────────────────────┐ │
│  │ WorkBuddy             │  │                    [🎁 做任务赢积分好礼 >]     │ │
│  │ v5.3.8   [⊏][🔍][▽]   │  │                                              │ │
│  │                       │  │              WorkBuddy, 我帮你                │ │
│  │ + 新建任务             │  │                                              │ │
│  │ 👤 助理               │  │     [日常办公] [<> 代码开发] [🎨 设计创意]      │ │
│  │ ⊕  项目               │  │                                              │ │
│  │ ◎  专家·技能·连接器    │  │  📄文档处理  💰金融服务  📊数据分析及可视化    │ │
│  │ ↻  自动化             │  │  🔬深度研究  🎬视频生成  📑幻灯片  📋产品管理 │ │
│  │ ▦  更多  资料库·灵感   │  │                                              │ │
│  │                       │  │  ┌─ Composer ─────────────────────────────┐  │ │
│  │ ▼ 任务 (5)            │  │  │ [Skill 开发 ×]                          │  │ │
│  │   · 任务标题  相对时间 │  │  │                                        │  │ │
│  │   · 任务标题     ●绿  │  │  │                                        │  │ │
│  │   · ...               │  │  │ [+]          [🌐] [Hy3 ∨] [🎤] [发送] │  │ │
│  │                       │  │  └────────────────────────────────────────┘  │ │
│  │ ▼ 空间 (2)            │  │                                              │ │
│  │   ▼ 空间名            │  │     [📁 选择工作空间 ∨]  [✓ 默认权限 ∨]       │ │
│  │     · 会话  [本地] 时间│  │                                              │ │
│  │   ▼ 空间名            │  │                           ┌─ 活动浮层 ──┐    │ │
│  │     · 会话        时间 │  │                           │ 活动 ...    │    │ │
│  │                       │  │                           └─────────────┘    │ │
│  │ [头像] 显示名  [🔔][🔗]│  └──────────────────────────────────────────────┘ │
│  └───────────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**布局特征（截图确认）：**
- **两栏主结构**（欢迎态）：左侧栏 + 中间主区；本截图**无**右侧结果面板、**无** BspBuddy 式全局顶栏、**无**底部状态栏
- 系统原生菜单栏存在（macOS/Windows 菜单：`WorkBuddy` / 编辑 / 窗口 / 帮助）
- 促销入口「做任务赢积分好礼」在主区右上角（非侧栏）
- 右侧可出现「活动」浮动推广卡（营销层，非核心布局）

---

## 渲染结构

### 左侧栏完整结构树

- `Sidebar (flex col, 窄固定宽, 浅底)`
  - `Header`
    - `BrandBlock`
      - `BrandName`: `"WorkBuddy"`（实现时 → `"BspBuddy"`）
      - `Version`: `"v5.3.8"`（小号次要文字，位于品牌名下方或旁侧）
    - `HeaderActions (同行右侧)`
      - `CollapseBtn` — 侧栏折叠图标（矩形+竖条语义）
      - `SearchBtn` — 放大镜（搜索；**图标按钮**，非常驻搜索输入框）
      - `FilterBtn` — 漏斗（筛选）
  - `PrimaryNav (列表上方，垂直列表 — 非底部导航)`
    - `NavItem: "+ 新建任务"` — Plus 语义，首项，偏强调
    - `NavItem: "助理"` — 人物轮廓图标
    - `NavItem: "项目"` — 准星/目标类图标
    - `NavItem: "专家·技能·连接器"` — **单行合并入口**（分子/连接语义图标）；非三个独立导航项
    - `NavItem: "自动化"` — 循环箭头图标
    - `NavItem: "更多"` — 宫格图标；同行灰色副文案 `"资料库·灵感"`
  - `Section: 任务 (N)` — 可折叠（▼）；与「空间」**同时可见**（非互斥 Tab）
    - `SectionHeader`: `"任务 (5)"`（括号内为数量）
    - `TaskItem (循环)`
      - `Title` — 单行截断标题
      - `Meta` — 相对时间（如 `"22小时前"`）**或**偶发色点（如绿色状态点）；**无强制状态文字标签**（无「进行中」「已完成」等文案）
  - `Section: 空间 (M)` — 可折叠（▼）；与「任务」同时可见
    - `SectionHeader`: `"空间 (2)"`
    - `SpaceGroup (循环, 可展开)`
      - `SpaceName` + 文件夹/空间图标 + chevron
      - `SessionItem (循环, 缩进二级)`
        - `SessionTitle`
        - 可选徽章 `"本地"`（灰色 pill）
        - `RelativeTime`
  - `Footer`
    - `Avatar` (圆形) + `DisplayName`
    - `FooterActions`: `Bell`（通知）| `Link`（链接/分享类图标）

### 中间欢迎区完整结构树

- `WelcomeMain (flex col, 居中偏上)`
  - `TopRightPromo` (绝对/右上)
    - 文案: `"做任务赢积分好礼"` + 礼盒图标 + `>` 指示
  - `HeroTitle`: `"WorkBuddy, 我帮你"`（实现时 → `"BspBuddy, 我帮你"`）
  - `SceneTabs (pill 组)`
    - `"日常办公"` — 当前选中（深色底）
    - `"代码开发"` — `<>` 代码图标
    - `"设计创意"` — 调色盘图标
  - `SkillIconRow (横向图标+标签)`
    - `文档处理` / `金融服务` / `数据分析及可视化` / `深度研究` / `视频生成` / `幻灯片` / `产品管理`
  - `Composer (大圆角内嵌可发送区)`
    - `SkillChip` (可选): 例 `"Skill 开发"` + 关闭 `×`（绿色/强调色 chip）
    - `Textarea` — 主输入空白区
    - `ComposerToolbar (底部行)`
      - 左: `[+]` 附件/添加工具
      - 右: `Globe`（网络/浏览语义）| `ModelSelector`（例 `"Hy3 ∨"`）| `Mic` | `Send`（深色圆形发送）
  - `BelowComposer (下拉组)`
    - `"选择工作空间"` — 文件夹图标 + 下拉
    - `"默认权限"` — 勾选图标 + 下拉
  - `ActivityCard` (可选浮层, 右侧) — 标题「活动」+ 推广内容 +「查看详情」；营销层，非核心交互

---

## Props 接口

整屏参考布局，不强制绑定单一 React Props。实现对齐时建议拆分为：

| 区域 | 建议组件 | 关键数据 |
|------|----------|----------|
| Sidebar Header | `SidebarHeader` | brand, version, collapsed |
| PrimaryNav | `SidebarNav` | items[], activeId |
| 任务/空间 | `TaskSection` / `SpaceSection` | tasks[], spaces[]（树） |
| Footer | `SidebarFooter` | avatar, displayName |
| Welcome | `WelcomeScreen` | scene, skills[], skillChip? |
| Composer | `WelcomeComposer` | modelId, workspace?, permissionMode |

事件回调（建议）：
- `onNewTask()` / `onNavigate(navId)` / `onSelectTask(id)` / `onToggleSpace(id)` / `onSelectSession(id)`
- `onSceneChange(scene)` / `onSkillClick(skillId)` / `onSend(text)` / `onSelectWorkspace()` / `onSelectPermission()`

---

## 视觉状态

| 状态 | 触发条件 | 预期渲染 |
|------|----------|----------|
| welcome-default | 无活跃对话 / 新建任务后空态 | 侧栏 + 欢迎标题 + SceneTabs + SkillRow + Composer |
| scene-active | 某 SceneTab 选中 | 对应 pill 深色高亮；SkillRow 可能随场景变化（**待确认**：截图仅见「日常办公」） |
| task-section-collapsed | 折叠「任务」 | 仅保留 `▼ 任务 (N)` 标题行 |
| space-section-collapsed | 折叠「空间」 | 仅保留标题行 |
| space-group-expanded | 展开某空间 | 显示二级 SessionItem |
| task-with-dot | 任务带色点 | 显示色点，可不显示相对时间（截图中偶发） |
| session-local | 会话为本地 | 显示灰色「本地」徽章 |
| promo-visible | 运营活动开启 | 右上积分入口 +/或右侧活动浮卡 |
| sidebar-collapsed | 点击折叠 | 窄栏形态（**细节待截图补充**） |

---

## 交互行为

### 左侧栏

- 点击「+ 新建任务」→ 进入/重置欢迎 Composer 态（与新建会话等价，**实现待对齐**）
- 点击「助理」/「项目」/「专家·技能·连接器」/「自动化」/「更多」→ 进入对应功能视图（**目标页结构待决策 / 待截图**）
- 「专家·技能·连接器」为**单一入口**，不是三个并列 NavItem
- 「更多」同行副文案「资料库·灵感」为入口提示；点击「更多」后的展开内容**截图未展示**（待确认）
- 点击 Header 搜索图标 → 打开搜索（形态：浮层/替换列表 — **待确认**）
- 点击 Header 筛选图标 → 打开筛选（**待确认**；旧文档中的常驻状态 select **不符合截图**）
- 点击「任务 (N)」标题 → 折叠/展开任务列表
- 点击「空间 (M)」标题 → 折叠/展开空间树
- 点击任务项 → 打开该任务对话（**对话态 UI 本截图未覆盖**）
- 点击空间下会话 → 打开该会话
- 点击折叠按钮 → 折叠侧栏
- 点击 Footer 铃铛 / 链接图标 → 通知 / 链接相关能力（**待开发**）
- 点击头像/显示名 → 账户/设置类菜单（**菜单项截图未展示，待确认**）

### 中间欢迎区

- 切换 SceneTabs → 切换场景（影响下方技能推荐，**待确认**）
- 点击 SkillIconRow 项 → 选中/预填技能（可能在 Composer 内出现 SkillChip）
- 关闭 SkillChip `×` → 移除已选技能
- Composer 内发送 → 创建任务并进入对话（**待实现对齐**）
- `[+]` → 附件或添加工具（**待确认**）
- Globe / 模型下拉 / 麦克风 → 浏览模式？/ 选模型 / 语音输入（**Globe 语义待确认**）
- 「选择工作空间」「默认权限」→ 下拉选择（权限 UI 符合「输入框下方下拉」产品约束）
- 「做任务赢积分好礼」→ 运营/积分活动页（**可选，非 P0**）

---

## 对照表：旧文档推测 vs 截图 vs 当前 BspBuddy

| 维度 | 旧文档推测（Task-Management / Quickstart / ui-layout） | 截图确认（本文） | 当前 BspBuddy 实现 | 对齐状态 |
|------|------------------------------------------------------|------------------|-------------------|----------|
| 侧栏主导航位置 | 底部导航区（插件/专家/连接器/项目） | **列表上方** PrimaryNav | 底部导航 4 项 + 更多 | ❌ 未对齐 |
| 任务 / 空间 | **互斥双 Tab** | **双折叠 Section，同时可见** | 互斥 Tab | ❌ 未对齐 |
| 专家/技能/连接器 | 分离入口（专家、插件含技能、连接器） | **单行「专家·技能·连接器」** | 分离：插件/专家/连接器 | ❌ 未对齐 |
| 「更多」 | 展开「我的邮箱」 | 「更多」+ 副文案「资料库·灵感」 | 更多 → 邮箱 | ❌ 未对齐 |
| 新建任务 | 顶部按钮 | PrimaryNav 首项「+ 新建任务」 | 头部 accent 按钮 + 铃铛同行 | 🟡 部分 |
| 搜索/筛选 | 常驻搜索框 + 状态下拉 | Header **图标按钮** | 常驻搜索 + 状态 select | ❌ 未对齐 |
| 任务条目 | 标题+时间+状态文字标签 | 标题+相对时间；偶发色点；**无强制状态字** | 状态圆点+状态标签 | ❌ 未对齐 |
| 空间结构 | Tab 切换后分组 | 二级树 空间→会话；可有「本地」 | 空间 Tab 内分组 | 🟡 部分 |
| 品牌/版本 | 未强调侧栏版本 | Header：品牌 + **v5.3.8** | 底部状态栏版本等 | ❌ 未对齐 |
| Footer | 头像；铃铛位置不一 | 头像+显示名 \| Bell \| Link | 头像+菜单；铃铛在头部且 disabled | 🟡 部分 |
| 欢迎标题 | 未统一 | 「WorkBuddy, 我帮你」 | BspBuddy WelcomeScreen（结构不同） | ❌ 未对齐 |
| SceneTabs | 文档未强调三场景 pill | 日常办公 / 代码开发 / 设计创意 | 未按截图实现 | ❌ 未对齐 |
| Skill 图标行 | 未按截图列出 | 7 个技能快捷入口 | 未按截图实现 | ❌ 未对齐 |
| Composer | 对话区底部输入 | 欢迎区内嵌可发送 Composer | 有 Welcome/Chat 输入，控件布局不同 | 🟡 部分 |
| 工作空间/权限 | 输入区附近 | Composer **下方**两下拉 | 位置/文案不完全一致 | 🟡 部分 |
| 全局顶栏 | 旧文称「无全局顶栏」 | 欢迎态确无 BspBuddy 式顶栏；有系统菜单 + 右上促销 | 有 44px 全局顶栏 | ❌ 未对齐 |
| 底部状态栏 | 旧文称无 | 截图无 | 有 26px 状态栏 | ❌ 未对齐 |

---

## IPC 依赖

参考布局级文档，不绑定具体 channel。实现对齐时复用现有会话/工作空间/权限相关 IPC；新增导航目标（助理、自动化、资料库、灵感等）的 channel **待决策**。

| 领域 | 方向 | 说明 |
|------|------|------|
| 会话列表 / 加载 | renderer ↔ main | 任务 Section、空间树 |
| 工作空间选择 | renderer ↔ main | Composer 下方「选择工作空间」 |
| 权限模式 | renderer ↔ main | 「默认权限」下拉（见权限 plan） |
| 通知 / 链接 | — | Footer 图标；**尚未开发** |

## 子组件依赖（建议拆分）

| 组件 | 用途 | 状态 |
|------|------|------|
| SidebarHeader | 品牌+版本+折叠/搜索/筛选 | 待开发（对齐截图） |
| SidebarPrimaryNav | 上方主导航 | 待开发 |
| TaskSection | 可折叠任务列表 | 待开发（替换互斥 Tab） |
| SpaceSection | 可折叠空间树 | 待开发 |
| SidebarFooter | 头像+Bell+Link | 待对齐 |
| WelcomeHero | 标题+SceneTabs+SkillRow | 待对齐 |
| WelcomeComposer | SkillChip+输入+工具条 | 待对齐 |
| WorkspacePermissionBar | 工作空间/权限下拉 | 待对齐 |

## 截图未覆盖（勿当作已确认）

以下内容**不在**本截图中，不得用旧文档臆测覆盖权威结论，需另截图或标待确认：

1. 对话进行中的中间区（消息列表、时间线、停止按钮）
2. 右侧结果面板（概览/浏览器/变更/产物）是否出现及 Tab 文案
3. 侧栏完全折叠后的窄栏形态
4. 「更多」「助理」「专家·技能·连接器」等点击后的目标页
5. 搜索/筛选弹出 UI 的具体形态
6. 头像菜单完整菜单项
7. 深色主题 / 窄窗口响应式

## 注意事项

1. **权威性**：截图 > 旧 docs 文字推断。`sidebar.spec.md` / `app-layout.spec.md` / `ui-layout.md` 中旧「双 Tab + 底导航」描述已过时，仅作历史对照。
2. **实现品牌**：UI 文案与品牌位用 **BspBuddy**；版本号展示策略待决策（是否仿照侧栏 `vX.Y.Z`）。
3. **不要把本文标成已实现**：BspBuddy 当前代码仍接近旧推测结构；对齐工作单独排期。
4. **运营浮层**（积分好礼、活动卡）可后置，不阻塞核心布局对齐。
5. **权限下拉位置**与产品硬约束一致：输入框下方，不要做成独立设置页。
