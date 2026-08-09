---
id: agents-002-sop
title: SOP 蒸馏编辑器与技能库
type: tech-spec
related: [agents-003, agents-001, agents-002, auth-001, auth-001-api]
---

## 概述

本 Tech Spec 定义 BspBuddy **SOP 技能库 + 蒸馏/改写管道** 的技术实现范围，对应产品需求 [agents-003](../prd/agents-003-sop-management.md)。

覆盖：

- SopSkill / SkillCard / SkillVersion 持久化与生命周期
- 蒸馏与改写的流式 API（FastAPI + Electron IPC 桥）
- 创作台列表与蒸馏编辑器所需后端契约

**不覆盖：** 专家 Scope 归属、`resource:import` / `resource:unbind`（见 agents-002 PRD 与现有 expert-service）。

> **身份从属：** 会话 / JWT claims / actor 注入的权威定义见 [auth-001-api](./auth-001-session-and-rbac.md)；本 Spec 的 SOP ACL（owner/grants/广场过滤）为**资源层**，只消费 auth 提供的 actor，不实现登录与成员表。

---

## 设计目标

| 目标 | 约束 / 权衡 |
|------|-------------|
| 桌面优先 | Renderer 仅经 IPC；长耗时蒸馏走 SSE/作业，避免阻塞主进程 |
| 与 StaffDeck 对齐 | SkillCard 结构、七步蒸馏语义对齐参考实现；品牌与路径用 BspBuddy |
| 库与归属分离 | 库 CRUD/发布独立；bindings 由专家服务维护，本模块只提供可复制源 |
| 可演进 | Phase 1 本地 JSON/SQLite mock 可跑通 UX；Phase 2 接 FastAPI 真实蒸馏与真实多用户 |
| 可回滚 | 每次发布或显式「另存版本」写 SkillVersion；rollback 原子替换 content |
| 按用户隔离 | **目标模型**带 `tenant_id` + `owner_user_id`（及可选 ACL）；「我的库」= 当前用户有权集合，**不是**本机全员共享 |

非功能：

- 蒸馏超时与取消（用户可中止作业）
- 流式事件至少支持断线后续播（job + after_seq）为后续增强，MVP 可先同步 SSE
- **权限（目标 vs Phase 1）：**
  - **目标：** 每条 SopSkill 有 `tenant_id`、`owner_user_id`；list/get/写操作均做权限检查；广场仅同租户 `is_overall && published`
  - **Phase 1 桌面缺口：** 可用**单用户会话**模拟（主进程固定或登录态解析出唯一 `user_id` / `tenant_id=local`），seed 数据归属该用户；**不得**在文档或 README 中把「本机文件里所有 SOP 对任何账号可见」标成已完成权限
  - **对接路径：** 主进程会话（权威：[auth-001-api](./auth-001-session-and-rbac.md)）→ 注入 `actor`（tenantId, userId, roles）→ sop-service 按**资源 ACL**过滤/鉴权 → 云端接 FastAPI 时用 token claims 替换本地会话（见下文「身份传递」）

---

## API 设计

### 认证与身份传递

- **权威定义：** 会话、JWT claims、角色解析见 [auth-001-api](./auth-001-session-and-rbac.md)；本节只约定 SOP 如何消费 actor。
- **桌面 IPC：** 信任主进程会话。Handler 从 session 解析 `actor = { tenantId, userId, roles }`，**禁止**信任 renderer 自报的 userId 作为鉴权依据。
- **转发 FastAPI：** 请求头带本地/云端 token；后端从 JWT claims 取 `tenant_id`、`user_id`、`roles`（对齐 StaffDeck auth payload）。
- **无匿名公开写接口**；广场目录为同租户已登录可读。
- Phase 1：若尚无真实登录，主进程提供单用户 mock 会话（形状与 auth-001-api 一致），并在代码/注释标注 `TODO: replace with real auth session`。

### 技能库 CRUD

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| GET | `/api/skills` · `sop:list` | `?status=&q=`（身份来自会话） | `{ items: SopSkillSummary[] }` 仅当前用户有权项 |
| POST | `/api/skills` · `sop:create` | `{ name, skillId?, blank? }` | `{ skill: SopSkill }`；写入 owner=actor |
| GET | `/api/skills/{id}` · `sop:get` | — | `{ skill }` 或 404/403（无 view） |
| PUT | `/api/skills/{id}` · `sop:update` | `{ name?, businessDomain?, contentJson }` | `{ skill }`；需 edit |
| DELETE | `/api/skills/{id}` · `sop:delete` | — | `{ ok: true }`；需 edit |

### 生命周期

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| POST | `/api/skills/{id}/publish` · `sop:publish` | — | `{ skill }` status=published, version++ |
| POST | `/api/skills/{id}/draft` · `sop:draft` | — | `{ skill }` status=draft |
| POST | `/api/skills/{id}/archive` · `sop:archive` | — | `{ skill }` status=archived |

### 版本

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| GET | `/api/skills/{id}/versions` · `sop:versions` | — | `{ versions: SkillVersion[] }` |
| POST | `/api/skills/{id}/versions/{v}/rollback` · `sop:rollback` | — | `{ skill }` |

