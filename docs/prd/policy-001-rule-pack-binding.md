---
id: policy-001
title: 规则策略包绑定与 IDE 自动同步
type: prd
related: [policy-01, policy-001-api, skills-001, agents-005]
---

# 规则策略包绑定与 IDE 自动同步

## 概述

团队规范（Rules）在 **BspBuddy 录入与绑定**，由 **Kilo / Cursor 等 IDE** 自动同步落盘。  
**不做「RulesHub 自选商店」**：RD 通常不知道该装哪些规则；规则是约束/基线，由组织或项目负责人编排后下发。

与企业技能商店对比：Skill 可逛可选；Rule Pack 绑定后默认同步。

权威产品叙述亦见 kilocode 仓库 `docs/prd/policy-001-rule-pack-binding.md`（消费端细节）。

## 用户场景

| 角色 | 场景 | 动机 |
|---|---|---|
| 管理员 | 录入红线规则，编入 org_baseline Pack，绑到租户 | RD 无法漏装 |
| TL | 项目 Pack 绑到 repo project_key | 打开工程即对齐 |
| RD | 打开 IDE，无感获得规则 | 不选型 |
| RD | 切换 Mode / 选专家 | 叠加对应 Pack |

## 功能清单

| # | 功能 | 说明 |
|---|---|---|
| 1 | Rule 原子 | slug、title、body_md、severity、status |
| 2 | Rule Pack | kind + 有序 rule_ids + version |
| 3 | Policy Binding | tenant / project / mode / expert |
| 4 | Resolved API | 给定上下文返回有序规则全文 + policy_version |
| 5 | 管理 CRUD（MVP） | 列表/创建规则与 Pack、绑定（供种子与管理） |

**不做：** RD 面向规则货架；用 Git 互拷作为真相源。

## 数据模型

| 实体 | 关键字段 |
|---|---|
| PolicyRule | id, tenant_id, slug, title, body_md, severity, status, content_hash, updated_at |
| PolicyRulePack | id, tenant_id, slug, name, description, kind, rule_ids_json, version, updated_at |
| PolicyBinding | id, tenant_id, pack_id, target_type, target_key, priority, enabled |

优先级：org_baseline → project → mode → expert（同 slug 高优先覆盖；允许同 slug 多行规则，由不同 Pack 引用）。

## 页面与字段（核心）

### Resolved 消费（IDE）

#### 布局

（客户端面板，见 Kilo PRD；本仓提供 API。）

#### 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| tenant_id | string | 是 | 查询参数 |
| project_key | string | 否 | 规范化 remote 或指纹 |
| mode | string | 否 | Mode slug |
| expert_id | string | 否 | A2A agent id |

### 管理（BspBuddy，本迭代可 API-only）

#### 布局

```
[规则库] [策略包] [绑定]
```

## API 依赖

| 端点 | 触发场景 |
|---|---|
| `GET /api/enterprise/policy/resolved` | IDE 同步 |
| `GET/POST /api/enterprise/policy/rules` | 管理 |
| `GET/POST /api/enterprise/policy/packs` | 管理 |
| `GET/POST /api/enterprise/policy/bindings` | 管理 |

详见 tech-spec `policy-001-api`。

## 页面关系

- **From:** IDE 打开工程；BspBuddy 管理端  
- **To:** IDE `.kilo/rules/bspbuddy/`  
- **数据耦合:** Mode、A2A Expert 选中  

## 验收标准

- [x] seed 后 `resolved` 对 tenant_demo 返回 ≥2 条规则（含 org baseline）
- [x] 带 project_key 时叠加项目 Pack  
- [x] 带 mode/expert 时按绑定叠加  
- [x] 同 slug 冲突时高优先级正文胜出  
- [x] 未认证 401  
- [x] 与 `agent-rules/bspbuddy-skills.mdc` 路径分离（平台引导 ≠ 业务策略）  
