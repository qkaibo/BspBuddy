---
id: auth-001
title: 全产品身份与访问控制
type: prd
related: [auth-001-api, auth-01, agents-003, agents-002-sop, 10-permission]
---

## 概述

BspBuddy 的 **auth 域**定义全产品统一的身份、登录会话与租户内角色（RBAC），并作为各领域 **资源 ACL**（SOP / 专家 / 知识库等）的身份来源。  
它与对话输入框旁的 **Agent Permission Modes**（工具沙箱，见 [plans/10-permission](../plans/10-permission.md)）正交——后者只约束 Agent 运行时能否自动执行高风险工具，**不是**成员角色或资源编辑权。

分层模型（必读）：

```
auth（身份 + 角色/RBAC）
  ├─ 资源 ACL（SOP / 专家 / 知识库…）——领域文档定义细则，身份从属 auth
  └─ Agent Permission Modes（plan 10）——运行时工具沙箱，另一维度
```

| 层 | 管什么 | 文档 | 不做什么 |
|----|--------|------|----------|
| **auth** | 租户、成员、角色、登录会话、管理员能力 | **本 PRD** + [auth-001-api](../tech-spec/auth-001-session-and-rbac.md) | 不定义某条 SOP 的 owner/grant 细则 |
| **资源 ACL** | 具体资源上的 view/edit/publish/广场等 | 如 [agents-003](./agents-003-sop-management.md)、专家等后续 PRD | 不另起登录体系；actor 一律来自 auth |
| **Agent Permission Modes** | 默认权限 / 完全访问；高风险工具确认 | [10-permission](../plans/10-permission.md) | 不决定「谁是管理员」或「谁能改 SOP」 |

参考：StaffDeck `prd-012 认证与账号管理`（登录 / admin·member / JWT claims）；产品名与对外文案一律 **BspBuddy**。

---

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 成员 | 登录后使用创作台、专家、对话 | 操作以本人身份落库，只看有权资源 |
| 成员 | 查看自己的会话身份（显示名 / 角色） | 确认当前账号，避免误用他人数据 |
| 管理员 | 在设置中管理租户成员与角色 | 加人、改角色、禁用离职账号 |
| 管理员 | 撤下广场资源、处理跨成员运维 | 租户级治理，不依赖「碰巧是资源 owner」 |
| 配置者 | 能对话使用已绑定 SOP 的专家，但不能改他人库内源 SOP | 理解 **bindings ≠ 库 ACL**；身份与角色由 auth 提供 |
| 桌面用户（Phase 1） | 无云端多账号时仍有稳定本地会话 | 单用户模拟 actor，为后续多用户无缝切换做准备 |

---

## 功能清单

| # | 功能 | 关联页面 | 说明 |
|---|------|---------|------|
| 1 | 登录 / 登出 | 登录视图 / 侧栏账号 | 建立或清除会话；桌面 Phase 1 可为本地 mock 登录 |
| 2 | 当前会话身份 | 侧栏头像区 / 设置 | 展示显示名、角色、租户（可折叠） |
| 3 | 成员列表 | 设置 → 成员与角色 | 管理员查看租户内成员 |
| 4 | 创建 / 编辑成员 | 成员与角色 → 弹窗 | 用户名、显示名、密码、角色 |
| 5 | 禁用 / 删除成员 | 成员与角色 | 管理员操作；不可删最后一个管理员 / 不可删自己（策略见验收） |
| 6 | 角色分配 | 成员与角色 | 至少 `member` / `admin`；可扩展自定义角色（后续） |
| 7 | 会话注入下游 | （无独立页） | 所有 IPC/API 携带 actor；资源域消费身份 |
| 8 | 与资源 ACL 衔接 | SOP 创作台等 | list/edit 按 actor + 领域 ACL；admin 可有租户级覆盖策略 |
| 9 | 与 Agent 沙箱分栏说明 | 任务 Composer 权限下拉 | UI/文案不把「默认权限」写成「管理员权限」 |

