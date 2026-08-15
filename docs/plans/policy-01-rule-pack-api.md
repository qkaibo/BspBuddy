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

| 批次 | 内容 | 路径 |
|---|---|---|
| 1 | 管理端 UI 三 Tab + resolved 预览 | `src/components/PolicyPanel.tsx` |
| 2 | IPC | `types.ts` / `ipc-handlers.ts` |
| 3 | 侧栏入口「更多 → 策略」 | `Sidebar.tsx` / `App.tsx` |

### Phase B2（易用性）

| 批次 | 内容 | 路径 |
|---|---|---|
| 1 | PRD：四 Tab + 主从 + 中文标签 | `docs/prd/policy-001-rule-pack-binding.md` |
| 2 | 主从布局 / 步骤条 / 自动 slug / 高级折叠 | `src/components/PolicyPanel.tsx` |
| 3 | 独立「效果预览」Tab | 同上 |

后续：project_key 规范化工具；写接口 admin-only。

## 验收

见 PRD 验收标准；跑 `python scripts/selftest_policy_phase_a.py`。

Phase A：✅（L2 selftest）  
Phase B：✅ 管理端 UI（更多 → 策略；IPC + PolicyPanel）  
Phase B2：✅ 易用性（主从 + 标题/Tab 同行 + 效果预览 Tab）
  
