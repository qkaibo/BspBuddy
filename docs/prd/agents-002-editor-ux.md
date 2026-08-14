---
id: agents-002
title: 专家资源 — StaffDeck Scope 工作台
type: prd
related: [agents-001, agents-003, agents-001-api, skills-001, skills-002, skills-003]
---

## 1. 概述

对齐 StaffDeck：**先选专家（scope），再在资源页管理该专家已有的资源**。

禁止在专家编辑器或「全库勾选绑定弹窗」里给员工硬绑几百条资源。

### 资源管理模型对比

| 资源类型 | 管理模型 | 操作语义 | 类比 |
|---|------|------|------|
| SOP（流程） | **复制模型** | 创作→发布→从广场/同事复制到专家 | 文档：写一次，分享给多人 |
| General Skill（技能） | **个人安装模型** | 创建者可见→按需安装到自己的专家 | 个人工具库：自己创建，自己管理，安装到自己的专家 |
| MCP 服务器 | **直接配置** | URL+名称+测试连接→直接添加到专家 | 连接器：URL 配置，手动添加 |
| 知识库 | 复制模型（同 SOP） | 从广场/同事复制 | 同 SOP |
| AI 模型 | **独立绑定（ExpertModelCatalog）** | 专家从管理员维护的模型目录中选择一个，普通用户只读 | 独立于用户个人 ModelConfig，全局模型目录 |

### 本文档范围

| 能力 | 本文档 (agents-002) | agents-003 |
|------|---------------------|------------|
| 当前专家下已有 SOP 列表 | ✅ | — |
| SOP：从广场/同事复制到专家 | ✅ | — |
| SOP：新建 / 蒸馏 / 编辑内容 / 发布 | ❌ | ✅ |
| 通用技能：个人目录 + 安装/卸载 | ✅ | — |
| 企业技能商店发现 / L1–L3 / Agent 一键安装与 runtime | ❌ 见 skills-001～003 | — |
| MCP：直接添加 + 测试连接 + 移除 | ✅ | — |
| AI 模型：绑定/更换专家专属模型 | ✅ | — |

---

## 2. 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 配置者 | 选中「法务小助」→ 打开 SOP → 只看他已有的流程 | 子集工作，不怕量大 |
| 配置者 | 从广场搜索「报销」复制 2 条到当前专家 | 按需导入，可搜索 |
| 配置者 | 从「成熟同事」复制整包 SOP | 新员工快速成型 |
| 配置者 | 打开通用技能 → 浏览我的技能 → 点击「安装」到专家 | 像管理个人工具一样管理专家技能 |
| 配置者 | 添加 MCP 服务器到专家 → 填入 URL → 测试连接 | 直接配置，无需复制 |
| 配置者 | 卸载专家已安装的技能 | 维护已有列表 |
| 配置者 | 移除专家的 MCP 服务器 | 维护已有列表 |
| 配置者 | 点击技能的「编辑」按钮 → 修改名称/描述/脚本/权限 | 创建后继续完善技能内容 |
| 配置者 | 编辑专家 → 切换到「模型」Tab → 选择模型 → 保存 | 每个专家绑定专属 LLM，对话时自动切换 |

---

## 3. 功能清单

| # | 功能 | 组件 | 说明 |
|---|------|------|------|
| 1 | 专家 Scope | `expert-scope` + `useExpertScope` | localStorage + 事件，资源页共用 |
| 2 | SOP 工作台 | `SopSkillsPanel` | 当前专家下拉 + 已有列表 + 搜索 |
| 3 | SOP 从广场复制 | `ResourceImportDialog` | 目标=当前 scope；可搜索；排除已有 |
| 4 | SOP 从其他专家复制 | 同上 | 来源=其他专家已有/已发布 |
| 5 | 通用技能目录 | `SkillsPanel` | **个人技能目录**（仅创建者可见）：已安装+可安装列表 |
| 6 | 通用技能安装/卸载 | 同上 | 一键安装到当前专家 / 卸载 |
| 7 | MCP 工作台 | `McpPanel` | 当前专家已绑定 MCP 列表 + 添加表单（URL+名称+测试连接） |
| 8 | MCP 从其他专家复制 | `McpPanel` + `ResourceImportDialog` | 按需从其他专家复制 MCP 配置 |
| 9 | 移除 | `resource:unbind` | 从当前专家 bindings 去掉 |
| 10 | 入口 | ExpertCenter「管理 SOP」「管理 Skill」「管理 MCP」 | 设 scope → 打开插件对应 Tab |
| 11 | 编辑器收敛 | `ExpertEditorModal` | 基础信息 + 人设 + 模型绑定 |
| 12 | 通用技能编辑 | `SkillsPanel` 内联编辑器 | 创建者可编辑：name / description / category / version / scriptContent / permissions |
| 13 | 模型绑定 | `ExpertEditorModal` 模型 Tab | 每个专家独立绑定一个 AI 模型，覆盖所有 role（default/router/step/response/general_skill） |

