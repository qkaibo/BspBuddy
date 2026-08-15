---
name: BspBuddy
description: 浅色、冷静的桌面 AI 工程工作台视觉系统
colors:
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
  accent-light: "#eff6ff"
  accent-border: "#bfdbfe"
  bg-root: "#f5f7fa"
  bg-card: "#ffffff"
  bg-sidebar: "#f0f3f8"
  bg-input: "#f2f4f8"
  bg-hover: "#e8eef8"
  bg-active: "#e8f1ff"
  border: "#e2e8f0"
  border-subtle: "#eef1f6"
  text-primary: "#101010"
  text-secondary: "#5c6370"
  text-tertiary: "#8b93a1"
  success: "#16a34a"
  success-bg: "#f0fdf4"
  warning: "#d97706"
  warning-bg: "#fef9c3"
  danger: "#dc2626"
  danger-bg: "#fef2f2"
  purple: "#475569"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  panel: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "7px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  button-scene-active:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.bg-root}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  input-field:
    backgroundColor: "{colors.bg-input}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  card-surface:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "14px"
  chip-status:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "3px"
    padding: "1px 4px"
  nav-item-active:
    backgroundColor: "{colors.bg-hover}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
---

# Design System: BspBuddy

## Overview

**Creative North Star: "冷静工程台面"（The Cool Engineering Console）**

BspBuddy 的现行界面是一套偏 macOS / 系统 UI 气质的浅色桌面工作台：大面积冷灰纸面、白色卡片、克制品牌蓝点缀。它服务「操作（Operate）」模式——工程师要快速扫读侧栏、在欢迎态直接开写、在面板里完成选择再回到对话，而不是营销落地页式的戏剧构图。

密度偏紧凑：正文多在 11–13px，控件圆角柔和但不夸张，阴影极轻，靠边框与色阶分层。图标统一用 Lucide 线型图标。品牌名 **BspBuddy** 出现在欢迎态主标题等关键位置，禁止再写成 WorkBuddy。

### OS 窗口铬

- **Windows / Linux：** 窗口最顶一行同时放置 **品牌标 + BspBuddy** 与 **File / Edit / View / Window / Help**（自定义 `.bb-titlebar` + `titleBarStyle: 'hidden'` + `titleBarOverlay`）。不要拆成「标题栏 + 下方原生菜单栏」两行。
- **macOS：** 系统菜单栏承载 File 等；窗口内可不重复同一套菜单（可用 `hiddenInset`）。

质性描述依据 `src/renderer/index.css` 与主流面板组件（WelcomeScreen、Sidebar、Expert*、ResourceCard 等）推断；`src/index.css` 的暗色 HSL 变量体系视为遗留/旁路入口，**新 UI 以 renderer 浅色令牌为准**。配色对齐 taste-skill-zh：≤3 色、禁蓝紫渐变与高饱和「糖果」语义色。

**Key Characteristics:**
- 浅色冷灰根底 + 白卡片分层
- 单一主强调色 Tailwind 蓝 `#2563eb`（稀缺使用；分层可借鉴冰蓝浅底）
- SF Pro / PingFang 优先的系统字体栈
- 氛围底：多层冷灰蓝微渐变 + 极轻纸纹；侧栏半透明磨砂
- 主内容偏白纸；折叠侧栏为图标轨；列表卡片化 + 悬浮 Composer
- 分区靠色差/轻阴影，少用实线；导航与技能统一 icon tile（stroke 1.75）
- 欢迎态与 Composer 同屏一体；二级面板先闭环再堆后台

## Colors

整体是冷中性纸面，用一枚克制品牌蓝作行动与选中信号；成功/警告/危险走低饱和语义色，并配浅底色标签。禁止蓝紫渐变与高饱和「糖果色」铺陈。

### Primary
- **Tailwind 蓝** (`#2563eb` / `accent`)：主按钮、选中 Tab、强调图标、焦点环。应保持稀缺，不要铺满背景。
- **冰蓝浅底** (`#eff6ff` / `accent-light`，选中条 `#e8f1ff` / `bg-active`)：列表选中、芯片、轻量高亮；用色块分层代替粗分割线。

### Secondary
- **辅灰蓝** (`#475569` / `purple` 令牌名遗留)：次要品类/图标点缀，不作全局主色；不再使用粉紫 `#af52de`。
- 欢迎态技能行另有局部语义色仅用于图标块，**不升格为系统主色板**。

### Neutral
- **根底冷灰** (`#f5f5f7` / `bg-root`)：应用画布背景。
- **侧栏雾灰** (`#f0f0f2` / `bg-sidebar`)：侧栏与编辑器左轨。
- **卡片白** (`#ffffff` / `bg-card`)：面板顶栏、列表卡片、浮层。
- **输入雾灰** (`#f3f3f5` / `bg-input`)：输入框、内嵌区块底。
- **悬停灰** (`#ebebed` / `bg-hover`)：列表/导航悬停与选中底。
- **分割线灰** (`#e0e0e2` / `border`)：边框与滚动条拇指。
- **主文近黑** (`#1a1a1a` / `text-primary`)：标题与主文案。
- **次文中灰** (`#5a5a5e` / `text-secondary`)：说明、未选中导航。
- **辅文浅灰** (`#999999` / `text-tertiary`)：元数据、空态提示、关闭图标。