---

## 数据模型

### Tenant（租户）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 租户 ID；桌面 Phase 1 可用 `local` |
| name | string | 是 | 显示名 |
| createdAt | number | 是 | 创建时间 |

### Member（租户成员 / User）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 用户 ID（`user_id`） |
| tenantId | string | 是 | 所属租户 |
| username | string | 是 | 登录名；租户内唯一 |
| displayName | string | 否 | 显示名 |
| roles | `RoleId[]` | 是 | 至少含一个角色；MVP：`member` \| `admin` |
| status | `'active' \| 'disabled'` | 是 | 禁用后不可登录 |
| passwordHash | string | 是 | 仅服务端；不暴露给 renderer |
| avatarUrl | string | 否 | 头像 |
| createdAt | number | 是 | 创建时间 |
| updatedAt | number | 是 | 更新时间 |

### Role（角色，MVP 内置）

| RoleId | 说明 | 典型能力 |
|--------|------|----------|
| `member` | 普通成员 | 登录；管理自己有权的资源；从广场复制到自己的库 |
| `admin` | 租户管理员 | 成员 CRUD/改角色；租户级运维（如撤下广场，对齐领域 PRD） |

> 可扩展：后续可增加自定义角色与细粒度 capability，但 **不得** 用角色表替代资源 owner/grants（见正交关系）。

### Session / Actor（会话身份）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tenantId | string | 是 | 来自 token / 本地会话 |
| userId | string | 是 | 当前用户 |
| username | string | 是 | 登录名 |
| roles | `RoleId[]` | 是 | 解析后的角色集合 |
| exp | number | 否 | 过期时间（云端 JWT） |

下游资源服务只认主进程/后端解析出的 **actor**，禁止信任 renderer 自报的 `userId`。

### 与专家 bindings、SOP owner/grants 的正交关系

```
auth.actor (tenantId, userId, roles)
        │
        ├─→ 资源 ACL（例：SOP）
        │     owner_user_id / grants.view|edit / is_overall
        │     细则：agents-003 · agents-002-sop
        │
        ├─→ 专家生命周期 / Scope bindings
        │     Expert.bindings.sopSkills = 运行时引用
        │     有权用专家 ≠ 自动拥有 SOP 库 edit
        │
        └─→ Agent Permission Modes（plan 10）
              默认权限 / 完全访问 —— 工具沙箱，与 RBAC 无关
```

| 命题 | 对 / 错 |
|------|---------|
| 管理员可以管理成员 | ✅ auth |
| 管理员默认拥有全部 SOP 的 edit | ❌ 除非领域 PRD 显式写「admin 覆盖」；SOP 默认仍按 owner/grant |
| 专家 bindings 含某 SOP → 当前用户可改该 SOP | ❌ 正交 |
| 「默认权限」下拉 = 成员角色 | ❌ 那是 Agent 沙箱 |

---

## 页面与字段（核心）

### 页面一：登录（`activeView: login`，未登录时）

#### 布局

```
┌────────────────────────────────────────────────────────────┐
│  BspBuddy                                                   │
│                                                            │
│              ┌────────────────────────────┐                │
│              │  登录                      │                │
│              │  用户名                    │                │
│              │  密码                      │                │
│              │  [登录]                    │                │
│              │  错误提示（内联）           │                │
│              └────────────────────────────┘                │
│                                                            │
│  Phase 1 桌面：可提供「本地开发会话」入口（单用户模拟）      │
└────────────────────────────────────────────────────────────┘
```

#### 字段

| 字段 | 类型 | 必填 | 默认 | 来源 | 说明 |
|------|------|------|------|------|------|
| username | text | 是 | — | 用户输入 | 租户内登录名 |
| password | password | 是 | — | 用户输入 | 支持显示/隐藏 |
| tenantId | hidden/select | 云端是 | Phase1=`local` | 配置 / 输入 | 桌面单租户可隐藏 |

#### 交互链

