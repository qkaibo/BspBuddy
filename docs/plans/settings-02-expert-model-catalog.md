---
id: settings-02
title: 专家模型目录实现计划
type: plan
status: 🟢 已完成
related: [settings-002, agents-01-3, agents-002]
---

## 目标

实现独立的 ExpertModelCatalog 表、admin 管理页面、ExpertEditorModal 模型 Tab 改造、默认模型机制。

## 设计决策

- **独立表**：ExpertModelCatalog 与 ModelConfig 完全分离，不共享数据
- **仅 admin 可见/可管**：普通用户通过 ExpertEditorModal 模型 Tab 只读看到，通过 admin 页面无法访问
- **AgentModelBinding 共存**：保留 `model_config_id`（旧）和新增 `expert_model_catalog_id`（新），解析时优先新字段
- **前端模型 Tab**：创建专家时所有用户可选，未选时自动预选 is_default 条目；编辑时 admin 可选、普通用户只读
- **默认模型**：ExpertModelCatalog 新增 `is_default` 字段，每租户最多一个。专家无特定绑定时自动回退到此默认条目。管理员通过 ★ 星标按钮设置
- **模型绑定权限**：`update_agent_models` 使用 `_ensure_can_manage_agent`（创建者或 admin），非 `ensure_tenant_admin`，确保普通用户创建专家时也能绑定模型

## 分期任务

### Phase A：后端新建表 + CRUD API

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| A1 | 新建 ExpertModelCatalog 表 | `backend/app/db/models.py` | — |
| A2 | AgentModelBinding 新增 `expert_model_catalog_id` 字段 | `backend/app/db/models.py` | A1 |
| A3 | 新建 ExpertModelCatalog CRUD API（admin-only） | `backend/app/api/expert_model_catalog.py` | A1 |
| A4 | 注册路由到 `backend/app/main.py` | `backend/app/main.py` | A3 |
| A5 | 更新 `model_for_agent` 解析逻辑（优先 expert_model_catalog_id） | `backend/app/agents/branching.py` | A2 |

### Phase B：AgentModelBinding 守卫更新

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| B1 | `update_agent_models` 守卫：`_ensure_can_manage_agent` → `ensure_tenant_admin` | `backend/app/api/agents.py` | — |
| B2 | `AgentModelsUpdateRequest` 新增 `expert_model_catalog_id` 字段 | `backend/app/agents/schema.py` | — |

### Phase C：前端专家模型管理页

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| C1 | 新建 ExpertModelCatalog 前端类型 | `src/lib/expert-model-types.ts` | — |
| C2 | 新增 IPC 通道常量 | `src/lib/types.ts` | — |
| C3 | 新建 ExpertModelCatalogPanel 组件 | `src/components/ExpertModelCatalogPanel.tsx` | C1 |
| C4 | 新建 IPC handler（CRUD + list） | `src/main/services/ipc-handlers.ts` | C2 |
| C5 | SettingsPanel 新增「专家模型」导航入口（admin 门禁） | `src/components/SettingsPanel.tsx` | C3 |

### Phase D：ExpertEditorModal 模型 Tab 改造

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| D1 | 模型 Tab 数据源改为 `EXPERT_MODEL_CATALOG_LIST` | `src/components/ExpertEditorModal.tsx` | C2, A3 |
| D2 | 编辑态权限判断：admin 可选，普通用户只读 | `src/components/ExpertEditorModal.tsx` | D1 |
| D3 | `_syncModelBinding` 传 `expert_model_catalog_id` | `src/main/services/ipc-handlers.ts` | B2 |
| D4 | 未选模型时自动预选 `is_default` 条目 | `src/components/ExpertEditorModal.tsx` | D1 |

### Phase E：默认模型机制

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| E1 | ExpertModelCatalog 表新增 `is_default` 字段 | `backend/app/db/models.py` | A1 |
| E2 | CRUD API 加 `is_default` 互斥逻辑 (`_unset_other_defaults`) | `backend/app/api/expert_model_catalog.py` | E1 |
| E3 | `model_for_agent` 回退链：无绑定时优先 `ExpertModelCatalog.is_default` | `backend/app/agents/branching.py` | E1 |
| E4 | 前端类型加 `is_default` | `src/lib/expert-model-types.ts` | E1 |
| E5 | ExpertModelCatalogPanel 加 ★ 星标按钮 + 「默认」标签 | `src/components/ExpertModelCatalogPanel.tsx` | E4 |
| E6 | ExpertEditorModal 列表项显示 ★ 默认标记 | `src/components/ExpertEditorModal.tsx` | E4 |
| E7 | DB 迁移：自动加 `is_default` 列，确保 `model_config_id` nullable | `backend/app/db/database.py` | E1 |

## 改动范围总览

```
后端:
  backend/app/db/models.py                [+ ExpertModelCatalog 表, + AgentModelBinding 新字段]
  backend/app/api/expert_model_catalog.py  [新建: CRUD API]
  backend/app/api/agents.py               [守卫改为 ensure_tenant_admin]
  backend/app/agents/schema.py            [+ expert_model_catalog_id]
  backend/app/agents/branching.py         [model_for_agent 解析更新]
  backend/app/main.py                     [注册路由]

前端:
  src/lib/expert-model-types.ts           [新建: 类型定义]
  src/lib/types.ts                        [+ IPC_CHANNELS]
  src/components/ExpertModelCatalogPanel.tsx [新建: 管理页面]
  src/components/SettingsPanel.tsx        [+ 专家模型导航入口]
  src/components/ExpertEditorModal.tsx    [模型 Tab 改造]
  src/main/services/ipc-handlers.ts       [+ 4 个 IPC handler, _syncModelBinding 更新]

文档:
  docs/prd/settings-002-expert-model-catalog.md    ← PRD
  docs/tech-spec/settings-002-expert-model-catalog.md ← Tech Spec
  docs/plans/settings-02-expert-model-catalog.md    ← 本文件
  docs/prd/agents-002-editor-ux.md                 ← 更新模型 Tab
  docs/plans/agents-01-3-model-binding.md          ← 更新
  docs/README.md                                    ← 索引
```

## 验收标准

- [ ] ExpertModelCatalog 表创建成功（SQLModel create_all + db migration）
- [ ] admin 可在「设置 → 专家模型」新增/编辑/删除专家模型
- [ ] 普通用户看不到「专家模型」入口
- [ ] ExpertEditorModal 模型 Tab 列出 ExpertModelCatalog 条目
- [ ] 创建专家时所有用户可选模型；编辑时 admin 可选、普通用户只读
- [ ] 未选模型时自动预选 `is_default` 条目；无默认则选第一个 enabled 条目
- [ ] admin 可点击 ★ 星标设置/取消默认模型，设新默认自动取消旧默认
- [ ] AgentModelBinding 写 `expert_model_catalog_id`
- [ ] A2A 运行时 `model_for_agent` 按优先级：绑定 → ExpertModelCatalog.is_default → ModelConfig.is_default
- [ ] 费用挂在 ExpertModelCatalog 条目的 api_key 上
- [ ] 测试连接功能可用（每个条目旁的刷新按钮）
