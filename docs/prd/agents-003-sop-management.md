---
id: agents-003
title: SOP 创作与管理
type: prd
related: [agents-001, agents-002, agents-002-sop, auth-001, auth-001-api]
---

## 概述

SOP 创作台是 BspBuddy 中 **SOP 本身从无到有** 的产品能力：新建空白、从文档/自然语言蒸馏、流程图编辑、版本管理与发布。  
它与 [agents-002](./agents-002-editor-ux.md) **专家 Scope 工作台**严格分层——Scope 只做「当前专家已有哪些 SOP / 从广场或同事复制归属」，**不覆盖** SOP 内容创作。

参考：StaffDeck `prd-002 SOP 技能系统`；术语见 [CONTEXT.md](../CONTEXT.md)。

> **身份从属：** 登录会话、租户成员与角色（RBAC）从属 [auth-001](./auth-001-access-control.md)；本 PRD 的 SOP owner/grants/广场规则是**资源层 ACL**，消费 auth 注入的 actor，不另建用户体系。

### 两层边界（必读）

| 层 | 文档 | 用户在做什么 | 不做 |
|----|------|-------------|------|
| **(1) SOP 创作台** | **本 PRD (agents-003)** | 新建 / 蒸馏编辑 / 版本 / 发布 / 归档 | 不负责把 SOP「绑到哪个专家」的日常维护 |
| **(2) 专家 Scope 工作台** | [agents-002](./agents-002-editor-ux.md) | 选当前专家 → 看其已有子集 → 从广场/其他专家**复制归属** | **不**打开蒸馏编辑器，不新建 SOP 内容 |

```
SOP 从哪来？
  ┌─ 创作台：空白新建 / 蒸馏生成 / 导入文档蒸馏 ──→ 得到可发布的 SOP（库）
  └─ Scope 工作台：从广场 / 其他专家复制到当前专家 bindings ──→ 专家「拥有」该 SOP
专家对话时使用的是 bindings 中已归属的已发布 SOP。
```

### 权限与可见性（产品模型，必读）

**正确模型：「我的 SOP 库」= 当前登录用户有权看到的 SOP，按用户权限隔离；不是本机全员共享磁盘目录。**

| 隔离维度 | 规则 | 说明 |
|----------|------|------|
| **租户 tenant** | 云端必有；租户间数据不可见 | 对齐 StaffDeck `tenant_id`；桌面 Phase 1 可用固定本地 tenant（如 `local`）占位，语义不变 |
| **用户 / 成员** | 草稿默认仅**创建者**（或被显式授予 `edit` 的成员）可见、可改、可删 | 同租户其他成员默认看不到他人草稿 |
| **发布（库内 published）** | 仍属所有者库；未上广场前，同租户他人**不**因「已发布」自动获得库内编辑权 | 「发布」= 生命周期就绪，可被 Scope 归属 / 可上广场，≠ 全租户可编辑 |
| **发布到广场（isOverall）** | 租户内成员可见目录，可**复制到自己的库**（独立副本）；源 SOP 改写权仍归所有者/管理员（对齐 StaffDeck overall：成员复制，管理员可撤下广场） | 复制 ≠ 共享编辑；改副本不影响源 |
| **与专家 bindings 正交** | 有权使用某专家（对话 / Scope 看到 bindings）**≠** 自动拥有该 SOP 在「我的库」中的编辑权 | Scope 写入的是专家侧引用；库侧 CRUD 仍按 SOP 权限检查 |

权限动作（产品语义）：

| 动作 | 谁可以 | 备注 |
|------|--------|------|
| 列表「我的库」 | 当前用户：自己拥有的 + 被授予 view/edit 的 | `sop:list` 必须按身份过滤 |
| 创建 / 蒸馏保存 | 已登录成员 | 新建记录的 `ownerUserId` / `createdBy` = 当前用户 |
| 编辑 / 改写 / 版本回滚 | 所有者或持有 `edit` | 无权限 → 拒绝，UI 不展示破坏性按钮 |
| 发布 / 转草稿 / 归档 | 所有者或持有 `edit`（管理员策略可扩展） | |
| 上广场 / 撤下广场 | 所有者或租户管理员（对齐 StaffDeck） | 设置 `isOverall` |
| 从广场复制到我的库 | 租户内任意成员（只读浏览广场目录） | 得到**自己的** draft 副本，`ownerUserId` = 自己 |
| 删除 | 所有者或 `edit`；且未被 Expert.bindings 引用时（或先 unbind） | |