- 提交 → `auth:login` / `POST /api/auth/login` → 成功：主进程保存会话 → 进入主壳 → 失败：内联错误（不区分用户名/密码哪项错误）
- 已有有效会话 → 跳过登录进主壳
- 登出 → 清除会话 → 回登录视图

#### 按钮权限

| 按钮 | 显示条件 |
|------|----------|
| 登录 | 未登录 |
| 本地开发会话（Phase 1） | 开发/桌面 mock 开关开启时 |

---

### 页面二：成员与角色（设置 → 成员与角色）

入口贴合现有 Electron 壳：**侧栏「设置」→ 系统设置面板内增加入口**（与「远程助理」「数据管理」同级跳转），**不**做成独立网站式「企业后台」品牌页，**不**使用 WorkBuddy 文案。

管理员可见完整管理；普通成员进入时仅见只读「当前账号」或提示无权限。

#### 布局

```
┌─ 侧栏 ─┬──────────────────────────────────────────────────┐
│ 对话   │  系统设置                              [← 返回]   │
│ …      │──────────────────────────────────────────────────│
│ 设置 ● │  语言 / 字体 / …                                 │
│        │                                                  │
│        │  ┌─ 成员与角色 ─────────────────────────────┐   │
│        │  │ 管理租户成员与角色（管理员）          →  │   │
│        │  └──────────────────────────────────────────┘   │
│        │  远程助理 → / 数据管理 → …                        │
└────────┴──────────────────────────────────────────────────┘

点击「成员与角色」后（管理员）：

┌────────────────────────────────────────────────────────────┐
│  ← 成员与角色                    [刷新]  [邀请/新建成员]   │
├────────────────────────────────────────────────────────────┤
│  [搜索 用户名/显示名/角色…]                                 │
├────────────────────────────────────────────────────────────┤
│  用户名     显示名      角色      状态      操作           │
│  admin      管理员      管理员    启用      编辑           │
│  zhangsan   张三        成员      启用      编辑  禁用     │
├────────────────────────────────────────────────────────────┤
│  空态：还没有其他成员 → [新建成员]                          │
│  脚注：资源编辑权（如 SOP）由各资源 ACL 决定，见创作台说明  │
└────────────────────────────────────────────────────────────┘
```

#### 列表字段

| 字段 | 类型 | 必填 | 来源 | 说明 |
|------|------|------|------|------|
| username | string | — | Member.username | 登录名 |
| displayName | string | — | Member.displayName | 可空则回落 username |
| roles | tag | — | Member.roles | 展示「成员」「管理员」 |
| status | enum | — | Member.status | 启用 / 禁用 |
| createdAt | datetime | — | Member.createdAt | 可选列 |

#### 新建 / 编辑弹窗字段

| 字段 | 类型 | 必填 | 默认 | 来源 | 说明 |
|------|------|------|------|------|------|
| username | text | 是 | — | 用户输入 | 租户内唯一；编辑时只读或禁改（实现二选一，须在 Tech Spec 固定） |
| displayName | text | 否 | — | 用户输入 | |
| password | password | 新建是 / 编辑否 | — | 用户输入 | 编辑留空表示不改；≥6 字符 |
| roles | select | 是 | `member` | 用户选择 | MVP：`member` \| `admin` |
| status | select | 否 | `active` | 用户选择 | 编辑时可改为 disabled |

#### 交互链

- 打开入口 → `auth:me` 校验角色含 `admin` → 否则 Toast「需要管理员」并停留设置页或只读当前账号
- [刷新] → `auth:users:list` → 渲染表格；加载态 / 错误态可见
- [新建成员] → 弹窗 → 校验 → `auth:users:create` → Toast 成功 → 刷新列表
- [编辑] → 弹窗预填 → `auth:users:update` → Toast → 刷新
- [禁用] → Confirm → `auth:users:update` status=disabled → 该用户后续登录失败
- 删除（若提供）→ Confirm → `auth:users:delete`；**不可**删除自己；**不可**删除租户内最后一个 `admin`

