# 文档规范标准 v1.0

> 适用于 `docs/` 目录下所有文档的组织、编写和维护。
>
> **配套文档：** [WORKFLOW.md](./WORKFLOW.md) — 用什么 Skill/工具、按什么顺序生成这些文档。

---

## 一、目录结构

```
docs/
├── README.md           ← 文档索引中心（必须）
├── CONTEXT.md          ← 领域术语表，定义 Ubiquitous Language
├── STANDARD.md         ← 本文件，文档规范标准
├── WORKFLOW.md         ← 文档生成工作流
├── prd/                ← 产品需求文档
│   ├── prd-001-xxx.md
│   └── ...
├── tech-spec/          ← 技术规格
│   ├── ts-001-xxx.md
│   └── ...
├── plans/              ← 实现计划（分期任务 + 改动范围 + 提交批次）
│   ├── 01-xxx.md
│   └── ...
└── reference/          ← 纯数据参考（API 清单、枚举字典、页面流程）
    ├── ref-001-xxx.md
    └── ...
```

**原则：**
- 一种类型一个子目录，不混放
- 每个文档一个文件，不合并
- 治理文档（STANDARD / WORKFLOW）直接放在 `docs/` 根，不另建子目录

---

## 二、命名规范

### 文件命名

采用**领域分段编号**：

```
{domain}-{NNN}-{slug}.md
```

| 组件 | 说明 | 示例 |
|------|------|------|
| domain | 功能域前缀 | agents, chat, automation, plugins, auth |
| NNN | 域内三位序号（不跨域比较，域内独立编号） | 001, 002 |
| slug | 英文短横线描述 | expert-management, editor-ux |

### 文档类型路径

| 类型 | 路径 | 编号格式 |
|------|------|---------|
| PRD | docs/prd/{domain}-{NNN}-{slug}.md | 域内三位，如 agents-001 |
| Tech Spec | docs/tech-spec/{domain}-{NNN}-{slug}.md | 域内三位，如 agents-001 |
| Reference | docs/reference/{domain}-{NNN}-{slug}.md | 域内三位，如 agents-001 |
| Plan | docs/plans/{domain}-{NN}-{slug}.md | 域内两位，如 agents-01 |

### 规则

- **域内不跳号**——agent 域内 agents-001, agents-002 连续；chat 域内 chat-001, chat-002 独立
- **跨域不冲突**——不同域的编号互不影响
- **Plan 子编号用横线追加**——agents-01-1 表示 agents-01 的子 plan

### 示例

```
docs/prd/
├── agents-001-expert-management.md     ← agent 域第 1 个 PRD
├── agents-002-editor-ux.md             ← agent 域第 2 个 PRD
├── chat-001-conversation.md            ← chat 域第 1 个 PRD

docs/plans/
├── agents-01-expert-management.md      ← agent 域实现计划
├── agents-01-1-editor-ux.md            ← agent-01 的子计划
```

### 理由

传统 `prd-017` 全局序号的问题：
- 序号无语义信息，无法一眼看出属于哪个功能域
- 多人并行开发时必然冲突（都抢下一个序号）
- 与 ADR（Architecture Decision Records）混淆——ADR 用全局序号是合理的（时间顺序追加），但 PRD 是功能域文档，不是时间序列

领域分段编号的好处：
- 领域一眼可见
- 并行开发不冲突
- 域内序号独立管理，不跳号

---

## 三、元数据规范（YAML Front Matter）

每个文档文件**必须以 YAML front matter 开头**：

```yaml
---
id: agents-001         # 唯一标识，等于文件名不含 .md
title: 数字员工管理     # 中文标题
type: prd              # prd | tech-spec | plan | reference
related: [agents-001-api]  # 关联文档 ID 列表，无关联写 []
---
```

**作用：**
- 支持 `docs/README.md` 自动索引
- 支持 AI 按 `related` 追溯关联文档
- 支持工具脚本按 `type` 分类

---

## 四、PRD 模板

### 必须覆盖 8 个章节（顺序不可变）

```markdown
## 概述
一句话描述这个模块是什么、解决什么问题。

## 用户场景
| 角色 | 场景 | 动机 |
|------|------|------|

## 功能清单
| # | 功能 | 说明 |
|---|------|------|

## 数据模型
| 实体 | 关键字段 |
|------|---------|

## 页面与字段（核心）
### {页面一名称}（路由）
#### 布局
（ASCII 布局图，必含）

#### 字段
（完整字段表，必含类型/必填/选项/默认/来源/说明）

### {页面二名称}（路由）
（同上）

## API 依赖
| 端点 | 触发场景 |
|------|---------|

## 页面关系
- **From:** 从哪里进入
- **To:** 可以跳转到哪里
- **数据耦合:** 影响哪些其他页面

## 验收标准
- [ ] checklist 格式
```