_Avoid_：把本机 JSON 文件当成「所有本机账号共用的全局库」；把「能聊到绑定了该 SOP 的专家」当成「能进创作台改源 SOP」。

---

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 配置者 | 用自然语言描述「报销审批流程」蒸馏出 SOP | 快速把业务经验变成可执行流程 |
| 配置者 | 上传制度文档（md/docx）生成节点图后微调 | 文档即流程，减少手搓 |
| 配置者 | 编辑已有 SOP 的节点指令并保存新版本 | 迭代优化，可回滚 |
| 配置者 | 将草稿发布，再在 Scope 工作台复制给专家 | 先成库、再归属 |
| 配置者 | 从广场复制一条公开 SOP 到「我的 SOP 库」再改写 | 复用已验证流程后本地定制 |
| 配置者 | 只看到自己有权的草稿；同事草稿默认不可见 | 按成员隔离，避免本机「全员共享库」误读 |
| 配置者 | 能用专家对话（专家已绑定某 SOP），但不能在创作台改他人拥有的源 SOP | bindings 与库编辑权正交 |

---

## 功能清单

| # | 功能 | 关联页面 | 说明 |
|---|------|---------|------|
| 1 | SOP 列表（我的库） | SOP 创作台列表 | 搜索/状态筛选；展示名称、ID、业务域、版本、状态 |
| 2 | 新建空白 SOP | 列表 → 蒸馏编辑器 | 创建 draft，打开编辑器 |
| 3 | AI 蒸馏生成 | 蒸馏编辑器 | 自然语言或上传文档 → SSE 管道生成 SkillCard |
| 4 | 改写优化 | 蒸馏编辑器 | 对已有 SOP 自然语言局部改写 |
| 5 | 流程图编辑 | 蒸馏编辑器 | 节点拖拽、连线、属性面板 |
| 6 | 版本管理 | 列表 / 弹窗 | 查看历史、回滚、删除版本 |
| 7 | 发布 / 转草稿 / 归档 | 列表 | 生命周期：draft ↔ published → archived |
| 8 | 从广场复制到我的库 | 列表 | 得到可编辑副本（与 Scope「复制到专家」不同） |
| 9 | 入口衔接 Scope | 列表 / 发布成功 | 引导「去专家 Scope 归属」→ agents-002 |
| 10 | 按用户权限过滤「我的库」 | SOP 创作台列表 | list/get/update 等均带当前用户身份；无权限不可见不可改 |

---

## 数据模型

### SopSkill（库内实体）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 内部唯一 ID |
| skillId | string | 是 | 稳定业务 ID（如 `expense-approve`）；唯一性建议在 tenant 内 |
| name | string | 是 | 显示名称 |
| businessDomain | string | 否 | 业务域标签 |
| status | `'draft' \| 'published' \| 'archived'` | 是 | 生命周期 |
| contentJson | SkillCard | 是 | 节点+边等完整卡片 |
| version | number | 是 | 当前版本号 |
| isOverall | boolean | 是 | 是否发布到广场（租户内可被复制） |
| tenantId | string | 是 | 租户 ID（云端真实；桌面可用 `local` 占位） |
| ownerUserId | string | 是 | 库侧所有者；草稿默认可视/可编辑边界以此为准 |
| createdAt | number | 是 | 创建时间 |
| updatedAt | number | 是 | 更新时间 |
| createdBy | string | 否 | 创建者标识（可与 ownerUserId 同值；转让所有权后可不同） |

### SkillCard

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nodes | SopNode[] | 是 | 流程图节点 |
| edges | SopEdge[] | 是 | 节点连线 |
| triggerIntents | string[] | 否 | 触发意图 |
| interruptionPolicy | object | 否 | 中断策略 |

### SopNode（关键）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nodeId | string | 是 | 节点 ID |
| name | string | 是 | 节点名称 |
| type | `'start' \| 'process' \| 'decision' \| 'action' \| 'end'` | 是 | 节点类型 |
| condition | string | 否 | decision 条件 |
| instruction | string | 是 | 执行指令 |
| expectedUserInfo | object | 否 | 期望收集的用户信息 |
| allowedActions | string[] | 否 | 允许动作 |

### SkillVersion

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| skillId | string | 是 | 所属 SOP |
| version | number | 是 | 版本号 |
| contentJson | SkillCard | 是 | 该版本快照 |
| createdAt | number | 是 | 快照时间 |
| createdBy | string | 否 | 操作者 |