---

## 4. 数据模型

`ExpertBindings`:
- `sopSkills: string[]` — SOP ID 集合（复制模型）
- `skills: string[]` — 通用技能 ID 集合（安装模型）
- `mcpServers: string[]` — MCP 服务器 JSON 字符串集合（直接配置）
- `knowledgeBases: string[]`
- `connectors: string[]`
- `modelId?: string` — 专家专属 AI 模型 ID（`MODEL_CONFIG_LIST` 或 `MODEL_CONFIG_LOCAL_LIST` 中的 id）

通用技能来自 `SKILL_LIST`（本地 skill-service，按 `ownerUserId` 个人隔离）+ `GENERAL_SKILL_LIST`（FastAPI 企业目录）。

### 4.1 技能编辑

`SkillUpdateParams`（`src/lib/skill-types.ts`）— 全字段可选，仅更新传入的字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `name` | string | ❌ | 技能名称 |
| `description` | string | ❌ | 功能描述 |
| `category` | string | ❌ | 分类标签 |
| `version` | string | ❌ | 语义化版本号 |
| `author` | string | ❌ | 作者 |
| `permissions` | SkillPermission[] | ❌ | 权限声明数组 |
| `triggers` | SkillTrigger[] | ❌ | 触发条件 |
| `icon` | string | ❌ | 图标 |

> **注意**：本地 skill 的 `scriptContent` 字段仅作存储，无本地执行引擎。
> 真正执行技能的能力在 FastAPI 后端，通过 `GeneralSkillRunner` 读取 SKILL.md 文件、LLM 生成 runner 后在 sandbox 中执行。
> 可执行的技能应通过 `general-skill:import` 或 `general-skill:import-package` 路径创建。

编辑权限：仅 `ownerUserId` 匹配的当前用户可编辑；编辑后 `ownerUserId` 不变。

---

## 5. 页面

### 5.1 SOP 工作台（PluginPanel → SOP）

```
┌─ 当前专家 [法务小助 ▼]     [从广场复制] [从其他专家复制] ─┐
│  搜索当前专家的 SOP…                              3/3   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 合同审核 · contract-review · 法务          [移除] │  │
│  │ 报销审批 · expense-approve · 行政          [移除] │  │
│  └──────────────────────────────────────────────────┘  │
│  空态：还没有 SOP → 引导从广场复制                        │
└─────────────────────────────────────────────────────────┘
```

### 5.2 通用技能目录（PluginPanel → 通用技能）

```
┌─ 当前专家 [QCM4490 ▼]                  已安装 2 个 ────┐
│  搜索可安装的技能…                      技能目录 7 个    │
│                                                       │
│  ── 已安装 (2) ────────────────────────────────────   │
│  │ ✔ 网页检索 · 按主题检索…        [编辑] [卸载]      │
│  │ ✔ 表格分析 · 读取 CSV/Excel…    [编辑] [卸载]      │
│                                                       │
│  ── 我的技能 · 点击安装到当前专家 ──────────────────    │
│  │ ◻ 长文摘要 · 多文档摘要…        [编辑] [安装]      │
│  │ ◻ 文本翻译 · 多语言翻译…       [编辑] [安装]      │
│  │ ◻ 日志分析 · 日志解析与告警…   [编辑] [安装]      │
└───────────────────────────────────────────────────────┘
```

