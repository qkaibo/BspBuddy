# BspBuddy 文档中心

> **目的：** 产品需求与技术规格的权威来源。参考 StaffDeck 文档体系建模。
> **最后更新：** 2026-08-09（新增 settings-002 专家模型目录 PRD/Tech Spec/Plan）

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
id: agents-001
title: 专家配置管理
type: prd
related: [agents-001-api]
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
| 10 | [permission](plans/10-permission.md) | Agent Permission Modes（工具沙箱；RBAC 见 auth-01） | P3 | ❌ |
| 11 | [memory](plans/11-memory.md) | Memory | P3 | 🟡 |
| 12 | [design-idea](plans/12-design-idea.md) | Design-Idea | P3 | ❌ |
| 13 | [mailbox](plans/13-mailbox.md) | Mailbox | P3 | ❌ |
| 14 | [inspiration](plans/14-inspiration.md) | Inspiration | P3 | ❌ |
| 15 | [cloud-agent](plans/15-cloud-agent.md) | CloudAgent | P3 | ❌ |
| 16 | [pricing](plans/16-pricing.md) | Pricing | P3 | ❌ |
| 17 | [data-settings](plans/17-data-settings.md) | Data & Settings | P3 | 🟡 |
| 17-1 | [model-config](plans/settings-01-model-config.md) | AI 模型配置 BYOK/租户共享（settings-001）；本机 key 直连 vs 后端代理分流 | P3 | 🟡 |
| 17-2 | [expert-model-catalog](plans/settings-02-expert-model-catalog.md) | 专家模型目录（settings-002）：独立于用户 ModelConfig，admin 统一维护，全局共享。含 is_default 默认模型 | P0 | ✅ |
| 18 | [installation](plans/18-installation.md) | Installation | P3 | ❌ |
| 19 | [expert-management](plans/agents-01-expert-management.md) | StaffDeck 融合 | P3 | 🟡 |
| 19-1 | [expert-resource-bind](plans/agents-01-1-editor-ux.md) | 专家资源绑定（StaffDeck Scope） | P0 | ✅ |
| 19-2 | [bindings-sync](plans/agents-01-2-bindings-sync.md) | 本地绑定同步到后端 AgentResourceBinding | P0 | ⚒️ |
| 19-3 | [model-binding](plans/agents-01-3-model-binding.md) | 专家模型绑定（前端层，依赖 settings-002） | P0 | ✅ |
| 20 | [sop-management](plans/agents-02-sop-management.md) | SOP 创作台（agents-003）；Phase E 桌面 actor 过滤可演示（身份从属 auth-001） | P3 | 🟡 |
| 21 | [access-control](plans/auth-01-access-control.md) | 全产品身份 / RBAC（auth-001）；Phase A–C 桌面可演示；与 plan 10 沙箱分轨 | P3 | 🟡 |
| 22 | [multi-platform-architecture](plans/architecture-01-multi-platform.md) | 多端统一架构（桌面/Web/移动）：后端 LLM 代理 + 能力门禁 | P0 | 🟡 |
| 23 | [local-agent-runtime](plans/23-local-agent-runtime.md) | 本地 Agent 运行时（Python Sidecar + ReAct + Tool Use）| P0 | 🟡 |
| 24 | [a2a-delegation](plans/agents-03-a2a-delegation.md) | A2A 专家委托协议：本地 Sidecar → 服务器端专家 Agent 委托 | P0 | 🟡 |

> 进度看板即上表。`specs/` 已废弃，勿再引用。  
> **权限分轨：** [auth-01](plans/auth-01-access-control.md) = 身份+RBAC+资源 ACL 的身份来源；[10-permission](plans/10-permission.md) = Agent Permission Modes（工具沙箱）。勿混名。


---

## PRD 索引

| ID | 标题 | 关联 Tech Spec | 状态 |
|----|------|---------------|:--:|
| agents-001 | [专家配置管理](prd/agents-001-expert-management.md) | agents-001-api | 🟡 规划中 |
| agents-002 | [专家资源 — StaffDeck Scope 工作台](prd/agents-002-editor-ux.md) | agents-001-api | 🟡 进行中 |
| agents-003 | [SOP 创作与管理](prd/agents-003-sop-management.md) | agents-002-sop | 🟡 进行中（列表+编辑器 MVP；桌面 owner 过滤可演示） |
| auth-001 | [全产品身份与访问控制](prd/auth-001-access-control.md) | auth-001-api | 🟡 桌面 Phase1 可演示（本地会话+成员 UI+SOP 对接） |
| settings-001 | [AI 模型配置（BYOK / 租户共享）](prd/settings-001-model-config.md) | — | 🟡 规划中 |
| settings-002 | [专家模型目录](prd/settings-002-expert-model-catalog.md) | settings-002 | ✅ 已完成（含 is_default 默认模型） |
| agents-004 | [A2A 专家委托协议](prd/agents-004-a2a-delegation.md) | agents-03 | 🟡 规划中 |

---

## Tech Spec 索引

| ID | 标题 | 关联 PRD | 状态 |
|----|------|---------|:--:|
| agents-001-api | 专家编辑器 | agents-001, agents-002 | 🟡 待编写 |
| agents-002-sop | [SOP 蒸馏编辑器与技能库](tech-spec/agents-002-sop.md) | agents-003, agents-001, agents-002 | 🟡 本地库+actor 过滤可演示 / SSE 与云端 grants 待接 |
| agents-003-feedback | 反馈系统 | — | 🟡 待编写 |
| agents-004-agent-loop | [专家执行环路](tech-spec/agents-004-agent-loop.md) | agents-002, runtime-01 | ✅ |
| auth-001-api | [会话身份与 RBAC](tech-spec/auth-001-session-and-rbac.md) | auth-001 | 🟡 桌面本地会话已实现 / JWT 云端对齐待接 |
| settings-002 | [专家模型目录](tech-spec/settings-002-expert-model-catalog.md) | settings-002 | ✅ 已完成 |

---

## Reference 索引

| ID | 标题 | 状态 |
|----|------|:--:|
| ref-001 | [UI 设计原则](reference/ref-001-ui-design-principles.md) | ✅ |
| ref-004 | 枚举与状态码字典 | 🟡 待编写 |
| ref-005 | 页面关系导航图 | 🟡 待编写 |
