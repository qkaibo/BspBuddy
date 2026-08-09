# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主用户是软件工程师与技术负责人，在本地用 AI 工作台完成开发与工程相关工作流。他们需要对话、工具与项目上下文留在桌面端，而不是只靠浏览器里的聊天页。

## Product Purpose

BspBuddy 是 AI 驱动的桌面工作台。用户通过对话驱动任务，切换模型，管理产物，并借助专家（Expert）、技能/SOP、插件等扩展能力。成功标准是：能进入流程 → 选好/配好所需资源 → 回到对话并拿到可用结果；仅仅「路由能打开」不算完成。

## Positioning

可配置专家（Expert）加上 SOP 技能（图/状态机工作流），把领域方法论固化成可执行流程，而不是停留在通用聊天客户端。领域用语与产品选择以 `docs/` 为准；实现不得臆造与文档冲突的产品行为。

## Operating Context

- 桌面 Electron 应用（Windows/macOS）+ React Web UI
- 主路径围绕对话/Composer、任务与结果区，以及二级面板（专家、技能、插件、连接器等）
- 产品权威来源：`docs/`（`prd/`、`tech-spec/`、`plans/`、`reference/`）；`specs/` 已废弃
- 开发入口：`npm run dev`（electron-vite）

## Capabilities and Constraints

- 已确认产品概念：专家（Expert）、专家团（Expert Team）、技能（Skill）、SOP 技能、知识库（Knowledge Base）、广场（Square）、蒸馏/改写/反思、对话轮次（Turn）、槽位（Slot）、反馈分析（见 `docs/CONTEXT.md`）
- 架构：Main / Preload / Renderer / Shared；UI 仅通过 IPC（`createIpcClient` + `IPC_CHANNELS`）与主进程通信；Renderer 禁止使用 Node API
- 属于产品真相的 UX 约束：禁止空数据假选择器、禁止 raw ID 绑定、欢迎态必须可直接发送 Composer、二级功能须先闭环（进入 → 选择 → 回对话）再堆完整 CRUD
- 设计上下文未决：此处不记录视觉世界观（init 不创建 DESIGN.md）

## Brand Commitments

- 产品名：**BspBuddy**（包名 `bspbuddy`）
- 产品 UI、文档与新代码中禁止使用 WorkBuddy / workbuddy
- 上游/参考文档若仍出现 WorkBuddy，仅作参考，不作为品牌

## Evidence on Hand

- 领域术语：`docs/CONTEXT.md`
- 计划与状态：`docs/README.md`、`docs/plans/`
- UI 硬性规则：`docs/reference/ref-001-ui-design-principles.md` 与 `.cursor/rules`（ux-first、UI 原则）
- 代码中已有现行界面实现；尚无 DESIGN.md
- 不得编造客户证言、用户数、基准测试或定价宣称

## Product Principles

1. 对话是中枢：二级界面用于选择、绑定或审阅，最终回到对话交付结果。
2. 规格优先于臆造：遵循 `docs/` 的产品选择，不发明冲突行为。
3. 可用优于脚手架：空列表、假成功、raw ID 都属于未完成状态。
4. 工程场景优先：服务本地、可调用工具、能闭环任务的工作流，而不是营销展示。
5. 品牌固定：只用 BspBuddy；参考实现不得冒充产品名。