**交互规则：**
- 已安装区域：展示名称+描述+图标，可编辑、卸载
- 我的技能区域：展示所有用户拥有的且未安装的技能，可编辑、一键安装
- 安装后立即移到"已安装"区域（无中间弹窗）
- 搜索过滤个人技能目录
- 广场视图仅展示只读的技能列表
- 创建的技能仅创建者可见，可安装到自己管理的专家
- ✎ 编辑按钮在每张技能卡片右侧，点击后弹出全屏编辑器 modal

#### 内置示例：MCP 回复引用规范（`mcp-reply-citation`）

| 项 | 说明 |
|---|---|
| 类型 | 指令型 General Skill（仅 SKILL.md，无脚本，只 `operation=read`） |
| 作用 | 专家通过 MCP 查询后，须在回复末尾标注「本次调用 MCP：{服务器名} / {工具名}」 |
| Seed | 启动时 upsert 到 `general_skills`，并挂入 open gallery（否则 `GENERAL_SKILL_LIST` 看不到）；对已绑定 MCP 的专家自动安装 |
| 手动安装 | SkillsPanel → 搜索「MCP 回复引用」→ [安装] 到当前专家；H618 等已有 MCP 的专家应出现在「已安装」 |
| 限制 | 不强制追加；模型未 read 该技能或忘记格式时可能漏写 |

### 5.2b 技能编辑器（SkillsPanel 内联 modal）

```
┌──────────────────────────────────────┐
│  编辑技能                         X │
├──────────────────────────────────────┤
│  名称 *                  分类  版本  │
│  [长文摘要______________] [nlp] [1.0]│
│                                      │
│  描述                                │
│  [多文档自动生成结构化摘要___________]│
│                                      │
│  权限声明                            │
│  [✓]读取文件 [✓]写入文件 [ ]删除文件 │
│  [✓]访问网络 [ ]Shell    [ ]Python   │
│  [ ]Webhook  [ ]外部API  [ ]剪贴板   │
│  [ ]浏览器                           │
│                                      │
│         [取消]           [保存更改]   │
└──────────────────────────────────────┘
```

**编辑规则：**

- 10 种权限类型以 checkbox 网格展示（2 列自适应），勾选/取消即时生效
- 保存时仅发送有变化的字段（`SKILL_UPDATE` IPC → per-user JSON 持久化）
- 仅创建者（ownerUserId 匹配）可编辑
- 保存后列表自动刷新
- 编辑不影响已安装到专家的副本（绑定关系不变）
- **没有脚本编辑能力**：本地无 skill 执行引擎；真正可执行的技能通过 FastAPI 的 `GeneralSkillRunner`（读取 SKILL.md → LLM 生成 runner → sandbox 执行）或本地上传 `.skill` 包（`SKILL_UPLOAD`）实现

### 5.3 MCP 工作台（PluginPanel → MCP）

```
┌─ 当前专家 [H618 ▼]       [+ 添加 MCP]  [从其他专家复制] ─┐
│  ┌─ 添加 MCP 服务器 ──────────────────────────────┐    │
│  │  服务器 URL * [https://mcp.example.com    ]    │    │
│  │  服务器名称   [Weather MCP                 ]    │    │
│  │  API Key      [·············              ]    │    │
│  │  [测试连接] [添加]  ✓ 连接成功                 │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  │ ✔ Weather MCP · https://…          已连接  [移除]  │
│  │ ✔ File MCP · https://…             已连接  [移除]  │
└───────────────────────────────────────────────────────┘
```

### 5.4 导入弹窗（仅 SOP 复制使用）

- **无**「绑定到专家」下拉（目标已是 scope）
- 有来源选择 + 搜索 + checkbox（排除已拥有）

### 交互链

