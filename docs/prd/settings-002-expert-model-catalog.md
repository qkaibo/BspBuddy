---
id: settings-002
title: 专家模型目录（ExpertModelCatalog）
type: prd
related: [agents-002, agents-01-3, settings-001]
---

## 1. 概述

BspBuddy 的专家 Agent 运行在服务器端 HarnessV2Engine，通过 A2A 协议与本机通信。专家 Agent 只能使用后端模型，不能使用用户个人 ModelConfig 或本机模型。

因此需要一套 **独立的专家模型目录（ExpertModelCatalog）**——与用户个人 `ModelConfig` 完全分表、分开管理——作为专家 Agent 运行时唯一合法的模型来源。

---

## 2. 用户场景

| 角色 | 场景 | 动机 |
|------|------|------|
| 管理员 | 新增/编辑/删除专家可用模型（provider + api key + model） | 集中管控：专家模型池由 admin 统一维护，全局一份 |
| 管理员 | 查看专家模型列表，停用某个不再使用的条目 | 运维：多 admin 之间共享同一目录，均可 CRUD |
| 普通用户 | 创建专家时，从管理员配好的模型列表中选择一个 | 零门槛：不需要自己配 key，直接选 admin 维护的模型 |
| 普通用户 | 编辑已有专家时，查看当前绑定的模型名（只读） | 透明度：知道专家用的是哪个模型，但不能换 |
| 管理员 | 编辑任意专家的模型绑定 | 灵活运维：可更换已上线的专家的模型 |

---

## 3. 功能清单

| # | 功能 | 关联页面 | 说明 |
|---|------|---------|------|
| 1 | 专家模型目录列表 | 设置 → 专家模型（新增） | 仅 admin 可见入口 |
| 2 | 新增专家模型 | 专家模型页面 → 添加 | 填写 name/provider/base_url/api_key/model/temperature 等，同 ModelConfig 结构 |
| 3 | 编辑专家模型 | 专家模型页面 → 编辑 | 修改已有条目（provider key 轮换、模型升级等） |
| 4 | 删除专家模型 | 专家模型页面 → 删除 | admin 可删，已绑定的条目需先解绑或提示风险 |
| 5 | 停用/启用 | 专家模型页面 | 临时禁用，不删除 |
| 6 | 设为/取消默认 | 专家模型页面 → ★ 星标 | 点击星标设置为租户默认模型。每租户最多一个默认，设新默认自动取消旧默认 |
| 7 | 专家绑定模型 | ExpertEditorModal → 模型 Tab | 新建时任意用户可选；编辑时 admin 可选，普通用户只读。未选时自动预选 is_default 条目 |
| 8 | 运行时默认回退 | A2A agent_loop → model_for_agent | 专家无绑定 → 自动使用 ExpertModelCatalog.is_default；仍无 → 回退 ModelConfig.is_default |
| 9 | A2A 运行时解析 | 后端 agent_loop | 读 AgentModelBinding → ExpertModelCatalog 条目 → 用该条目的 api_key 调 LLM |

---

## 4. 数据模型

### 4.1 ExpertModelCatalog 表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | UUID，`emodel-` 前缀 |
| tenant_id | string | 是 | 租户 ID |
| name | string | 是 | 用户可读名称，如「生产 GPT-4o」 |
| provider | string | 是 | `openai_compatible` |
| api_protocol | string | 是 | `openai_chat_completions` / `anthropic_messages` / `gemini_generate_content` |
| base_url | string | 否 | API 端点 |
| api_key_encrypted | string | 是 | Fernet 加密后的 API key（admin 创建时填写自己的 key） |
| model | string | 是 | 模型标识，如 `gpt-4o` |
| temperature | float | 是 | 默认 0.2 |
| max_output_tokens | int | 是 | 默认 8192 |
| enabled | bool | 是 | 是否启用 |
| is_default | bool | 是 | 是否租户默认模型。每租户最多一个。设为 true 时后台自动取消其余条目的 is_default |
| created_by_user_id | string | 是 | 创建者（admin）user_id |
| created_at | datetime | 是 | |
| updated_at | datetime | 是 | |

> **与 ModelConfig 的字段差异**：ExpertModelCatalog 没有 `trust_status`、`verified_at`、`config_revision`、`security_revision`、`key_revision`、`storage_mode`、`scope`。这些是用户个人模型的概念，不适用于全局专家模型目录。

### 4.2 AgentModelBinding 表（改）

| 字段 | 旧值 | 新值 |
|------|------|------|
| `model_config_id` | 指向 `ModelConfig.id` | 改为 `expert_model_catalog_id` → 指向 `ExpertModelCatalog.id` |

---

## 5. 页面与字段

### 5.1 设置 → 专家模型（ExpertModelCatalogPanel，新增）

```
┌─ 设置 ────────────────────────────────────┐
│  [AI 设置] [成员与角色] [专家模型（新）]     │
│                                            │
│  ┌─ 专家模型目录 ─────────────────────────┐│
│  │  专家未选模型时自动使用标记为「默认」的    ││
│  │  条目。点击 ★ 设置默认，每租户最多一个。   ││
│  │                                        ││
│  │  [+ 添加]                              ││
│  │                                        ││
│  │  ┌──────────────────────────────────┐  ││
│  │  │ ★ GPT-4o [默认] · openai · 启用  │  ││
│  │  │ gpt-4o · base_url: api.openai…   │  ││
│  │  │ [测试] [启用] [☆/★] [编辑] [删除]│  ││
│  │  └──────────────────────────────────┘  ││
│  │                                        ││
│  │  ┌──────────────────────────────────┐  ││
│  │  │ ☆ DeepSeek-V3 · openai · 启用    │  ││
│  │  │ deepseek-chat · base_url: api…   │  ││
│  │  │ [测试] [启用] [☆] [编辑] [删除]  │  ││
│  │  └──────────────────────────────────┘  ││
│  └────────────────────────────────────────┘│
└────────────────────────────────────────────┘
```