### 与 ExpertBindings 的关系

- `Expert.bindings.sopSkills: string[]` 存的是 **已归属到专家的 SOP id**（见 agents-001 / agents-002）。
- 创作台产出并 `published` 后，用户再到 Scope 工作台执行「从广场 / 从其他专家复制」写入 bindings。
- 本 PRD **不**改变 Scope 导入交互。
- **正交性：** 用户能配置/使用某专家（含看到其 bindings）**不**自动获得对应 SopSkill 在创作台的 view/edit；反之，拥有库编辑权也**不**自动把 SOP 写入某专家 bindings。

---

## 页面与字段

### 页面一：SOP 创作台列表（PluginPanel → SOP 库 / 创作入口）

> 与 agents-002 的「当前专家 Scope 列表」可同属插件 SOP 区域，但 **模式分离**：  
> - **归属模式**（agents-002）：顶部有「当前专家」下拉 + 从广场/同事复制到专家  
> - **创作模式**（本 PRD）：「我的 SOP 库」= **当前用户有权** 的列表 + 新建/编辑/发布，**无**专家 scope 下拉作为主操作；**不是**本机全员共享库

#### 布局

```
┌──────────────────────────────────────────────────────────────────┐
│  SOP 创作台                              [刷新] [新增 ▾]          │
│                                      ├ 新建空白 SOP               │
│                                      ├ 从文档蒸馏                 │
│                                      └ 从广场复制到我的库         │
├──────────────────────────────────────────────────────────────────┤
│  [搜索名称/ID/业务域...]     [全部 ▾ 状态]                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────┬──────┬──────┬─────────────────┐ │
│  │ SOP 名称  │ SOP ID   │ 业务域│ 版本 │ 状态 │ 操作            │ │
│  │ 报销审批  │ expense… │ 行政  │ v2   │ 已发布│ 编辑 版本 发布… │ │
│  └──────────┴──────────┴──────┴──────┴──────┴─────────────────┘ │
│  空态：还没有 SOP → [新建空白] 或 [从文档蒸馏]                      │
│  底部提示：发布后可到「专家 Scope」把 SOP 复制给专家（agents-002）   │
└──────────────────────────────────────────────────────────────────┘
```

#### 筛选字段

| 字段 | 类型 | 必填 | 默认 | 来源 | 说明 |
|------|------|------|------|------|------|
| 搜索 | 文本 | 否 | — | 本地过滤 | 名称 / skillId / 业务域，300ms 防抖 |
| 状态 | 下拉 | 否 | 全部 | status | 全部 / 草稿 / 已发布 / 已归档 |

#### 表格列

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 名称 | 文本 | 是 | name |
| SOP ID | 文本 | 是 | skillId |
| 业务域 | 文本 | 否 | businessDomain |
| 版本 | 数字 | 是 | version，展示为 `v{n}` |
| 状态 | 枚举徽章 | 是 | draft / published / archived |
| 广场 | 标签 | 否 | isOverall 时显示「广场」 |

#### 操作按钮

| 按钮 | 显示条件（状态 ∩ 权限） | 行为 |
|------|------------------------|------|
| 编辑 | 对当前用户有 `edit`；非 archived（或允许查看归档的只读） | → 打开蒸馏编辑器；仅 view 时只读 |
| 版本管理 | 有 `view` 或 `edit` | → 版本管理弹窗；回滚需 `edit` |
| 发布 | status === draft 且有 `edit` | → 确认 → publish API → Toast → 刷新 |
| 转草稿 | status === published 且有 `edit` | → draft API → 刷新 |
| 上广场 / 撤下 | published（或产品允许的状态）且所有者或租户管理员 | → 设置/取消 isOverall |
| 归档 | status !== archived 且有 `edit` | → 确认 → archive → 刷新 |
| 删除 | (draft 或 archived) 且有 `edit` | → ConfirmDialog → 删除 |
| 去归属给专家 | status === published（能用 Scope 即可，不要求库 edit） | → 提示切到 Scope 工作台（agents-002） |

#### 交互链

```
[新增 ▾] → 新建空白 SOP
  → sop:create({ blank: true }) → status=draft
  → 打开蒸馏编辑器（空画布）

[新增 ▾] → 从文档蒸馏
  → 打开蒸馏编辑器（附件区聚焦）
  → 用户上传/粘贴 → 蒸馏 SSE → 画布填充 → 保存

[从广场复制到我的库]
  → 搜索租户内 isOverall && published → 勾选
  → sop:clone-from-square（身份=当前用户）→ 自己的 draft 副本（ownerUserId=自己）
  → 刷新「我的库」（不等于写入某专家 bindings；也不获得对源 SOP 的 edit）

行内 [发布]
  → 确认 → sop:publish → status=published
  → Toast「可到专家 Scope 工作台归属给专家」
  → 可选 CTA → 打开 agents-002 归属模式
```