```
# SOP 复制
专家中心管理 → [管理 SOP]
  → setExpertScope(expertId)
  → 打开 PluginPanel SOP Tab
  → 列表仅显示该专家已有 SOP
  → [从广场复制] → 搜索勾选 → import → 刷新列表

# 通用技能安装
专家中心管理 → [管理 Skill]
  → setExpertScope(expertId)
  → 打开 PluginPanel 通用技能 Tab
  → 我的技能 + 已安装列表
  → [安装] → resource:import(general_skill) → 刷新

# 通用技能编辑
SkillsPanel 技能卡片 → [✎ 编辑]
  → 弹出编辑器 modal
  → 修改 name / description / category / version / permissions
  → [保存更改] → SKILL_UPDATE IPC → 刷新列表
  → 编辑不影响已安装到专家的副本（绑定关系不变）
  → 真正的技能执行走 FastAPI GeneralSkillRunner（SKILL.md → LLM 生成 runner → sandbox）

# MCP 添加
专家中心管理 → [管理 MCP]
  → setExpertScope(expertId)
  → 打开 PluginPanel MCP Tab
  → 填 URL/名称 → 测试连接 → 添加
  → 或 [从其他专家复制] → 勾选 → import
```

### 5.5 专家编辑器 — 模型 Tab（ExpertEditorModal）

> **数据源**：`ExpertModelCatalog` 表（独立于用户个人 `ModelConfig`），由 admin 在「设置 → 专家模型」统一维护。参见 [settings-002](../prd/settings-002-expert-model-catalog.md)。

```
┌─ 编辑器（admin）────────────────────────┐
│  Tab: [基础信息] [人设] [模型]           │
│                                          │
│  选中模型作为此专家的专属引擎：            │
│  ┌──────────────────────────────────┐    │
│  │ ◉ GPT-4o · openai               │    │
│  │ ○ DeepSeek-V3 · openai           │    │
│  │ ○ Claude Sonnet · anthropic      │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [管理模式] 前往专家模型目录             │
│  ── 操作栏 ──                            │
│  [存草稿] [启动专家]       [取消]        │
└──────────────────────────────────────────┘

┌─ 编辑器（普通用户）──────────────────────┐
│  Tab: [基础信息] [人设] [模型]           │
│                                          │
│  当前绑定：GPT-4o · openai               │
│  ⓘ 如需更换模型，请联系管理员。           │
│                                          │
│  ── 操作栏 ──                            │
│  [取消]                                  │
└──────────────────────────────────────────┘
```

- 数据源：仅 `EXPERT_MODEL_CATALOG_LIST`（ExpertModelCatalog 表）
- **权限差异**：
  - admin：单选列表可选——切换模型 → `handleSave` 写 `bindings.expertModelCatalogId`
  - 普通用户：只读显示已绑定模型名 + 提示文字；无保存按钮（不是创建场景时）
- 创建新专家时：所有用户均可从列表中选择（因为创建者就是 owner，需初始化绑定）
- 模型绑定存储在 `AgentModelBinding.expert_model_catalog_id`（`role="default"`），后端 `ensure_tenant_admin` 守卫控制修改权限

### 交互链 — 模型绑定

