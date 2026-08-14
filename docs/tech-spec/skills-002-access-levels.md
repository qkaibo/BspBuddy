---
id: skills-002-api
title: 技能访问分级与授权 — 技术规格
type: tech-spec
related: [skills-002, skills-001-api, skills-003-runtime, auth-001]
---

## 1. 概述

实现 skills-002：`access_level` 门禁、申请/审批/撤销、白名单、统一 403 信封。所有「调用类」与「下载类」端点经同一 `skill_access` 模块判定。

## 2. 设计目标

- 调用与下载正交：L2 可调不可下（未授权时）  
- L3 永不提供 ZIP  
- 403 机器可读，禁止客户端拼 URL  
- 与 auth-001 用户身份对齐（`user_id`）

## 3. API 设计

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/enterprise/general-skills/{slug}/access-requests` | 申请 |
| GET | `/api/enterprise/general-skills/{slug}/access-requests` | 作者/admin 列表 |
| POST | `/api/enterprise/general-skills/{slug}/access-requests/{id}/decide` | 批准/拒绝 |
| GET | `/api/enterprise/general-skills/{slug}/grants` | 有效授权 |
| DELETE | `/api/enterprise/general-skills/{slug}/grants/{id}` | 撤销 |
| PUT | `/api/enterprise/general-skills/{slug}/whitelist` | 覆盖白名单 |

### 3.1 申请

Request:

```json
{ "request_type": "use" | "download", "reason": "…" }
```

Rules:

- L3 + `download` → 400（不支持）  
- L1 + 任意申请 → 400（无需申请）  
- 已有同类型 `pending` → 200 返回已有记录（幂等）  
- 已有 `approved` → 200 提示已授权  

### 3.2 决定

Request: `{ "decision": "approve" | "reject", "note": "…" }`  
`reject` 时 `note` 必填。

### 3.3 403 信封

所有技能门禁失败统一：

```json
{
  "detail": {
    "code": "skill_access_denied",
    "message": "人类可读说明",
    "skill_slug": "…",
    "access_level": "L2" | "L3",
    "denied_action": "invoke" | "download" | "read_body",
    "next_actions": [
      { "type": "request_use" | "request_download" | "frontend_user_link", "label": "…", "url": "可选" }
    ]
  }
}
```

映射：

| 场景 | denied_action | next_actions.type |
|------|---------------|-------------------|
| L3 无 use | invoke | request_use |
| L2 无 download | download | request_download |
| L3 读全文未授权 | read_body | request_use |

## 4. 数据模型

### 4.1 `skill_access_grants`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | |
| tenant_id | TEXT | INDEX | |
| skill_id | TEXT | INDEX | |
| grantee_user_id | TEXT | INDEX | |
| grant_type | TEXT | | use / download |
| status | TEXT | INDEX | pending/approved/rejected/revoked |
| reason | TEXT | | 申请理由 |
| decision_note | TEXT | NULL | |
| decided_by | TEXT | NULL | |
| decided_at | DATETIME | NULL | |
| created_at | DATETIME | | |

Unique 部分索引：同一用户同一 skill 同一 `grant_type` 仅一条 `pending`。

### 4.2 `skill_access_whitelist`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | |
| tenant_id | TEXT | | |
| skill_id | TEXT | INDEX | |
| principal_type | TEXT | | `user`（MVP）/ `department`（后置） |
| principal_id | TEXT | | user_id |
| grant_type | TEXT | | use / download / both |

### 4.3 主表字段

`access_level`, `secure_content_enabled`, `allow_local_download` — 见 skills-003-runtime §4.1。

## 5. 核心流程

### 5.1 判定函数（伪代码）

```
can_invoke(user, skill):
  if is_author_or_admin: return True
  if skill.access_level in (L1, L2): return True
  if whitelisted(user, use|both): return True
  if has_grant(user, use, approved): return True
  return False

can_download(user, skill):
  if skill.access_level == L3 or not skill.allow_local_download: return False
  if is_author_or_admin: return True
  if skill.access_level == L1: return True
  # L2
  if whitelisted(user, download|both): return True
  if has_grant(user, download, approved): return True
  return False

can_read_full_body(user, skill):
  if not skill.secure_content_enabled: return can_invoke(...)
  if skill.access_level != L3: return can_invoke(...)
  return can_invoke(...)  # L3 同调用权
```

### 5.2 挂载点

| 端点 | 检查 |
|------|------|
| `GET .../runtime` | can_invoke |
| `GET .../files/*` | can_invoke |
| `POST .../run` | can_invoke |
| `GET .../download` | can_download |
| `GET .../skill-md` | can_read_full_body；否则返回摘要 |

## 6. 安全

- 审批权：技能 `author_user_id` 或租户 admin（auth-001）  
- 撤销立即生效（下次请求读 DB，不做长期缓存 grant）  
- 审计：grant 状态变更写 event_log（可选但推荐）  
- 防止申请人 escalate：不可自批  

## 7. 与 PRD 的差异

| PRD | 首期 | 后置 |
|-----|------|------|
| 部门/项目白名单 | 仅 user | department |
| 通知中心 | Toast + 列表状态 | 飞书/邮件 |
| 批量审批 | 不做 | — |

## 8. 文件落点

```
backend/app/general_skills/access.py
backend/app/api/general_skills_access.py   # 或并入 general_skills.py
backend/app/db/models.py                   # grants + whitelist
src/components/SkillAccessRequestDialog.tsx
src/components/SkillAccessAdminPanel.tsx
```