### Semantic
- **成功绿** (`#16a34a` + `#f0fdf4`)：已启用/已发布状态芯片。
- **警告橙** (`#d97706` + `#fef9c3`)：草稿、自定义、提醒。
- **危险红** (`#dc2626` + `#fef2f2`)：错误与破坏性提示。

### Named Rules
**The One Accent Rule.** 主强调色只承担「行动 / 选中 / 焦点」；大面积背景永远用中性灰阶，禁止把品牌蓝当整页铺底。

**The Token Source Rule.** 新组件优先 `var(--*)`（`src/renderer/index.css`）。不要为新屏另起一套色板；遗留暗色 `src/index.css` 不作为扩展依据。

## Typography

**Display Font:** 系统无衬线（-apple-system / Segoe UI / PingFang SC / Microsoft YaHei）
**Body Font:** 同上
**Label/Mono Font:** 无独立 mono 令牌；代码/差异视图可沿用系统等宽，但不构成品牌字体配对

**Character:** 工程工具气质——清晰、偏紧、无装饰字体表演。中文与西文共用系统栈，保证桌面端可读。

### Hierarchy
- **Display** (700, 26px, letter-spacing -0.5px)：欢迎态主标题「BspBuddy, …」。
- **Title** (600, 13–14px)：面板标题、分区标题、专家名。
- **Body** (400, 12px)：列表说明、表单正文。
- **Label** (400–600, 10–11px)：芯片、元数据、侧栏分组标签、次要按钮。
- **Micro** (400, 9–10px)：状态 pill、能力计数等极紧信息。

### Named Rules
**The Compact UI Type Rule.** 工作台默认偏小字号（11–13px）；不要为了「好看」把面板正文抬到营销页字号，除非是欢迎态 Display。

## Layout

桌面壳层：左侧可折叠 Sidebar + 主内容区（对话 / 欢迎态 / 面板）。

- **折叠侧栏**：仅图标轨（约 `56px`），`.bb-nav-rail`。
- **展开侧栏**：约 `268px`；主导航 + 紧凑任务/空间列表共处一栏（工作台密度，不是松散营销列表）。
- **主内容**：偏白纸（`#ffffff` / `.bb-main-canvas`）；氛围渐变留给壳层与侧栏。
- **欢迎态**：内容列约 `max-width: 720px` 居中；技能行用 `.bb-icon-tile`；Composer 用 `.bb-composer-float`。
- **面板**：优先 `PanelChrome`（`.bb-panel*`）；**标题与分区 Tab 同一行**（左标题 / 中 Tab / 右关闭），勿再拆成「标题一行 + Tab 一行」；顶栏用轻阴影色阶分区，少用 1px 实线。

节奏刻度：`4 / 8 / 12 / 16 / 24`。主内容区段落/区块可 16–24；侧栏列表行保持紧凑（任务行约 `32px` 量级），避免「加几条任务就撑满屏」。

### Named Rules
**The Conversation Hub Rule.** 布局始终能回到对话/Composer；二级面板是「滑入完成任务」而不是独立网站信息架构。

**The Compact Sidebar Rule.** 侧栏为扫读面：导航与任务行宜矮、间距宜小；不要把侧栏列表做成大卡片堆。

## Elevation & Depth

以**背景色差 + 轻阴影**分区为主，1px 实线为辅。面板顶栏（含同行 Tab）、侧栏分段优先 `box-shadow: 0 1px 0 rgba(15,23,42,.04)` 一类弱分隔，少用粗硬 `border`。

### Shadow Vocabulary
- **ambient-sm** (`0 1px 3px rgba(0,0,0,.06)`)：轻浮起、小控件。
- **ambient-md** (`0 4px 16px rgba(0,0,0,.08)`)：下拉菜单、中型浮层。
- **ambient-lg** (`0 8px 32px rgba(0,0,0,.1)`)：模态/大浮层。
- **composer-float**：圆角 + `shadow-md` + 底边留白（`.bb-composer-dock` / `.bb-composer-float`），勿贴死底边整条。

### Named Rules
**The Flat-By-Default Rule.** 静止表面默认无重阴影；需要分层时先加背景阶 / 弱分隔，再考虑 shadow-sm/md。

## Shapes

圆角偏「软工具」：控件常用 `6px`，卡片 `8px`（令牌 `radius-md`），大容器约 `12–14px`，场景 Tab 用胶囊 `20px`。边框 1px；面板内部分割优先 `border-subtle`。状态点、小 pill 可用全圆或 `3px` 微圆角。图标容器常见 `8px` 方圆。共用 `.bb-*` 原语（`PanelChrome` / `bb-list-card` / `bb-input`）保持面板一致。

### Named Rules
**The Soft Tool Radius Rule.** 优先 6–12px；避免突然出现尖锐 0 圆角或超大 9999 圆角组件簇（胶囊仅限场景 Tab 等明确控件）。

## Components