```
专家中心 → [新建]
  → ExpertEditorModal
  → 切换到「模型」Tab
  → 加载 EXPERT_MODEL_CATALOG_LIST（所有用户可读）
  → 选中模型 → handleSave 写 bindings.expertModelCatalogId
  → IPC: EXPERT_CREATE
    └─ 后端: PUT /api/enterprise/agents/{id}/models
        { expert_model_catalog_id: <id> }
        → ensure_tenant_admin 守卫（创建者若为 admin 可通过；非 admin 由创建时默认写入）

管理员 → [编辑]
  → ExpertEditorModal
  → 切换到「模型」Tab → 显示可选列表
  → 更换模型 → handleSave 写 bindings.expertModelCatalogId
  → IPC: EXPERT_UPDATE
    └─ 后端: PUT /api/enterprise/agents/{id}/models
        { expert_model_catalog_id: <new_id> }
        → ensure_tenant_admin 守卫 √

普通用户 → [编辑]
  → ExpertEditorModal
  → 切换到「模型」Tab → 只读显示当前模型名 + "请联系管理员"
  → 无保存按钮

### 运行时（A2A）— 强制规则

> **专家对话必须走 A2A → 服务端 AgentLoop。** 本地 Sidecar / AIService / chat proxy **不得**作为专家对话主路径。
> 原因：MCP / Skill / Knowledge 能力清单只在服务端 `HarnessV2Engine` 构建；本地路径看不到服务器端绑定。

用户召唤专家 → 发消息
  → EXECUTE_TASK 检测到 `expertId` → **立即** `_planViaA2A(expertId, ...)`
  → POST `/a2a/agents/{agentId}/tasks`（SSE）
    → AgentLoop → HarnessV2Engine
    → CapabilityManifestBuilder（含 MCP / Skill / Knowledge）
    → 模型由服务端 `model_for_agent` 解析（ExpertModelCatalog）
  → 客户端 SSE：`timeout` ≥ 10 分钟（多轮 MCP/工具易超 2 分钟；过短会 `aborted`/`ECONNRESET`）
  → 流中断时若已有 `stream_delta`/`complete` 文本，优先返回已收到内容，避免整轮报「暂时不可用」
  → ⛔ 禁止：因 `modelId` 以 `local_` 开头而走 Sidecar
  → ⛔ 禁止：Sidecar 失败后回退本地 AIService（会丢失全部服务器能力）
  → ⛔ 禁止：A2A 失败后静默回退 chat proxy（chat proxy 无工具清单）
  → A2A 完全失败（无任何正文）时：向用户返回明确错误（「专家服务暂时不可用」），不假装成功回答
```

---

## 6. API

| 能力 | 通道 | 资源类型参数 |
|------|------|------|
| 专家列表（含 bindings 合并） | `expert:list` | — |
| SOP 目录 | `sop:list` | — |
| 通用技能目录 | `general-skill:list` | — |
| 导入到目标专家 | `resource:import` | `sop` / `general_skill` / `mcp` |
| 从专家移除 | `resource:unbind` | `sop` / `general_skill` / `mcp` |
| MCP 连接测试 | `mcp:connect` | — |
| MCP 列表 | `mcp:list` | — |
| MCP 移除 | `resource:unbind` | `mcp` |
| 技能更新 | `skill:update` | —（per-user local） |
| 技能创建 | `skill:create` | — |
| 技能上传 | `skill:upload` | — |
| 模型绑定 | `agent:models` | 写入 AgentModelBinding(expert_model_catalog_id, role="default")，admin only |

### 6.1 数据所有权原则

> **专家系统的所有数据必须在服务器端。** 专家的 agent loop 运行在服务器（`HarnessV2Engine`），只读数据库 `AgentResourceBinding`。任何存在于本地 JSON 的绑定数据在服务端对话中完全不可见。

| 资源类型 | 存储位置（Phase D 后） | agent loop 可见 |
|---|---|---|
| SOP Skill | 服务器 `agent_resource_bindings`（`resource_type='skill'`） | ✅ |
| General Skill | 服务器 `agent_resource_bindings`（`resource_type='general_skill'`） | ✅ |
| **MCP 服务器** | **服务器 `agent_resource_bindings`（`resource_type='mcp'`）** | **✅** |
| 知识库 | 服务器 `agent_resource_bindings`（`resource_type='knowledge_base'`） | ✅ |
| 工具 | 服务器 `agent_resource_bindings`（`resource_type='tool'`） | ✅ |

**迁移路径**：本地 `binding-overrides.json` 中 `mcpServers` 字段一次性迁移到后端 `agent_resource_bindings` → `resource_type='mcp'`，迁移后不再写入本地。

---

## 7. 页面关系

| From | To | 触发 |
|------|-----|------|
| ExpertCenter 管理 Tab | SOP Scope 工作台 | [管理 SOP] → setExpertScope |
| ExpertCenter 管理 Tab | 通用技能目录 | [管理 Skill] → setExpertScope |
| ExpertCenter 管理 Tab | MCP 工作台 | [管理 MCP] → setExpertScope |
| SOP Scope 工作台 | ResourceImportDialog | 从广场 / 从其他专家复制 |
| MCP 工作台 | ResourceImportDialog | 从其他专家复制 |
| Scope 工作台 | （不进入）蒸馏编辑器 | 创作请走 [agents-003](./agents-003-sop-management.md) |

