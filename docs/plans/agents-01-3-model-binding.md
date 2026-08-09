---
id: agents-01-3
title: 专家独立模型配置（绑定 ExpertModelCatalog）
type: plan
related: [agents-01-1, agents-002, settings-002]
parent: agents-01
status: 🟢 已完成
---

# 专家独立模型配置

> 父 Plan: [agents-01](agents-01-expert-management.md)
> PRD: [agents-002 专家资源工作台](../prd/agents-002-editor-ux.md)
> ExpertModelCatalog: [settings-002 PRD](../prd/settings-002-expert-model-catalog.md) · [settings-02 Plan](../plans/settings-02-expert-model-catalog.md)

## 背景

本 Plan 已归入 settings-002（ExpertModelCatalog）。此处仅保留 ExpertEditorModal 模型 Tab 的**前端绑定层**改造。

**数据源**：`EXPERT_MODEL_CATALOG_LIST`（ExpertModelCatalog 表，由 admin 在「设置 → 专家模型」维护），不再使用 `MODEL_CONFIG_LIST`。

**权限**：admin 和创建者均可绑定；普通用户只读。未选模型时自动预选 `is_default` 条目。

## 设计决策

- **模型来源**：`ExpertModelCatalog` 表（独立于用户个人 `ModelConfig`）
- **权限差异**：创建新专家时所有用户可选；编辑已有专家时 admin 可换，普通用户只读
- **后端守卫**：`PUT /api/enterprise/agents/{id}/models` 使用 `_ensure_can_manage_agent`（创建者或 admin），非 `ensure_tenant_admin`
- **自动预选**：新建/编辑时若未选模型，自动选中 `is_default` 且 `enabled` 的条目
- **运行时回退**：`model_for_agent` 按优先级：绑定 → ExpertModelCatalog.is_default → ModelConfig.is_default
- **计费**：费用归属于 ExpertModelCatalog 条目的 api_key 账户

## 改动文件

```
src/components/ExpertEditorModal.tsx    ← 模型 Tab 数据源改为 EXPERT_MODEL_CATALOG_LIST + admin/非admin 权限
src/main/services/ipc-handlers.ts       ← _syncModelBinding 传 expert_model_catalog_id；_planViaBackend 有 expert 时不传 model_config_id
src/renderer/App.tsx                    ← 召唤专家时不操作 ModelSelector
src/lib/types.ts                        ← bindings.expertModelCatalogId 类型
docs/prd/agents-002-editor-ux.md        ← 模型 Tab 更新
docs/plans/agents-01-3-model-binding.md ← 本文件（指向 settings-002）
```

## Phase Do：模型 Tab 改造（依赖 settings-002 Phase A+B 完成）

**文件**：`src/components/ExpertEditorModal.tsx`

改动：
1. 数据源：`IPC.invoke(EXPERT_MODEL_CATALOG_LIST)` → ExpertModelCatalog 条目
2. state：`selectedExpertModelId`（替代旧的 `selectedModelId`）
3. 权限判断：`isAdmin` prop → admin 可选/换，非 admin 只读
4. 新建场景：所有用户可选（`isNew = !expert?.id`）
5. 编辑场景 + admin：显示可选列表
6. 编辑场景 + 非 admin：只读显示已绑定模型名 + 提示
7. `handleSave`：`bindings.expertModelCatalogId = selectedId`

## 数据流

```
ExpertEditorModal [模型 Tab]
  └─ 加载: IPC.invoke(EXPERT_MODEL_CATALOG_LIST) → GET /api/enterprise/expert-model-catalog
  └─ 自动预选: 无绑定时 → 选 is_default && enabled 条目
  └─ 权限: isAdmin || isNew ? 可选 : 只读
  └─ 保存: bindings.expertModelCatalogId = selectedId
            │
            └─ _syncModelBinding → PUT /api/enterprise/agents/{id}/models
                { expert_model_catalog_id: selectedId }
                → _ensure_can_manage_agent 守卫（创建者/admin）
                ↓
            服务器端 HarnessV2Engine.run()
              → model_for_agent(tenant_id, agent_id, "default")
              → 1. AgentModelBinding.expert_model_catalog_id
              → 2. ExpertModelCatalog.is_default（租户默认）
              → 3. ModelConfig.is_default（用户默认，兜底）
              → 费用归属于该条目的 api_key 账户
```

## 验收标准

- [ ] ExpertEditorModal 模型 Tab 数据源为 EXPERT_MODEL_CATALOG_LIST
- [ ] 新建专家时所有用户可选模型，未选时自动预选 is_default 条目
- [ ] 编辑已有专家时 admin 可换模型，普通用户只读
- [ ] _syncModelBinding 传 expert_model_catalog_id
- [ ] `PUT /api/enterprise/agents/{id}/models` 使用 `_ensure_can_manage_agent` 守卫
- [ ] model_for_agent 按 4 级优先级解析模型
- [ ] 测试连接功能可用
