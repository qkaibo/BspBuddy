# BspBuddy 文档中心

> **目的：** 产品需求与技术规格的权威来源。参考 StaffDeck 文档体系建模。
> **最后更新：** 2026-08-09

---

## 文档体系

```
docs/
├── README.md          ← 本文件（索引 + 映射表）
├── CONTEXT.md         ← 领域术语表
├── STANDARD.md        ← 文档规范标准
├── WORKFLOW.md        ← 文档生成工作流
├── prd/               ← 产品需求文档（做什么 / 为什么）
├── tech-spec/         ← 技术规格（怎么做）
├── plans/             ← 实现计划（分期任务 + 改动范围）
└── reference/         ← 参考附录（纯数据，无叙述）
```

> 治理文档：[STANDARD.md](./STANDARD.md) — 格式与内容规范 · [WORKFLOW.md](./WORKFLOW.md) — 生成流程与指令速查

**三类文档的关系：**

```
PRD                          Tech Spec
"产品要做什么"                 "技术要怎么做"
    │                            │
    ├── 每个 PRD 必须指向 ──────→ 至少一个 Tech Spec
    │                            │
    └── 补充信息 ──────────────→ Reference（API 清单、枚举字典）
```

## 文档元数据规范

每份文档必须以 YAML front matter 开头：

```yaml
---
id: prd-016
title: 专家配置管理
type: prd
related: [ts-024, ts-025]
---
```

| 字段 | 说明 |
|------|------|
| `id` | 统一编号 |
| `title` | 文档标题 |
| `type` | `prd` / `tech-spec` / `reference` |
| `related` | 交叉引用的文档 ID 列表 |

---

## Plans 索引

| # | Plan | 对应 SPEC | Phase | 状态 |
|---|------|-----------|-------|:--:|
| 01 | [task-bar](plans/01-task-bar.md) | Task-Bar | P0 | ✅ |
| 02 | [task-management](plans/02-task-management.md) | Create-Task, Task-Management | P0 | ✅ |
| 03 | [conversation](plans/03-conversation.md) | Conversation | P0 | ✅ |
| 04 | [results](plans/04-results.md) | Results | P0 | ✅ |
| 05 | [claw-assistant](plans/05-claw-assistant.md) | Claw | P3 | ❌ |
| 06 | [plugins-ecosystem](plans/06-plugins-ecosystem.md) | Plugins, Skills, MCP, Expert | P3 | ❌ |
| 07 | [project](plans/07-project.md) | Project | P3 | ❌ |
| 08 | [connector](plans/08-connector.md) | Connector | P3 | ❌ |
| 09 | [automation](plans/09-automation.md) | Automation | P3 | ❌ |
| 10 | [permission](plans/10-permission.md) | Permission | P3 | ❌ |
| 11 | [memory](plans/11-memory.md) | Memory | P3 | ❌ |
| 12 | [design-idea](plans/12-design-idea.md) | Design-Idea | P3 | ❌ |
| 13 | [mailbox](plans/13-mailbox.md) | Mailbox | P3 | ❌ |
| 14 | [inspiration](plans/14-inspiration.md) | Inspiration | P3 | ❌ |
| 15 | [cloud-agent](plans/15-cloud-agent.md) | CloudAgent | P3 | ❌ |
| 16 | [pricing](plans/16-pricing.md) | Pricing | P3 | ❌ |
| 17 | [data-settings](plans/17-data-settings.md) | Data & Settings | P3 | ❌ |
| 18 | [installation](plans/18-installation.md) | Installation | P3 | ❌ |
| 19 | [expert-management](plans/19-expert-management.md) | StaffDeck 融合 | P3 | 🟡 |

> 详情与进度看板见 [`specs/plans/README.md`](../specs/plans/README.md)

---

## PRD 索引

| ID | 标题 | 关联 Tech Spec | 状态 |
|----|------|---------------|:--:|
| prd-016 | [专家配置管理](prd/prd-016-expert-management.md) | ts-024, ts-025 | 🟡 规划中 |

---

## Tech Spec 索引

| ID | 标题 | 关联 PRD | 状态 |
|----|------|---------|:--:|
| ts-024 | 专家编辑器 | prd-016 | 🟡 待编写 |
| ts-025 | SOP 蒸馏编辑器 | prd-016 | 🟡 待编写 |
| ts-026 | 反馈系统 | — | 🟡 待编写 |

---

## Reference 索引

| ID | 标题 | 状态 |
|----|------|:--:|
| ref-004 | 枚举与状态码字典 | 🟡 待编写 |
| ref-005 | 页面关系导航图 | 🟡 待编写 |