#### 按钮权限

| 按钮 | 显示条件 |
|------|----------|
| 成员与角色入口（可管理） | `roles` 含 `admin` |
| 新建 / 编辑角色 / 禁用 | `admin` |
| 编辑自己的显示名（可选增强） | 已登录；改角色仍仅 admin |

---

### 页面三：当前账号（设置内只读卡片，全员）

#### 布局

```
┌────────────────────────────────────────┐
│  当前账号                              │
│  显示名：张三                          │
│  用户名：zhangsan                      │
│  角色：成员                            │
│  租户：local / Acme                    │
│  [登出]                                │
└────────────────────────────────────────┘
```

#### 字段

| 字段 | 类型 | 必填 | 来源 | 说明 |
|------|------|------|------|------|
| displayName | text | — | auth:me | |
| username | text | — | auth:me | |
| roles | tags | — | auth:me | |
| tenantId / tenantName | text | — | auth:me | |
| 登出 | button | — | — | 清除会话 |

---

## API 依赖

| 端点 / IPC | 触发场景 | 权限 |
|------------|----------|------|
| `POST /api/auth/login` · `auth:login` | 登录 | 无 |
| `POST /api/auth/logout` · `auth:logout` | 登出 | 已认证 |
| `GET /api/auth/me` · `auth:me` | 启动校验 / 当前账号 | 已认证 |
| `GET /api/auth/users` · `auth:users:list` | 成员列表 | admin |
| `POST /api/auth/users` · `auth:users:create` | 新建成员 | admin |
| `PUT /api/auth/users/{id}` · `auth:users:update` | 编辑成员 | admin |
| `DELETE /api/auth/users/{id}` · `auth:users:delete` | 删除成员 | admin |
| （下游）各资源 `*:list/update` | 创作台等 | 已认证 + **资源 ACL**；actor 由会话注入 |

契约细节见 [auth-001-api](../tech-spec/auth-001-session-and-rbac.md)。

---

## 页面关系

- **From:**
  - 未登录 → 登录页
  - 侧栏「设置」→ 系统设置 →「成员与角色」/「当前账号」
  - 会话过期 / 401 → 登录页
- **To:**
  - 登录成功 → 主壳（对话 / 插件面板等）
  - 成员管理不直接跳转 SOP 编辑器；脚注可链到创作台说明（agents-003）
- **数据耦合:**
  - 所有资源域 list/edit 依赖 auth 解析的 actor
  - SOP Phase E（[agents-02](../plans/agents-02-sop-management.md)）消费本域会话，**不**在 SOP PRD 内另建用户表
  - Agent Permission Modes UI（Composer 下拉）独立；文案与设置「成员与角色」不得混名
  - 专家 bindings / Scope（agents-002）继续正交于库 ACL

---

## 验收标准

- [ ] 分层说明出现在文档与设置脚注：auth / 资源 ACL / Agent Permission Modes 三者不混称
- [ ] 登录失败不暴露「用户名或密码哪一项错误」
- [ ] 有效会话下 `auth:me` 返回 tenantId、userId、roles
- [ ] 非管理员无法完成成员 CRUD（API 拒绝；UI 不提供破坏性按钮）
- [ ] 管理员不可删除自己；不可删除最后一个管理员
- [ ] 禁用用户无法再登录；已有会话在下次校验失败并退出
- [ ] 下游 IPC（至少 sop:list 路径）使用主进程注入的 actor，伪造 renderer userId 无效
- [ ] 文档与 UI 不把「默认权限」（plan 10）表述为角色或管理员能力
- [ ] 与 agents-003 正交：有专家 bindings ≠ 自动 SOP 库 edit；身份字段来自 auth
- [ ] Phase 1 桌面单用户模拟有明确标注；不得声称多用户 RBAC 已完成
- [ ] 产品文案为 BspBuddy，无 WorkBuddy 品牌
- [ ] L2/L3 验收按项目验收标准；成员管理 UI 须 L3 走通主路径后方可标完成
)