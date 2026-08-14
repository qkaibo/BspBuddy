---
id: skills-002
title: 技能访问分级与授权（L1 / L2 / L3）
type: prd
related: [skills-001, skills-003, agents-002, auth-001, skills-hub-capability-inventory, skills-002-api]
---

## 概述

为企业技能定义 **L1 / L2 / L3 访问级别**，把「能否调用 / 安装壳」与「能否下载完整包」拆开，并提供申请—审批闭环。解决公司核心技能不能无差别 ZIP 外流、又要让 Agent 可调用的矛盾。

身份与角色以 auth-001 为准；本 PRD 只管**技能资源级** ACL。

## 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 技能作者 | 发布时选 L2：同事可调用，下载需审批 | 防整包外传 |
| 技能作者 | 发布 L3：仅白名单/审批后可调用，禁止下载 | 核心资产 |
| 工程师 | 对 L3 点「一键安装」被拦，一键申请使用 | 不靠私下传包 |
| 作者/管理员 | 在申请列表批准或拒绝 | 可控授权 |
| Agent（经 skills-003） | runtime 返回 403 + next_actions | 引导人类审批，不猜权限 |

## 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 访问级别 | 技能级 `access_level`: `L1` / `L2` / `L3` |
| 2 | 调用门禁 | runtime、加入库后的 Agent 执行、安装壳 |
| 3 | 下载门禁 | ZIP、`install-bundle`、导出全文包 |
| 4 | 申请使用 | L3：`request_type=use` |
| 5 | 申请下载 | L2（及策略允许时）：`request_type=download` |
| 6 | 审批 | 作者或租户管理员批准/拒绝；可附理由 |
| 7 | 白名单 | 可选：部门/用户/项目预授权（MVP 可先做用户邮箱/用户 ID） |
| 8 | 受控正文 | L3 未授权：详情只显示摘要，不展示完整 SKILL.md |
| 9 | 错误信封 | API 403 返回机器可读 `next_actions`，供 UI 与 Agent |

## 数据模型

| 实体 | 关键字段 |
|------|---------|
| `GeneralSkill.access_level` | `L1` \| `L2` \| `L3` |
| `GeneralSkill.secure_content_enabled` | bool；默认 true |
| `GeneralSkill.allow_local_download` | bool；L3 强制 false |
| `SkillAccessGrant` | `id`, `skill_id`, `grantee_user_id`, `grant_type`（`use` / `download`）, `status`（`pending` / `approved` / `rejected` / `revoked`）, `reason`, `decided_by`, `decided_at` |
| `SkillAccessWhitelist` | `skill_id`, `principal_type`（`user` / `department`）, `principal_id` |
| 兼容旧值 | `public`→L1；`restricted`/`private`/`department_only`→L3 |

### 权限矩阵

| 级别 | 登录后调用 / 装壳 / runtime | ZIP 下载 | 完整 SKILL.md 预览 |
|------|------------------------------|----------|-------------------|
| L1 | ✅ | ✅ | ✅ |
| L2 | ✅ | 需 `download` 授权或白名单 | ✅（可调用即可读指令） |
| L3 | 需 `use` 授权或白名单 | ❌ 永久禁止 | 仅授权后 ✅；否则摘要 |

作者与租户 admin：始终可管理、可预览、可下载（审计记下）。

## 页面与字段

### 发布/编辑时的访问级别（嵌入 skills-001 表单）

#### 布局

```
┌────────────────────────────────────────────┐
│ 访问级别                                   │
│ (•) L1 公开可下载                          │
│ ( ) L2 可调用，下载需授权                  │
│ ( ) L3 仅授权可调用，禁止下载              │
│ 说明文案随选项切换                         │
│ 白名单（L2/L3）：[添加用户…]               │
└────────────────────────────────────────────┘
```

#### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| access_level | enum | 是 | L1/L2/L3 |
| whitelist_user_ids | id[] | 否 | L2/L3 预授权 |
| secure_content_enabled | bool | 是 | 默认 true |