### PRD 内容规则

| 规则 | 要求 |
|------|------|
| ASCII 布局图 | 每个页面必须有 |
| 字段表最少列 | 字段/类型/必填/说明（至少 4 列） |
| 交互链 | 用 `→` 连接，如"点击 [按钮] → API 调用 → Toast 成功 → 刷新列表" |
| 数据来源 | 字段表须标注来源（API 字段名/数据库列名） |
| 按钮权限 | 每个操作按钮标注显示条件（owner/admin/scope manager 等） |
| 真实数据 | 不虚构字段——对照代码中的真实模型 |

---

## 五、Tech Spec 模板

### 必须覆盖 7 个章节

```markdown
## 概述
技术范围与目标。

## 设计目标
技术约束、权衡、非功能需求。

## API 设计
端点列表、请求/响应 Schema、认证方式。

## 数据模型
完整表结构（字段/类型/约束/索引/说明）。

## 核心流程
时序图或状态机描述。

## 安全
加密方式、权限模型、租户隔离。

## 与 PRD 的差异
列举实现与需求的偏差（如有）。
```

### Tech Spec 内容规则

- 表结构必须包含：字段名、类型、约束（PK/INDEX/NULL/NOT NULL）、说明
- API 必须包含：Method、Path、Request Schema、Response Schema
- 流程描述用编号步骤或状态图，不用自然语言叙述

---

## 六、Reference 文档

| 类型 | 内容 | 更新频率 |
|------|------|---------|
| `ref-001-api-endpoints.md` | 全部 API 端点清单（Method/Path/权限/说明） | API 变更时 |
| `ref-002-enum-dictionary.md` | 所有枚举值、状态码、常量 | 枚举增删时 |
| `ref-003-page-flow.md` | 页面导航关系、URL 参数、事件总线 | 路由变更时 |

Reference 是纯数据，不包含流程描述或设计意图。

---

## 七、README.md 索引格式

`docs/README.md` 是文档入口，内容结构：

```markdown
# {项目名} 文档

## 文档类型说明
| 类型 | 目标读者 | 内容 |
|------|---------|------|
| PRD | 产品/用户 | 功能+页面+交互 |
| Tech Spec | 开发者 | API+数据库+流程 |
| Plan | 开发者 | 分期任务+改动范围+提交批次 |
| Reference | 全角色 | 清单/字典/关系 |

## Plans
| # | Plan | 状态 |
|---|------|:--:|

## PRD
| ID | 标题 | 关联 |
|----|------|------|

## Tech Spec
| ID | 标题 | 关联 |
|----|------|------|

## Reference
| ID | 标题 | 说明 |
|----|------|------|
```

---

## 八、关联规则

`related` 字段用于建立文档间关联：

- PRD 关联其涉及的 Tech Spec：`related: [agents-001-api, agents-002-db]`
- Tech Spec 关联其服务的 PRD：`related: [agents-001]`
- Reference 通常不填 related（因为它是纯数据）
- 无关联时写 `related: []`

**常见关联模式：**

| PRD | 对应 Tech Spec |
|-----|---------------|
| agents-001（数字员工） | agents-002-api（数据库）、agents-003-branch（分支系统） |
| chat-001（聊天） | chat-001-api（API）、chat-002-frontend（前端）、chat-003-handoff（交接） |
| tools-001（工具） | tools-001-sandbox（沙箱）、tools-002-discovery（能力发现）、tools-003-execution（工具执行） |

---

## 九、CONTEXT.md 规范

领域术语表，定义项目的 Ubiquitous Language。

格式：

```markdown
# {项目名} 领域术语

## 核心实体

### {实体名}
- 定义：一句话描述
- _Avoid_ {容易混淆的别名}
- 关键词：({关键属性列表})
```

每条包含：当前唯一名称、一句话定义、避免使用的别名、关键属性。

---

## 十、迁移检查清单

如果是从旧文档迁移到新规范：

- [ ] 旧 `specs/` 合并到 `docs/tech-spec/` 或删除
- [ ] 旧 `prd/` 合并到 `docs/prd/` 或删除
- [ ] 旧 `plans/` 合并到 `docs/plans/` 或删除
- [ ] 每个文件添加 YAML front matter（id/title/type/related）
- [ ] 每个 PRD 补全 ASCII 布局图
- [ ] 字段表补全类型/必填/来源列
- [ ] `docs/README.md` 更新为新的索引格式
- [ ] 删除所有 obsolete 目录（确保无遗漏）

---

## 附录：完整示例

参考本项目的 `docs/prd/agents-001-expert-management.md`（PRD 完整示例）和 `docs/tech-spec/agents-001-api.md`（Tech Spec 完整示例）。