### 7.1 执行链路：配置到运行时

```
┌─ 配置层（Phase D 改造后）─────────────┐
│                                      │
│  SkillsPanel → [安装] → RESOURCE_IMPORT │
│  McpPanel    → [安装] → RESOURCE_IMPORT │
│         │                            │
│         │  ⛔ 不再写本地 binding-overrides.json
│         │  ✅ 直接写后端 AgentResourceBinding 表
│         │     resource_type="general_skill" │
│         │     resource_type="mcp"          │
│         │     resource_type="skill"        │
│                                      │
├─ 运行时层（后端 HarnessV2Engine）────┤
│                                      │
│  用户消息 → agent_id=当前专家        │
│    → ChatSession.agent_id            │
│    → CapabilityManifestBuilder       │
│      .build(agent_id)                │
│      ├─ 读 AgentResourceBinding      │
│      │   resource_type="skill"        │
│      │   → 专家的 SOP 技能列表        │
│      │   resource_type="general_skill"│
│      │   → 专家已安装的通用技能列表    │
│      │   resource_type="tool"         │
│      │   → 专家的内置工具列表         │
│      │   resource_type="mcp"          │
│      │   → 专家的 MCP 服务器列表      │
│      │     → 对每个 MCPServer 获取    │
│      │       discovered_tools         │
│      │     → 注入 capability manifest │
│      │   resource_type="knowledge_base"│
│      │   → 专家的知识库列表           │
│      ├─ 冻结为 CapabilityManifest    │
│      └─ project → LLM 可见的能力清单  │
│                                      │
│    → HarnessTaskAgent.run()          │
│      LLM: action="tool"              │
│        → general_skill.xxx: read     │
│        → general_skill.xxx: execute  │
│        → tool.xxx: mcp 调用          │
│      LLM: action="finish" → 回复     │
│                                      │
│    → ResponseGenerator               │
│      → 合成最终用户可见回复            │
└──────────────────────────────────────┘
```

> 详细架构见 [`docs/tech-spec/agents-004-agent-loop.md`](../tech-spec/agents-004-agent-loop.md)。
> 绑定同步实现见 [`docs/plans/agents-01-2-bindings-sync.md`](../plans/agents-01-2-bindings-sync.md)。

## 8. 验收标准

- [ ] 编辑器无 SOP/Skill/MCP 绑定 Tab
- [ ] SOP 页有当前专家 scope，列表为该专家子集
- [ ] SOP 导入弹窗可搜索，且不要求每次选目标专家
- [ ] 通用技能页有个人技能目录 + 已安装列表
- [ ] 通用技能一键安装/卸载（个人创建→安装到专家）
- [ ] 创建的技能仅创建者可见（按 userId 隔离）
- [ ] 技能可编辑：名称/描述/分类/版本/权限均可修改（不含脚本——本地无执行引擎）
- [ ] 编辑后列表自动刷新，不影响已安装到专家的副本
- [ ] MCP 页可直接添加（URL+名称+测试连接）
- [ ] 专家中心「管理 SOP」「管理 Skill」「管理 MCP」能跳进对应 scope
- [ ] 可移除/卸载已有资源
- [ ] 空态有操作指引
- [ ] 新建专家时可选择 ExpertModelCatalog 中的模型（所有用户来自同一目录）
- [ ] 编辑已有专家时 admin 可更换模型，普通用户只读
- [ ] 模型绑定写入 `AgentModelBinding.expert_model_catalog_id`（`role="default"`）
- [ ] 无模型绑定的专家走 ExpertModelCatalog 默认条目（如有）或租户 ModelConfig.is_default
- [ ] 召唤专家后前端 ModelSelector 不切换、不传 `model_config_id`（由后端自动走 AgentModelBinding）
- [ ] 非 admin 无法修改专家模型（后端 `ensure_tenant_admin` 守卫）
- [ ] ExpertModelCatalog 管理页仅 admin 可见（SettingsPanel 入口门禁）