#### 版本管理弹窗

```
触发 [版本管理]
  → sop:versions → 版本列表
  → [查看] → 只读加载该版 contentJson
  → [回滚] → 确认 → sop:rollback → 当前 content 替换 → 刷新
  → [删除版本] → 确认（不可删当前唯一版本）
```

---

### 页面二：蒸馏编辑器（全屏 / 大模态）

#### 布局

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 返回列表     <技能名称>              [保存]  [模型 ▾]         │
├──────────────────────┬───────────────────────────────────────────┤
│  左侧：对话蒸馏面板    │  右侧：流程图编辑器                        │
│  ┌─────────────────┐  │  ┌───────────────────────────────────┐   │
│  │ 对话区域         │  │  │         流程图画布                  │   │
│  │ AI / 用户气泡    │  │  │    ┌───────┐    ┌───────┐        │   │
│  │ [文件上传]       │  │  │    │ 开始   │───→│ 审批   │        │   │
│  │ [输入] [发送]    │  │  │    └───────┘    └───────┘        │   │
│  └─────────────────┘  │  │  节点属性 / 文件树（可选）           │   │
└──────────────────────┴───────────────────────────────────────────┘
```

#### 左侧蒸馏面板字段

| 字段 | 类型 | 必填 | 默认 | 来源 | 说明 |
|------|------|------|------|------|------|
| 消息输入 | 多行文本 | 蒸馏时是 | — | 用户 | 自然语言需求或改写指令 |
| 附件 | 文件 | 否 | — | 本地上传 | md / docx / txt / doc |
| 模型 | 下拉 | 否 | 全局默认 | model:list | 蒸馏/改写所用模型 |

#### 右侧节点属性面板

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 节点 ID | 文本（只读） | 是 | nodeId |
| 节点名称 | 文本 | 是 | name |
| 类型 | 下拉 | 是 | start / process / decision / action / end |
| 条件 | 文本 | decision 时是 | condition |
| 指令 | 多行 | 是 | instruction |
| 期望用户信息 | JSON/键值 | 否 | expectedUserInfo |
| 允许的动作 | 多选 | 否 | allowedActions |

#### 交互链

```
新建或打开编辑
  → 加载 contentJson（若有）→ 渲染画布

提交蒸馏
  → sop:distill/stream (SSE)
  → step_analysis → 左侧步骤说明
  → node_generated / edge_generated → 右侧画布增量
  → stream_complete → 可 [保存]

已有 SOP 改写
  → sop:rewrite/stream
  → 保留结构局部更新 → [保存] → version++

[保存]
  → sop:update → Toast 成功 → 可继续编辑或 ← 返回列表
