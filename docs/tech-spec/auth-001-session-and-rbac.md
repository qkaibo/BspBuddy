---
id: auth-001-api
title: 会话身份与 RBAC
type: tech-spec
related: [auth-001, auth-01, agents-003, agents-002-sop, 10-permission]
---

## 概述

本 Tech Spec 定义 BspBuddy **auth 域**的技术实现范围，对应产品需求 [auth-001](../prd/auth-001-access-control.md)。

覆盖：

- 登录会话与 JWT（或等价）claims：`tenant_id`、`user_id`、`roles`
- 主进程 / FastAPI 的 **actor** 注入与角色解析
- 成员 CRUD（admin）与桌面 Phase 1 单用户模拟
- 资源 ACL 如何**消费** actor（细则仍在各领域 Tech Spec，如 [agents-002-sop](./agents-002-sop.md)）

**不覆盖：**

- Agent Permission Modes（工具沙箱）——见 [plans/10-permission](../plans/10-permission.md)
- SOP owner/grants 表结构细节——见 agents-002-sop（本域只提供身份）

分层：

```
auth（本 Spec：会话 + RBAC）
  ├─ 资源 ACL 消费 actor.tenantId / userId / roles
  └─ Agent Permission Modes —— 另一维度，不读 RBAC 表
```

---

## 设计目标

| 目标 | 约束 / 权衡 |
|------|-------------|
| 身份唯一来源 | 全产品 actor 只从会话解析；禁止信任 renderer 自报 userId |
| 桌面可演进 | Phase 1 单用户 mock 会话字段形状与云端 JWT claims 一致，便于替换 |
| 租户隔离 | 所有成员与资源查询带 `tenant_id`；跨租户不可见 |
| RBAC 精简 | MVP 仅 `member` / `admin`；细粒度资源权放在资源 ACL，不塞进全局角色爆炸 |
| 与沙箱分家 | Permission Modes 状态存在任务/Agent 侧；auth 服务不解释「默认权限」 |
| 密码安全 | pbkdf2（或项目统一哈希）；密钥与哈希仅主进程/后端持有 |

非功能：

- Token 有效期建议 14 天（对齐 StaffDeck）；刷新策略可 Phase 2
- 审计：成员角色变更写审计日志（可后置）
- 时钟：`exp` 校验允许小幅 skew

---

## API 设计

### 认证方式

| 环境 | 机制 |
|------|------|
| 桌面 IPC | 主进程持有 `SessionStore`；handler 内 `getActor()`，不把完整密码回传 renderer |
| FastAPI | `Authorization: Bearer <token>`；中间件解析 JWT → `request.state.actor` |
| Phase 1 本地 | mock token 或内存会话；claims 形状与生产一致；代码标注 `TODO: replace with real auth session` |

### JWT / Session claims

```json
{
  "tenant_id": "local",
  "user_id": "u_admin",
  "username": "admin",
  "roles": ["admin"],
  "exp": 1735689600
}
```

| Claim | 类型 | 必填 | 说明 |
|-------|------|------|------|
| tenant_id | string | 是 | 租户 |
| user_id | string | 是 | 用户 |
| username | string | 是 | 登录名 |
| roles | string[] | 是 | `member` / `admin`（可扩展） |
| exp | number | 云端是 | Unix 秒 |

签名：HMAC-SHA256（或项目统一方案）；payload 与 sig 分隔格式可对齐 StaffDeck。

### 端点

#### 登录

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| POST | `/api/auth/login` · `auth:login` | `{ tenant_id?, username, password }` | `{ token, user: PublicUser }` |

失败：统一 `401` + 泛化消息（如「用户名或密码错误」）。

#### 当前用户

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| GET | `/api/auth/me` · `auth:me` | — | `{ user: PublicUser, actor: Actor }` |
| POST | `/api/auth/logout` · `auth:logout` | — | `{ ok: true }` |

#### 成员管理（admin）

| Method | Path / IPC | Request | Response |
|--------|------------|---------|----------|
| GET | `/api/auth/users` · `auth:users:list` | `?q=` | `{ items: PublicUser[] }` |
| POST | `/api/auth/users` · `auth:users:create` | `{ username, displayName?, password, roles }` | `{ user }` |
| PUT | `/api/auth/users/{id}` · `auth:users:update` | `{ displayName?, password?, roles?, status? }` | `{ user }` |
| DELETE | `/api/auth/users/{id}` · `auth:users:delete` | — | `{ ok: true }` |