- **入口可见条件**：仅 admin 角色
- 列表每行显示：名称 + provider 标签 + 启用状态 + 模型标识 + base_url（截断）
- 操作：测试连接、停用/启用、设为/取消默认（★ 星标）、编辑、删除
- 设为默认时后台自动取消该租户其余条目的 is_default 标记
- 所有 admin 共用同一份数据

### 5.2 新增/编辑弹窗

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | text | 是 | 如「生产 GPT-4o」 |
| provider | text | 是 | 固定 `openai_compatible` |
| api_protocol | select | 是 | 下拉选 |
| base_url | text | 否 | API 端点 |
| api_key | password | 是 | admin 的 API key（加密存储） |
| model | text | 是 | 模型标识 |
| temperature | number | 否 | 默认 0.2 |
| max_output_tokens | number | 否 | 默认 8192 |

### 交互链 — 专家模型管理

```
SettingsPanel → [专家模型]（仅 admin 可见）
  → ExpertModelCatalogPanel
  → [添加] → 填写表单 → POST /api/enterprise/expert-model-catalog
  → [编辑] → 修改字段 → PUT /api/enterprise/expert-model-catalog/{id}
  → [停用] → enabled = false → PUT
  → [删除] → DELETE /api/enterprise/expert-model-catalog/{id}
```

### 5.3 ExpertEditorModal 模型 Tab（改）

```
┌─ 编辑器（admin / 新建）───────────────────┐
│  Tab: [基础信息] [人设] [模型]           │
│                                          │
│  ★ 标记的为租户默认模型。未选择时自动使用。 │
│  ┌──────────────────────────────────┐    │
│  │ ◉ GPT-4o [默认] · openai        │    │
│  │ ○ DeepSeek-V3 · openai           │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘

┌─ 编辑器（普通用户，已有专家）─────────────┐
│  Tab: [基础信息] [人设] [模型]           │
│                                          │
│  当前模型（不可更换）:                    │
│  ┌──────────────────────────────────┐    │
│  │ GPT-4o · openai（已绑定）         │    │
│  └──────────────────────────────────┘    │
│  ⓘ 如需更换模型，请联系管理员。           │
└──────────────────────────────────────────┘
```

| 用户 | 模型 Tab 行为 |
|------|-------------|
| admin / 新建 | 加载 EXPERT_MODEL_CATALOG_LIST，单选，可换。未选时自动预选 is_default 条目 |
| 普通用户（编辑已有） | 只读显示已绑定模型名，不可选 |
| 普通用户（编辑，无绑定） | 显示「未绑定模型。服务器端将自动使用租户默认专家模型」 |

---

## 6. API

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/enterprise/expert-model-catalog` | 任意认证用户 | 列出当前租户所有专家模型 |
| POST | `/api/enterprise/expert-model-catalog` | admin | 新增专家模型。支持 `is_default` 字段，设为 true 时自动取消其余默认 |
| PUT | `/api/enterprise/expert-model-catalog/{id}` | admin | 编辑专家模型。`is_default` 变更时空后台自动维护互斥 |
| DELETE | `/api/enterprise/expert-model-catalog/{id}` | admin | 删除专家模型 |
| PUT | `/api/enterprise/agents/{id}/models` | agent 创建者/admin | 绑定专家模型到 Agent。守卫：`_ensure_can_manage_agent` |

> `PUT /api/enterprise/agents/{id}/models` 同时接收 `model_config_id`（旧，兼容）和 `expert_model_catalog_id`（新）。守卫使用 `_ensure_can_manage_agent`（创建者或 admin），非 `ensure_tenant_admin`，确保普通用户创建专家时也能绑定模型。

### 模型解析回退链（model_for_agent）

当前 agent 运行时按优先级解析模型：

1. AgentModelBinding.expert_model_catalog_id → ExpertModelCatalog 条目（已启用的）
2. AgentModelBinding.model_config_id → ModelConfig 条目（已启用的，旧数据兼容）
3. ExpertModelCatalog.is_default=true（租户级默认专家模型）
4. ModelConfig.is_default=true（用户级默认，最后兜底）

---

## 7. 页面关系

| From | To | 触发 | 权限 |
|------|-----|------|------|
| SettingsPanel | ExpertModelCatalogPanel | [专家模型] 导航 | admin |
| ExpertEditorModal 模型 Tab | ExpertModelCatalog 列表 | 加载模型列表（GET） | admin 可选/换；普通用户只读 |
| ExpertModelCatalogPanel | 添加/编辑弹窗 | [添加] / [编辑] | admin |

---

## 8. 验收标准

- [ ] admin 可在「设置 → 专家模型」新增/编辑/删除专家模型条目
- [ ] 普通用户看不到「专家模型」入口
- [ ] admin 可点击 ★ 星标设置/取消默认模型，设新默认自动取消旧默认
- [ ] 创建专家时模型 Tab 列出 ExpertModelCatalog 条目，任意用户可选。未选时自动预选 is_default 条目
- [ ] 编辑专家时 admin 可换模型，普通用户只读
- [ ] 专家无模型绑定时，A2A 运行时自动回退到 ExpertModelCatalog.is_default 条目
- [ ] AgentModelBinding 同时支持 `expert_model_catalog_id`（新）和 `model_config_id`（旧兼容）
- [ ] A2A 运行时 `model_for_agent` 从 ExpertModelCatalog 解析模型配置
- [ ] 费用挂在 ExpertModelCatalog 条目的 api_key 所属账户上
