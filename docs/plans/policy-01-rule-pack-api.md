---
id: policy-01
title: 规则策略包 API 与种子
type: plan
related: [policy-001, policy-001-api]
---

# Plan: 规则策略包 API 与种子

## 目标

落地 policy-001 后端：表 + resolved + 最小 CRUD + demo seed。

## 分期

### Phase A（本迭代）

| 批次 | 内容 | 路径 |
|---|---|---|
| 1 | 文档 PRD/TS/Plan | `docs/prd|tech-spec|plans` |
| 2 | models | `backend/app/db/models.py` |
| 3 | schema + router | `backend/app/policy/`, `backend/app/api/policy.py` |
| 4 | seed | `backend/app/db/seed.py` |
| 5 | selftest | `scripts/selftest_policy_phase_a.py` |

### Phase B

- 管理端 UI  
- project_key 规范化工具  
- 写接口 admin-only  

## 验收

见 PRD 验收标准；跑 `python scripts/selftest_policy_phase_a.py`。

Phase A：✅（L2 selftest）
  