`PublicUser` **不含** `passwordHash`。

#### Schema（摘要）

```ts
type RoleId = 'member' | 'admin'

interface Actor {
  tenantId: string
  userId: string
  username: string
  roles: RoleId[]
}

interface PublicUser {
  id: string
  tenantId: string
  username: string
  displayName?: string
  roles: RoleId[]
  status: 'active' | 'disabled'
  avatarUrl?: string
  createdAt: number
  updatedAt: number
}
```

### Actor 注入（IPC / FastAPI）

**桌面 IPC：**

1. Preload 仅暴露通用 `invoke`；不暴露伪造身份 API  
2. Main handler 入口：`const actor = sessionService.requireActor()`  
3. 若未登录 → 抛出/返回约定错误码 `AUTH_REQUIRED`  
4. 将 `actor` 传入领域 service（如 `sopService.list(actor, query)`）  
5. **丢弃** renderer payload 中的 `userId` / `tenantId`（若有）

**FastAPI：**

1. Dependency：`get_actor(credentials) -> Actor`  
2. 从 JWT claims 映射 `tenant_id`→`tenantId` 等  
3. 路由：`def list_skills(actor: Actor = Depends(get_actor))`  
4. 转发自 Electron 时：主进程附加 `Authorization` 头，不由 renderer 直连带自定义身份头（若 renderer 直连，仍以服务端验签为准）

### 角色解析

```
token/session
  → verify signature & exp & status!=disabled
  → roles[]
  → helpers:
       isAdmin(actor)  := 'admin' in actor.roles
       isMember(actor) := actor.roles non-empty && status active
```

| 能力 | 条件 |
|------|------|
| 调用已认证 API | 有效 actor |
| 成员 CRUD | `isAdmin` |
| 资源 view/edit | **资源 ACL**（owner/grant/…）± 领域规定的 admin 覆盖 |
| Agent 高风险工具自动执行 | **Permission Modes**（plan 10），不读 roles |

### 资源 ACL 如何消费 actor

以 SOP 为例（权威细则 [agents-002-sop](./agents-002-sop.md)）：

| 检查 | 使用的 actor 字段 |
|------|-------------------|
| 租户范围 | `actor.tenantId == resource.tenant_id` |
| 我的库 list | `owner_user_id == actor.userId` **或** grant 含 view/edit |
| 写操作 | owner 或 grant edit；（若领域 PRD 允许）`isAdmin` 租户覆盖 |
| 广场 | 同租户 + `is_overall` + published；不要求 owner |
| 专家 bindings | **不**参与 SOP 库 ACL；bindings 服务另查专家 ACL |

专家、知识库等资源同模式：**身份从属 auth；ACL 表/字段在领域 Spec。**

---

## 数据模型

### tenants

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 租户 ID |
| name | TEXT | NOT NULL | 显示名 |
| created_at | INTEGER | NOT NULL | Unix ms |

### users

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | user_id |
| tenant_id | TEXT | NOT NULL, INDEX | FK → tenants |
| username | TEXT | NOT NULL | UNIQUE `(tenant_id, username)` |
| display_name | TEXT | NULL | |
| password_hash | TEXT | NOT NULL | |
| roles_json | TEXT | NOT NULL | JSON 数组 |
| status | TEXT | NOT NULL | `active` \| `disabled` |
| avatar_url | TEXT | NULL | |
| created_at | INTEGER | NOT NULL | |
| updated_at | INTEGER | NOT NULL | |

索引：`(tenant_id, status)`。

### sessions（可选；JWT 无状态时可省略服务端表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | |
| user_id | TEXT | NOT NULL, INDEX | |
| tenant_id | TEXT | NOT NULL | |
| token_hash | TEXT | NOT NULL | 仅存哈希 |
| expires_at | INTEGER | NOT NULL | |
| created_at | INTEGER | NOT NULL | |

### Phase 1 桌面单用户模拟

| 项 | 约定 |
|----|------|
| tenant_id | 固定 `local` |
| user | 种子 `admin`（或当前机器本地用户映射），roles=`['admin']` |
| 存储 | 主进程内存 + 用户数据目录；与生产 `PublicUser`/`Actor` 同形 |
| 多用户 UI | 可隐藏「成员与角色」写操作，或展示只读当前账号 |
| 禁止 | 把「本机目录下所有资源对任何账号可见」标成权限已完成 |