### 蒸馏 / 改写（SSE）

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| POST | `/api/skills/distill/stream` · `sop:distill/stream` | `{ text?, fileIds?, modelId?, skillId? }` | SSE events |
| POST | `/api/skills/{id}/rewrite/stream` · `sop:rewrite/stream` | `{ instruction, modelId?, targetPath? }` | SSE events |
| POST | `/api/skills/files/extract` · `sop:files/extract` | multipart file | `{ text, meta }` |

#### SSE 事件（约定）

| event | data 摘要 |
|-------|-----------|
| `step_analysis` | `{ step, message }` |
| `node_generated` | `{ node }` |
| `edge_generated` | `{ edge }` |
| `node_content_chunk` | `{ nodeId, chunk }` |
| `reflection` | `{ scores, notes }` |
| `stream_complete` | `{ contentJson }` |
| `error` | `{ code, message }` |

### 广场（库侧）

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| GET | `/api/skills/square` · `sop:square-list` | `?q=` | `{ items }`：同 `tenant_id` 且 `is_overall && status=published` |
| POST | `/api/skills/clone-from-square` · `sop:clone-from-square` | `{ sourceId }` | `{ skill }` 新 draft；`owner_user_id=actor.userId`，`is_overall=false` |

### list / get 过滤与鉴权规则

设当前 `actor = { tenantId, userId }`。可选扩展：`grants[skillId]` 含 `view` | `edit`（Phase 2+；MVP 可仅 owner）。

| 操作 | 可见 / 允许条件 |
|------|----------------|
| `sop:list`（我的库） | `tenant_id == actor.tenantId` **且**（`owner_user_id == actor.userId` **或** 持有对该 skill 的 view/edit grant） |
| `sop:get` / versions | 同上 view；否则 404（防探测）或 403（实现二选一，推荐对无租户权限用 404） |
| `sop:update` / publish / draft / archive / rollback / delete / rewrite | 需 **edit**：owner 或 grant.edit |
| `sop:square-list` | `tenant_id == actor.tenantId` **且** `is_overall == true` **且** `status == published`（不要求是 owner） |
| `sop:clone-from-square` | 源满足 square-list 条件；新行 `owner_user_id = actor.userId`，独立 id |
| 专家 bindings | **不**参与上述库 ACL；有专家使用权不能放宽 sop:* edit |

**与「本机全员共享」的差异：** 即使数据落在同一用户数据目录，服务层仍必须按 `actor` 过滤；多账号切换后 list 不得泄露他账号草稿。

### Schema 摘要

```ts
type SopStatus = 'draft' | 'published' | 'archived'

interface SopActor {
  tenantId: string
  userId: string
}

interface SopSkillSummary {
  id: string
  skillId: string
  name: string
  businessDomain?: string
  status: SopStatus
  version: number
  isOverall: boolean
  tenantId: string
  ownerUserId: string
  updatedAt: number
}

interface SopSkill extends SopSkillSummary {
  contentJson: SkillCard
  createdAt: number
  createdBy?: string
}

interface SkillCard {
  nodes: SopNode[]
  edges: SopEdge[]
  triggerIntents?: string[]
  interruptionPolicy?: Record<string, unknown>
}

interface SopNode {
  nodeId: string
  name: string
  type: 'start' | 'process' | 'decision' | 'action' | 'end'
  condition?: string
  instruction: string
  expectedUserInfo?: Record<string, unknown>
  allowedActions?: string[]
}

interface SopEdge {
  from: string
  to: string
  label?: string
}

interface SkillVersion {
  skillId: string
  version: number
  contentJson: SkillCard
  createdAt: number
  createdBy?: string
}
```

---

## 数据模型

### 表 / 集合：`sop_skills`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 内部 UUID |
| tenant_id | TEXT | NOT NULL | 租户；桌面 Phase 1 可用 `local` |
| owner_user_id | TEXT | NOT NULL | 库侧所有者；草稿默认可视/可编辑边界 |
| skill_id | TEXT | NOT NULL | 业务 ID；唯一性建议 `(tenant_id, skill_id)` |
| name | TEXT | NOT NULL | 显示名 |
| business_domain | TEXT | NULL | 业务域 |
| status | TEXT | NOT NULL | draft / published / archived |
| content_json | JSON/TEXT | NOT NULL | SkillCard |
| version | INTEGER | NOT NULL DEFAULT 1 | 当前版本 |
| is_overall | INTEGER/BOOL | NOT NULL DEFAULT 0 | 是否上广场（租户内可复制） |
| created_at | INTEGER | NOT NULL | epoch ms |
| updated_at | INTEGER | NOT NULL | epoch ms |
| created_by | TEXT | NULL | 创建者（可与 owner 同） |

索引：`(tenant_id, owner_user_id)`, `(tenant_id, status)`, `(tenant_id, is_overall, status)`，UNIQUE `(tenant_id, skill_id)`。