```

#### 蒸馏管道（产品可见阶段）

对齐 StaffDeck 七步语义（实现细节见 agents-002-sop）：生成 → 解析 → 修复 → 分段降级 → 规范化 → 反思 → 完成。  
UI 至少展示：进行中步骤名、错误可重试、完成后画布可编辑。

---

## API 依赖

所有写接口与「我的库」读接口须携带**当前用户身份**（桌面：主进程会话；云端：token 中的 `tenant_id` + `user_id`）。服务端按身份做过滤与鉴权，客户端过滤不算权限边界。

| 能力 | IPC / 通道（规划） | 触发场景 | 权限 |
|------|-------------------|----------|------|
| 列表 | `sop:list` | 打开创作台列表 | 仅返回当前用户有权（owner / 被授权）的项 |
| 创建 | `sop:create` | 新建空白 / 蒸馏前占位 | 登录成员；写入 ownerUserId=当前用户 |
| 更新 | `sop:update` | 编辑器保存 | 需对本 SOP 有 `edit` |
| 删除 | `sop:delete` | 列表删除 | 需 `edit`；bindings 约束见 Tech Spec |
| 发布 | `sop:publish` | 草稿→已发布 | 需 `edit` |
| 转草稿 | `sop:draft` | 已发布→草稿 | 需 `edit` |
| 归档 | `sop:archive` | 归档 | 需 `edit` |
| 版本列表 | `sop:versions` | 版本弹窗 | 需 `view` 或 `edit` |
| 回滚 | `sop:rollback` | 版本回滚 | 需 `edit` |
| 蒸馏 SSE | `sop:distill/stream` | 新建蒸馏 | 登录；落库时 owner=当前用户 |
| 改写 SSE | `sop:rewrite/stream` | 改写模式 | 需对目标 SOP 有 `edit` |
| 文件提取 | `sop:files/extract` | 上传文档预处理 | 登录成员 |
| 广场 SOP 目录 | `sop:square-list` | 复制到我的库 | 同租户；仅 isOverall && published |
| 从广场克隆到库 | `sop:clone-from-square` | 库内副本（非 bindings） | 同租户可读广场；副本归当前用户 |
| 模型列表 | `model:list` | 编辑器模型选择 | 登录成员 |

> FastAPI 路径与 Schema 以 [agents-002-sop](../tech-spec/agents-002-sop.md) 为准；IPC 为桌面桥接层。

**明确不属于本 PRD：** `resource:import` / `resource:unbind` / `expert-scope`（见 agents-002）。

---

## 页面关系

| From | To | 触发 | 数据耦合 |
|------|-----|------|----------|
| PluginPanel / 专家中心入口 | SOP 创作台列表 | 「SOP 库 / 创作」 | 按当前用户权限加载「我的」SopSkill |
| SOP 创作台列表 | 蒸馏编辑器 | 新建 / 编辑 / 从文档蒸馏 | 读写 contentJson（需 edit） |
| SOP 创作台列表 | 版本管理弹窗 | 版本管理 | SkillVersion |
| 发布成功 CTA | 专家 Scope 工作台 (agents-002) | 「去归属给专家」 | 仅导航；bindings 在 Scope 内变更 |
| 专家 Scope 工作台 | （只读依赖）已发布 / 广场 SOP 目录 | 从广场复制到专家 | 需要 published / isOverall；**不**授予库 edit |
| 专家编辑器 (agents-001) | — | — | **不**进入创作台；管理 SOP 进 Scope |

- **From:** 插件 SOP 区创作模式、列表「新增」、行内编辑  
- **To:** 蒸馏编辑器、版本弹窗、Scope 归属模式（衔接）  
- **数据耦合:** 创作台变更 published / isOverall 集合 → Scope/广场可复制源变化；**不**自动改 Expert.bindings；bindings 变化**不**改变库侧 ACL

---

## 验收标准

### 创作与生命周期

- [ ] 文档与 UI 文案明确区分「创作台」与「专家 Scope 归属」，无混用入口文案
- [ ] 可新建空白 SOP（draft）并打开蒸馏编辑器
- [ ] 自然语言或上传文档可蒸馏出含节点与边的 SkillCard，过程有进度反馈
- [ ] 流程图可拖拽编辑节点属性并保存
- [ ] 已有 SOP 支持自然语言改写并保存为新版本
- [ ] 版本列表可查看与回滚，回滚后内容与目标版本一致
- [ ] 发布 / 转草稿 / 归档状态切换正确，列表筛选生效
- [ ] 「从广场复制到我的库」产生库内副本，且 **不会** 自动写入某专家 bindings
- [ ] 发布成功后有通向 Scope 工作台的指引；归属流程仍符合 agents-002
- [ ] 空态引导「新建 / 蒸馏」，而非永久「暂无数据」且无 CTA
- [ ] L3：实际启动应用走通「蒸馏→保存→发布→Scope 复制给专家」全链路，console 无红错

### 权限与隔离

- [ ] 「我的 SOP 库」语义为当前用户有权集合，**不是**本机全员共享；产品文案与空态与此一致
- [ ] 草稿默认仅创建者（或持有 edit 者）在 list/get 中可见；同租户其他用户默认不可见
- [ ] 无 edit 时无法 update / publish / draft / archive / rollback / delete（服务端拒绝；UI 不展示或禁用破坏性操作）
- [ ] 上广场后同租户可 square-list 并 clone 到自己的库；克隆副本 owner 为当前用户；改副本不影响源
- [ ] 有权使用已绑定该 SOP 的专家 ≠ 自动获得创作台对该 SOP 的 edit（正交性用例可复现）
- [ ] 所有 sop:* IPC / API 请求带当前用户身份（或主进程会话解析出的 user）；未鉴权写接口不存在
- [ ] 云端路径下跨 tenant 不可见；桌面 Phase 1 若单用户会话模拟，文档与实现注释标明缺口与对接路径（见 Tech Spec）