### Buttons
- **Shape:** 主/次按钮约 `6px`；场景 Tab 胶囊 `20px`。
- **Primary:** 背景 `accent`，白字，约 `7px 16px`，字号 ~12。
- **Secondary / Ghost:** 白/透明底 + `1px border`，次文色；取消类操作用此级。
- **Scene active:** 近黑底 + 根底色字（反相），不是用 accent 铺满。
- **Hover / Focus:** 过渡约 `.15–.2s`；导航选中用底边 `2px accent` 或左侧指示条。

### Chips
- **Style:** 极小字号（9–11px），语义色底 + 语义色字（success/warning 等）。
- **State:** 资源状态（已启用/草稿/已停用）必须可读，禁止只显示 raw ID。

### Cards / Containers
- **Corner Style:** 约 `10–12px`。
- **Background:** `bg-card` 或列表内 `bg-input`。
- **Shadow Strategy:** 多数靠 border；菜单用 shadow-md。
- **Border:** `1px solid var(--border)`。
- **Internal Padding:** 列表卡约 `14px`；资源卡更紧 `8px 10px`。

### Inputs / Fields
- **Style:** `bg-input` + `1px border` + `6px` 圆角；字号 ~12。
- **Focus:** 避免厚重彩环；与周边面板保持克制（遗留 Tailwind `ring-primary` 仅见于旁路入口，勿扩散）。
- **Search:** 常见图标 + 无边框内嵌输入，外层灰底容器。

### Navigation
- **Sidebar：** 半透明雾灰；分组用 `.bb-section-label`；导航用 `.bb-nav-row` + `.bb-icon-tile`（Lucide `strokeWidth={1.75}`）。
- **任务/会话列表：** `.bb-session-item`（小色标图标 + 标题 + 一行 meta；选中浅蓝圆角）；保持紧凑行高。
- **Active：** `.bb-nav-row--active` / `.bb-session-item--active`（冰蓝浅底，非粗描边框）。
- **Top tabs：** `.bb-tabs` / `.bb-tab--active`（底边 `2px accent`）。

### Signature: Welcome + Composer
欢迎态品牌标题 + 场景胶囊 + 技能 icon tile 行 + 同屏悬浮可发送 Composer。新屏若改欢迎态，不得拆成「先点进对话才能输入」。禁止欢迎页右上角营销/积分促销条。

### Signature: Resource picker cards
已选资源展示名称 + 状态芯片 + 可移除；可选列表可搜索。这是系统级交互造型，不只是样式。

### Craft primitives（新增页面必用）

令牌与类定义在 `src/renderer/index.css`；壳层组件在 `src/components/ui/PanelChrome.tsx`。

| 场景 | 使用 |
|------|------|
| 二级面板壳 | `PanelChrome` + `.bb-panel*` |
| 主内容根节点 | `panelRootStyle()` / `ContentShell` |
| 功能入口图标 | `.bb-icon-tile`（可选 `--muted` / `--active`） |
| 可搜索工具条 | `.bb-search` / `.bb-input` / `.bb-btn` |
| 列表卡 | `.bb-list-card` |
| 状态标签 | `.bb-chip*` |
| 对话/欢迎输入 | `.bb-composer-dock` + `.bb-composer-float` |

## Do's and Don'ts

### Do:
- **Do** 新面板/新页先读本文 + 复用上表 `.bb-*` 原语与 `PanelChrome`，再写局部样式。
- **Do** 使用 `src/renderer/index.css` 的 CSS 变量；主强调色只用于行动与选中（`#2563eb`）。
- **Do** 主内容偏白纸；分区靠色差/弱阴影；图标放浅色圆角方底。
- **Do** 欢迎态保留可发送 Composer；二级功能保证进入→选择→回对话。
- **Do** 品牌文案写 **BspBuddy**；状态与空态用中文可读文案 + 语义色芯片。
- **Do** 互斥/分级状态必须**一眼可分**：如策略「必须」用警示红、「建议」用信息蓝；已启用/已禁用、在线/离线等同理。禁止多种语义共用同一灰芯片。
- **Do** 在空态、引导、品牌/欢迎等关键点**适当用插图或图标图**（产品实物、流程示意、轻量插画），帮助扫读与降低文字密度；图要服务任务，不堆装饰。

### Don't:
- **Don't** 把 `src/index.css` 暗色 HSL 令牌当作新功能默认主题（除非明确做暗色模式专项）。
- **Don't** 为每个新面板发明新顶栏/Tab/列表样式或新主色；技能行多色图标是局部装饰。
- **Don't** 用大面积渐变、玻璃拟物堆叠或营销 Hero / 积分促销条打断工作台。
- **Don't** 侧栏任务行做成高大卡片，导致少量条目占满屏。
- **Don't** 用 raw ID 输入代替资源选择器，或让选择器永久空数据。
- **Don't** 把「必须 / 建议」「成功 / 失败」等不同语义画成同色灰标，只靠文字区分。
- **Don't** 为装饰而堆无意义插图、渐变块或 emoji 墙；图出现时应对齐空态指引或品牌识别。
- **Don't** 在 UI 中写 WorkBuddy / workbuddy。