### 表：`sop_skill_versions`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 版本行 ID |
| skill_pk | TEXT | FK → sop_skills.id NOT NULL | 所属技能 |
| version | INTEGER | NOT NULL | 版本号 |
| content_json | JSON/TEXT | NOT NULL | 快照 |
| created_at | INTEGER | NOT NULL | |
| created_by | TEXT | NULL | 操作者 user id |

唯一约束：`(skill_pk, version)`。

### 可选表（Phase 2+）：`sop_skill_grants`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| skill_pk | TEXT | FK | |
| user_id | TEXT | NOT NULL | 被授权成员 |
| permission | TEXT | NOT NULL | `view` \| `edit` |

MVP 可只实现 owner 规则；表结构预留对接 StaffDeck 式成员协作。

### 与专家 bindings

- `experts.bindings.sopSkills` 仅存 `sop_skills.id` 引用
- 删除已绑定 SOP：服务层拒绝硬删或先要求 unbind（实现期选定，默认拒绝 delete if referenced）
- **正交：** bindings / 专家 ACL **不**替代 `sop_skills` 上的 owner/grant 检查

---

## 核心流程

### 1. 空白创建 → 编辑 → 发布

```
1. POST sop:create { blank: true }
2. 打开编辑器，用户编辑或蒸馏
3. PUT sop:update { contentJson }
4. 可选：写入 sop_skill_versions（保存点）
5. POST sop:publish → status=published, version+=1, 写版本快照
6. UI CTA → 用户前往 Scope（agents-002）执行 resource:import
```

### 2. 蒸馏 SSE

```
1. 可选 POST sop:files/extract → text
2. POST sop:distill/stream
3. 服务端管道：
   generate → parse → repair → segment_fallback → normalize → reflect
4. 每步/每节点推送 SSE
5. stream_complete → 客户端合并 contentJson → 用户确认后 sop:update
```

### 3. 改写

```
1. 加载已有 skill
2. POST sop:rewrite/stream { instruction, targetPath? }
3. 应用 patch → 画布更新
4. sop:update → version 策略：草稿内可覆盖；发布后编辑先转 draft 或强制新版本（产品默认：published 编辑前转 draft）
```

### 4. 回滚

```
1. GET versions
2. POST rollback/{v}
3. 当前 content_json ← 该版本快照；version = max+1 并新增快照（审计友好）
```

### 状态机

```
draft ──publish──→ published ──archive──→ archived
  ↑                  │
  └──── draft ←──────┘
```

---

## 安全

| 项 | 要求 |
|----|------|
| 身份 | 每个 sop:* 请求绑定 actor；服务端强制过滤，不依赖 UI 隐藏 |
| 租户 | 跨 `tenant_id` 不可读不可写 |
| 所有权 | 非 owner 且无 grant 时不可 edit；草稿默认不对同租户他人 list 可见 |
| 路径 | 上传文件仅落用户数据目录；禁止任意路径读写 |
| 内容 | contentJson 大小上限（建议 2MB）；节点数上限（建议 200） |
| 模型 | 蒸馏调用走已配置 API Key；Key 仅主进程持有 |
| 广场 | clone-from-square 仅复制同租户 is_overall && published；不可越权改源 |
| 删除 | 被 Expert.bindings 引用时拒绝删除或要求先 unbind |
| XSS | 渲染节点 Markdown 时按现有安全组件消毒 |
| 正交 | 专家使用权 / bindings **不**提升 SOP 库 edit |

### Phase 1 桌面缺口（必须标明，不得标完成）

| 缺口 | 现状风险 | 对接路径 |
|------|----------|----------|
| 真实多用户登录 | 单用户 mock 会话时，切换账号前数据可能同库 | 接入 auth 会话后按 userId 过滤；迁移补齐 owner_user_id |
| 共享授权 grants | MVP 仅 owner | 增加 `sop_skill_grants` 或对接企业成员角色 |
| 云端 tenant | 本地 `tenant_id=local` | FastAPI + JWT `tenant_id`；索引与 UNIQUE 已按 tenant 设计 |

---

## 与 PRD 的差异

| 项 | PRD (agents-003) | 本实现约定 |
|----|------------------|------------|
| 排行榜（StaffDeck 列表底） | 未作为 P0 | **延后**；不阻塞创作台 MVP |
| 异步 job + 续播 | 编辑器增强 | MVP 先直连 SSE；job API 列为 Phase 2 |
| 分支 synced/diverged | CONTEXT 有术语 | 库内 clone 先做「独立副本」；完整 Branch 协议后续接 FastAPI |
| 文件树 nodes/*.md | StaffDeck 有 | MVP 可以 JSON 画布为主；文件树为可选增强 |
| IPC 名 | PRD 规划名 | 与 `src/lib/types.ts` 现有 `sop:list/create/delete` 对齐扩展，新增通道以实现 PR 为准 |
| 用户权限隔离 | 目标模型（tenant + owner + 正交 bindings） | **Phase 1 可用单用户会话模拟**；多用户/grants/云端 tenant 为待开发，**不得**声称权限已完成 |
| 旧表述「单租户桌面暂无隔离」 | — | **作废**；改为上文目标模型 + Phase 1 缺口表 |

无其他已知偏差；若实现偏离须在本节目增补并同步 PRD。
