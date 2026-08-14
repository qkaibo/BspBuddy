---
id: agents-005-api
title: A2A 接入 Token — API 与鉴权
type: tech-spec
related: [agents-005, agents-004, auth-001, skills-003]
---

## 概述

落实 `agents-005`：在已有 `AgentSkillToken` / `/api/enterprise/agent-tokens` 上增加用途字段与 A2A 明文前缀，使 `get_current_user` 可解析 `bba2a_*`；桌面「设置 → A2A 接入」通过现有 IPC 签发/列表/吊销。不新建平行鉴权表。

## 设计目标

| 目标 | 做法 |
|------|------|
| 用户级凭证 | Token 绑定 `user_id` + `tenant_id`；无全局密钥 |
| 与技能 Runtime 分离 | `purpose=a2a` \| `skill_runtime`；列表可过滤 |
| 明文一次 | 仅 CREATE 响应返回 `token`；库内只存 `token_hash` |
| 兼容现网 | 旧行无 `purpose` 回填为 `skill_runtime`；`bbsk_` 仍可用 |
| 少新通道 | 复用 `AGENT_SKILL_TOKEN_*` IPC，body/query 带 `purpose` |

## API 设计

Base：`/api/enterprise`（需 Bearer）。  
A2A 消费端：`/a2a/*`（需同一用户身份）。

### POST `/api/enterprise/agent-tokens`

**Request**

```json
{
  "device_label": "cursor-ide",
  "ttl_hours": 720,
  "purpose": "a2a"
}
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| device_label | string | ≤100 | 设备备注 |
| ttl_hours | int | 1–8760 | 有效期小时 |
| purpose | string | `a2a` \| `skill_runtime` | 缺省 `skill_runtime`（兼容商店签发） |

**Response 200**

```json
{
  "id": "agtok_…",
  "token": "bba2a_…",
  "device_label": "cursor-ide",
  "purpose": "a2a",
  "expires_at": "2026-09-13T…",
  "token_suffix": "wxyz"
}
```

- `purpose=a2a` → 明文前缀 `bba2a_`
- `purpose=skill_runtime` → 明文前缀 `bbsk_`

### GET `/api/enterprise/agent-tokens?purpose=a2a`

| Query | 说明 |
|-------|------|
| tenant_id | 已有 |
| purpose | 可选；传入则过滤 |

**Response item**（无明文）

```json
{
  "id": "agtok_…",
  "device_label": "cursor-ide",
  "purpose": "a2a",
  "token_suffix": "wxyz",
  "expires_at": "…",
  "revoked_at": null,
  "created_at": "…"
}
```

### DELETE `/api/enterprise/agent-tokens/{token_id}`

| Query | 说明 |
|-------|------|
| permanent | 可选 bool；`true` 时从库**硬删除**该行；缺省为软吊销（写 `revoked_at`） |

- 软吊销：仅 owner；已吊销则幂等返回当前行  
- 硬删除：仅 owner；删除后 404；用于清理已吊销/已过期（UI 仅在此状态展示删除按钮）  
- 软吊销响应同列表 item；硬删除响应 `{ "ok": true, "id": "…" }` 或 204

### 鉴权扩展

`get_current_user` / `resolve_user_from_agent_token`：

1. 常规登录 HMAC token  
2. 前缀 `bbsk_` **或** `bba2a_` → hash 查 `agent_skill_tokens`（未吊销、未过期）→ `User`

## 数据模型

### `agent_skill_tokens`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR PK | | `agtok` 前缀 |
| tenant_id | VARCHAR | INDEX | |
| user_id | VARCHAR | INDEX | |
| token_hash | VARCHAR | INDEX | SHA-256(明文) |
| device_label | VARCHAR | NULL | |
| purpose | VARCHAR | NOT NULL DEFAULT `'skill_runtime'` INDEX | `a2a` / `skill_runtime` |
| token_suffix | VARCHAR | NULL | 明文末 4 字符，列表掩码用 |
| expires_at | DATETIME | INDEX | |
| revoked_at | DATETIME | NULL INDEX | |
| created_at | DATETIME | | |

迁移：`ALTER TABLE … ADD COLUMN purpose …`；`ADD COLUMN token_suffix`；`UPDATE … SET purpose='skill_runtime' WHERE purpose IS NULL`（若用可空过渡则立即回填）。

## 核心流程

### 签发（桌面）

1. 设置 → A2A 接入 → 用户填备注 / TTL  
2. IPC `agent-skill-token:create` `{ purpose: 'a2a', … }`  
3. FastAPI CREATE → 返回明文 → UI 展示一次并复制  
4. 刷新 LIST `purpose=a2a`

### IDE 调用

1. `Authorization: Bearer bba2a_…`  
2. `GET {base}/a2a/agents` → 当前租户 active 专家 Card  
3. `POST {base}/a2a/agents/{id}/tasks` → SSE  

### 吊销

1. UI DELETE → `revoked_at` 写入  
2. 旧明文再请求 → 401  

## 安全

- 明文永不落库、不进 LIST  
- 租户 + 用户双向校验；不可读他人 Token  
- 桌面本地 `local.*` 会话不能当 A2A Bearer；签发走 FastAPI 桥接用户  
- UI 文案标明「后端身份」，避免与 Phase1 本地切换用户混淆  

## 与 PRD 的差异

| 项 | PRD | 本规格 |
|----|-----|--------|
| Tech Spec 文件名 | 提及 `agents-005-api` | 本文件 `agents-005-api`（路径 `tech-spec/agents-005-a2a-access-token.md`） |
| token_suffix | 可选 | 明确落库，列表稳定掩码 |
| purpose 缺省 | 签发 A2A 固定 a2a | API 缺省 skill_runtime 以兼容商店；A2A UI 显式传 a2a |
