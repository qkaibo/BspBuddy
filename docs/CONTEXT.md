---
id: ref-context
title: BspBuddy 领域术语表
type: reference
related: []
---

# BspBuddy

AI 桌面工作台。用户通过对话与 AI 交互完成任务，支持模型切换、产物管理、插件扩展。

## 语言

### 核心实体

**专家（Expert）**：
一个可配置的 AI 角色，包含人设（System Prompt）、方法论、工具链、技能和知识库。用户在对话中召唤专家，获得领域专属的 AI 辅助。
参考：StaffDeck 的「数字员工（Agent）」概念。

**专家团（Expert Team）**：
多位专家分工协作的执行单元。团长自动拆解任务、并行执行并整合交付。
参考：S

**技能（Skill）**：
教 AI 完成特定任务的工具能力。如发邮件、查股价、调用 API。可通过插件安装或自创。

**通用技能 / General Skill**：
以 `SKILL.md` 为核心的可安装技能包，经 FastAPI `GeneralSkillRunner` 执行（read / execute）。个人目录安装到专家见 `agents-002`；企业商店发现/分级/Agent 安装协议见 `skills-001`～`skills-003`。
_Avoid_：与 SOP 技能混称；把「加入我的技能」说成已经「绑定专家」。

**技能访问级别（L1 / L2 / L3）**：
企业技能的调用与下载分离模型。L1 登录可调可下；L2 可调、下载需授权；L3 仅授权可调且禁止 ZIP。见 `skills-002`。

**技能 Runtime / 本地壳**：
Agent 本地只保留壳 `SKILL.md`，执行前通过 runtime API 拉取最新主指令与资源。见 `skills-003`。
_Avoid_：默认认为升版必须重下 ZIP。

**SOP 技能（SOP Skill）**：
图结构（节点+边）的状态机驱动技能。每个节点声明期望的用户信息、允许的操作和关联的能力引用。通过 **SOP 创作台**（蒸馏编辑器）从自然语言或文档生成。
生命周期：draft → published → archived。
参考：StaffDeck 的「SOP Skill」概念。
_Avoid_：把「专家 Scope 里从广场复制」误称为「创建 SOP」。

**SOP 创作台（SOP Authoring）**：
管理「我的 SOP 库」：新建空白、文档/自然语言蒸馏、流程图编辑、版本、发布/归档。产出的是库内 SopSkill，**不**直接等于专家已绑定列表。
产品文档：`docs/prd/agents-003-sop-management.md`。
_Avoid_：创作台、Scope 工作台混为一谈。

**我的 SOP 库（My SOP Library）**：
当前**登录用户有权看到**的 SopSkill 集合（owner 或被授予 view/edit），按 **租户 + 用户** 隔离。草稿默认仅创建者（或持 edit 者）可见可改；上广场后同租户可复制到自己的库。
_Avoid_：把「我的库」理解成本机全员共享目录；把磁盘上全部 SOP 当成当前用户可见集。

**SOP 权限边界（SOP ACL vs Expert Bindings）**：
库侧 CRUD/发布权限由 `tenant_id` + `owner_user_id`（及可选 grants）决定；专家侧 `bindings.sopSkills` 只表示专家**运行时可引用**哪些 SOP。
有权使用某专家 ≠ 自动拥有对应 SOP 的库内编辑权；拥有库编辑权 ≠ 自动写入某专家 bindings。
身份/角色从属 **auth-001**；SOP ACL 为资源层（细则仍见 `agents-003`、`agents-002-sop`）。
_Avoid_：用 Scope 归属或专家使用权替代库 ACL；在 SOP 域另建登录用户体系。

### 身份与权限（auth）

**租户成员（Tenant Member）**：
隶属于某一租户、可登录 BspBuddy 的账号（`user_id` + `tenant_id`）。桌面 Phase 1 可用固定本地租户（如 `local`）与单用户会话模拟，语义仍是「成员」而非「本机匿名共享」。
产品文档：`docs/prd/auth-001-access-control.md`。
_Avoid_：把本机磁盘用户目录当成多成员可见的共享身份。

**角色（Role / RBAC）**：
租户内成员的全局角色，MVP 至少含 `member`（成员）与 `admin`（管理员）。决定能否管理成员、部分租户级运维；**不**替代具体资源的 owner/grants。
_Avoid_：用「管理员」一词指代 Composer 上的「完全访问权限」沙箱模式。

**资源 ACL（Resource ACL）**：
挂在具体资源（SOP / 专家 / 知识库等）上的访问控制（owner、view/edit grants、广场可见性等）。细则由各领域 PRD/Tech Spec 定义；**身份（actor）从属 auth**。
_Avoid_：把资源 ACL 写成另一套登录系统；与专家 bindings 混为一谈。