### 申请授权弹窗

#### 布局

```
┌──────────────────────────────────────┐
│ 申请使用「slug」                 [X] │
│ 类型: 使用授权 (L3) / 下载授权 (L2)  │
│ 理由 [________________________]      │
│ 提示: 审批通过后可重试原操作         │
│           [取消] [提交申请]          │
└──────────────────────────────────────┘
```

#### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| request_type | enum | 是 | `use` / `download` |
| reason | string | 是 | 最长 500 |

#### 交互

- 提交 → `pending` → Toast「已提交，等待审批」→ 详情页显示「审批中」  
- 重复提交同类型 pending：幂等，提示已有申请  

### 作者审批列表（详情「成员/授权」或仪表盘子页）

#### 布局

```
┌──────────────────────────────────────────────────────────┐
│ 授权申请 · slug                                          │
│ [待处理] [已通过] [已拒绝]                                │
│ 用户A  使用  理由…  [批准] [拒绝]                         │
│ 用户B  下载  理由…  [批准] [拒绝]                         │
└──────────────────────────────────────────────────────────┘
```

#### 交互

- [批准] → `approved` → 写 grant → 通知申请人（桌面内提示即可）  
- [拒绝] → 必填拒绝理由 → `rejected`  
- [撤销]（已通过）→ `revoked` → 下次调用立即 403  

### 详情页徽章与门禁文案

| 状态 | UI |
|------|-----|
| L1 | 徽章「L1 公开可下载」 |
| L2 未获下载权 | 下载按钮旁「需申请下载」 |
| L3 未获使用权 | 一键安装/runtime 主按钮变为「申请使用」 |
| L3 | 不展示下载 ZIP |

## API 依赖

| 端点（规划） | 触发场景 |
|--------------|----------|
| `POST /api/enterprise/general-skills/{slug}/access-requests` | 提交申请；body: `request_type`, `reason` |
| `GET /api/enterprise/general-skills/{slug}/access-requests` | 作者查看 |
| `POST /api/enterprise/general-skills/{slug}/access-requests/{id}/decide` | 批准/拒绝 |
| `DELETE .../grants/{id}` | 撤销 |
| `PUT .../whitelist` | 维护白名单 |
| runtime / download | 已有或 skills-003；必须返回统一 403 信封 |

### 403 信封（产品契约）

```json
{
  "detail": {
    "code": "skill_access_denied",
    "message": "L3：需要使用授权",
    "skill_slug": "example-skill",
    "access_level": "L3",
    "next_actions": [
      { "type": "request_use", "label": "申请使用" },
      { "type": "frontend_user_link", "url": "bspbuddy://skills/example-skill/request-access" }
    ]
  }
}
```

规则：

- L2 下载失败 → `next_actions` 含 `request_download`，**不要**当成 L3 use  
- L3 调用失败 → `request_use`  
- UI 与 Agent **禁止**凭文案猜 URL，只使用信封字段  

## 页面关系

- **From:** skills-001 详情下载/预览；skills-003 runtime/安装  
- **To:** 审批列表；申请成功后回到原操作  
- **数据耦合:** grant 变更立即影响 runtime 与 ZIP；与 auth-001 用户身份对齐  

## 验收标准

- [x] L1 技能：登录用户可调用、可下载、可预览 SKILL.md — `selftest_skills_phase_b`
- [x] L2 技能：未授权可调用；下载返回 403 信封并可提交 download 申请；批准后可下载 — phase B
- [x] L3 技能：未授权不可 runtime/一键安装；无下载按钮；批准 use 后可调用仍无下载 — phase B/C
- [x] 作者可批准/拒绝/撤销；撤销后再次 403 — API + 商店「授权审批」UI
- [x] 重复申请不产生重复 pending — phase B
- [x] 403 响应含 `next_actions`，前端按 type 渲染按钮 — 申请弹窗 / 安装面板已接