---

## 核心流程

### 登录

1. Renderer `auth:login` → Main  
2. 查 `users` by `(tenant_id, username)` → 验 password → status==active  
3. 签发 token / 写入 SessionStore  
4. 返回 `{ token, user }` → Renderer 可缓存展示用 PublicUser（鉴权仍以 Main 为准）  
5. 后续 IPC 均 `requireActor()`

### IPC 鉴权（领域调用）

1. Handler 收到 invoke  
2. `actor = requireActor()`；失败 → `AUTH_REQUIRED`  
3. 若端点需 admin → `requireAdmin(actor)`  
4. 调用 `domainService.method(actor, …)`  
5. 领域内再做资源 ACL；返回 403/404 按领域约定

### 本地后端连接状态（桌面）

`expert:fastapi-status` → 主进程对 `GET /api/health` 做实时探测，返回：

| 字段 | 说明 |
|------|------|
| `ready` / `online` | 健康检查是否通过 |
| `baseUrl` | 如 `http://127.0.0.1:52020` |
| `latencyMs` | 可选 |
| `error` | 失败原因 |
| `checkedAt` | 探测时间戳 |

**定时检测（主进程，非 renderer `setInterval`）：**

1. `startFastApiHealthMonitor()` 在应用就绪后启动，默认每 **15s** 调用一次 `probeFastApiStatus()`  
2. 探测完成后通过 `expert:fastapi-status-changed` 推送到所有窗口（`webContents.send`）  
3. 侧栏订阅该事件更新状态；**后台轮询与手动刷新均不改主文案**，仅状态点闪烁  
4. 用户点击侧栏状态 → `invoke(expert:fastapi-status)` 立即探测  
5. 应用退出时 `stopFastApiHealthMonitor()` 清理定时器  

禁止仅依赖 renderer 定时器做健康检测（窗口后台会被 Chromium 节流，导致「不能定时检查」）。禁止在侧栏用第二行展示「刚刚检测 / N 秒前」等时间文案。

侧栏页脚单行展示「本地服务已连接 / 未连接」。此状态是 **FastAPI 桥接可用性**，与桌面 Phase1 本地登录会话不是同一概念。

### 角色变更

1. Admin 更新 roles → 校验「不能移除最后一个 admin」  
2. 写库 → （可选）作废该用户旧 refresh  
3. 目标用户下次 `auth:me` 或 token 重签后拿到新 roles；MVP 可要求重新登录

### 桌面 Phase1 → 云端多用户

```
Phase1: SessionStore.mock(local, u_local, [admin])
    → 同 Actor 形状
Phase2: 真实 login + users 表
    → Electron 仍 inject actor；FastAPI verify JWT
Phase3: 成员 UI + SOP Phase E 等资源 ACL 全量启用
```

---

## 安全

| 项 | 要求 |
|----|------|
| 密码 | 哈希存储；传输仅 HTTPS/本地 IPC |
| Token | 签名校验；过期失效；logout 清本地会话 |
| 注入 | 禁止信任 renderer 身份字段 |
| 租户 | 成员 list/create 强制 `actor.tenantId` |
| 管理员保护 | 不可删自己；不可删/降级最后一个 admin |
| 禁用 | disabled 用户校验会话时失败 |
| 密钥 | HMAC secret 仅主进程/服务端环境变量 |
| 分层 | RBAC ≠ 资源 ACL ≠ Agent Permission Modes |
| 枚举 | 无权限用户访问成员 API → 403；资源无 view → 领域用 404/403 |

---

## 与 PRD 的差异

| 项 | PRD (auth-001) | 本实现约定 |
|----|----------------|------------|
| 自定义角色 / capability 矩阵 | 可扩展 | **MVP 不做**；仅 member/admin |
| 邀请链接 / SSO | 未作为 P0 | **延后** |
| 头像上传 | 可选 | Phase 2；MVP 可无 |
| 会话服务端吊销列表 | 理想 | MVP JWT + 本地 SessionStore；吊销列表后置 |
| username 编辑 | 二选一 | **编辑时 username 只读** |
| 删除 vs 禁用 | 均可 | MVP 优先 **禁用**；物理删除可选 |
| Phase 1 登录页 | 需要 | 可用「自动本地会话」跳过 UI，但 actor 必须存在 |

无其他已知偏差；实现偏离须在本节目增补并同步 PRD。
`)