---
id: policy-001-api
title: 规则策略包 API
type: tech-spec
related: [policy-001]
---

# 规则策略包 API

## 概述

实现 policy-001 的持久化与 `resolved` 解析接口，供 Kilo 等客户端同步。

## 设计目标

- create_all 建表，种子可演示  
- resolved 一次返回全文，减少往返  
- 鉴权与现有 enterprise API 一致（Bearer / bba2a_*）  

## API 设计

### GET /api/enterprise/policy/resolved

Query: `tenant_id`（必填）, `project_key`, `mode`, `expert_id`

Response:

```json
{
  "tenant_id": "tenant_demo",
  "project_key": "github.com/org/app",
  "mode": null,
  "expert_id": null,
  "policy_version": "sha256:...",
  "packs": [
    {"id": "...", "slug": "org-baseline", "name": "...", "kind": "org_baseline", "version": "1.0.0"}
  ],
  "rules": [
    {
      "id": "...",
      "slug": "no-secrets",
      "title": "...",
      "body_md": "...",
      "severity": "required",
      "content_hash": "...",
      "source_pack_slug": "org-baseline",
      "source_kind": "org_baseline"
    }
  ]
}
```

### GET /api/enterprise/policy/rules?tenant_id=

### POST /api/enterprise/policy/rules

Body: slug, title, body_md, severity?, status?

### GET /api/enterprise/policy/packs?tenant_id=

### POST /api/enterprise/policy/packs

Body: slug, name, description?, kind, rule_slugs[]|rule_ids[], version?

### GET /api/enterprise/policy/bindings?tenant_id=

### POST /api/enterprise/policy/bindings

Body: pack_id|pack_slug, target_type, target_key, priority?, enabled?

## 数据模型

| 表 | 字段 | 约束 | 说明 |
|---|---|---|---|
| policy_rules | id PK, tenant_id, slug, title, body_md, severity, status, content_hash, timestamps | idx(tenant,slug) | 原子规则；同 slug 可多行，由 Pack 引用，resolved 时高优先覆盖 |
| policy_rule_packs | id PK, tenant_id, slug, name, description, kind, rule_ids_json, version, timestamps | uq(tenant,slug) | 策略包 |
| policy_bindings | id PK, tenant_id, pack_id, target_type, target_key, priority, enabled, timestamps | idx tenant+type+key | 绑定 |

## 核心流程

1. 收集绑定：tenant 全体 + project_key 精确匹配 + mode + expert_id  
2. 按 kind 优先级与 binding.priority 排序 Pack  
3. 展开 rule_ids；同 slug 后者（更高优先）覆盖  
4. policy_version = sha256(拼接 pack.version + rule content_hash)  

## 安全

- 需登录；tenant_id 须与当前用户租户一致（ensure）  
- 写接口建议 admin（MVP：登录用户可写 demo；后续收紧）  

## 与 PRD 的差异

- 本迭代管理 UI 可缺省，以 API + seed 验收  
- 平台引导 `agent-rules/*.mdc` 仍独立，不并入 policy_rules  