**Agent 权限模式（Agent Permission Modes / 沙箱）**：
对话任务侧的运行时工具沙箱：默认权限 vs 完全访问；高风险写删/命令/网络需确认。入口在任务输入框下方下拉（见 `docs/plans/10-permission.md`）。
与 auth RBAC、资源 ACL **正交**——不决定谁是管理员、谁能改 SOP。
_Avoid_：称为「权限系统」而不加「Agent/沙箱」限定，以致与 auth-001 混名。

**专家 Scope（Expert Scope）**：
当前正在配置资源的专家上下文（本地持久化当前专家 ID）。资源页（如 SOP 归属模式）只展示/维护该专家 `bindings` 子集。
产品文档：`docs/prd/agents-002-editor-ux.md`。
_Avoid_：全局全库勾选绑定；在专家编辑器内硬绑海量 SOP。

**专家 Scope 工作台 / SOP 归属工作台**：
在选定专家 Scope 下，查看该专家已有 SOP，并从广场或其他专家**复制归属**（写入 `bindings.sopSkills`）或移除。只做归属，**不做**蒸馏与内容创作。
_Avoid_：在归属工作台里「新建 SOP 内容」。

**知识库（Knowledge Base）**：
新增。从文档提取、分桶、索引的个人知识容器。四级引用结构：文档（Document）→ 知识桶（Bucket）→ 知识块（Chunk）→ 知识概念（Concept）。
参考：StaffDeck 的「Knowledge Base」概念。

**广场（Square/Overall）**：
租户内公开共享的资源池（`isOverall` / StaffDeck `is_overall`）。专家或 SOP 可发布到广场；同租户成员可复制到**自己的库**或专家 scope。复制后资源独立，后续可通过分支管理同步；源的编辑权仍归所有者/管理员。
参考：StaffDeck 的「开放广场（Platform）」概念。
_Avoid_：把上广场当成跨租户公开互联网；把「可复制」当成「可直接改源」。

### 技能体系

**技能卡片（SkillCard）**：
SOP 的 JSON 表示——nodes、edges、trigger_intents、interruption_policy 等，存于 `contentJson`。

**技能蒸馏（Skill Distillation）**：
AI 从非结构化文档或自然语言中自动生成 SOP 技能 Card（JSON）的过程。包含生成→解析→修复→分段降级→规范化→反思的完整管道。发生在 **SOP 创作台**。
参考：StaffDeck 的「Skill Distillation」概念。

**技能改写（Skill Rewriting）**：
基于自然语言指令对已有 SOP 技能的局部修改（创作台内）。

**技能反思（Skill Reflection）**：
对蒸馏/改写产物的多维度自动校验。

**技能分支（Skill Branch）**：
专家对广场/源 SOP 的独立副本关系。状态语义参考 StaffDeck：`synced` / `diverged`。当前 Scope 工作台以 bindings ID 列表简化；完整分支协议后续对接。

### A2A 与外部接入

**A2A（Agent-to-Agent）**：
本地 Agent / 外部 IDE 按 Google A2A 协议委托服务器端专家执行的通道。产品端点：`/a2a/agents`、`/a2a/agents/{id}/tasks`（SSE）。协议与聊天内委托见 `agents-004`。
_Avoid_：把 A2A 说成「再开一套聊天 API」而忽略专家 Card / 任务委托语义。

**A2A 接入 Token**：
绑定**后端用户**的个人访问令牌，供 IDE 等外部客户端以 `Authorization: Bearer` 调用 `/a2a/*`。在「系统设置」左侧分类「A2A 接入」签发/吊销（设置页左右两栏）；明文只显示一次。见 `agents-005`。
_Avoid_：当成租户全局一把钥匙；把技能商店「签发 Agent Token」（`skills-003`）当成 A2A 主入口；把桌面 Phase1 本地 `local.*` 会话 token 直接当 A2A Bearer。

### 执行引擎

**对话轮次（Turn）**：
从用户消息到 AI 回复的一次完整执行周期。通过事件序列持久化，支持刷新后恢复。

**槽位（Slot）**：
新增。SOP 技能执行过程中渐进收集用户信息的运行时键值存储。单向累积，不自动清除。
参考：StaffDeck 的「Slot」概念。

### 反馈体系

**反馈分析（Feedback Analysis）**：
新增。对用户点赞/踩的 AI 根因分析。归入 6 个桶：模型问题、技能问题、工具/系统问题、用户随机/不清晰、正面/已解决、未知。
参考：StaffDeck 的「Feedback Analysis」概念。

### AI 能力描述

为避免歧义，对话中 AI 对自身能力的描述统一为：

| 概念 | 正确表述 | 避免表述 |
|------|---------|---------|
| AI 身份 | 我是你的 AI 工作台 | 我是你的助手/机器人 |
| 任务执行 | 我来处理这个任务 | 我帮你做 |
| 文件操作 | 在工作空间内操作文件 | 在你的电脑上操作 |
| 权限请求 | 请求执行 <操作>，目标 <路径>，原因 <说明> | 需要你的许可 |
