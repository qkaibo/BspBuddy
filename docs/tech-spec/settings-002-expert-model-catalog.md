---
id: settings-002
title: 专家模型目录 — 技术规格
type: tech-spec
related: [settings-002-prd, agents-01-3, agents-004]
---

## 1. 概述

实现 ExpertModelCatalog 表、CRUD API、前端管理页面、以及 AgentModelBinding 从 ModelConfig 到 ExpertModelCatalog 的迁移。

技术范围：
- 新建 `ExpertModelCatalog` SQLModel 表
- 新建 CRUD API 端点（admin-only）
- 改造 `AgentModelBinding.model_config_id` → `expert_model_catalog_id`
- 更新 `model_for_agent` 解析逻辑
- 前端新增 `ExpertModelCatalogPanel` 管理页 + `ExpertEditorModal` 模型 Tab 改造

---

## 2. 数据库变更

### 2.1 新建 `ExpertModelCatalog` 表

```python
class ExpertModelCatalog(SQLModel, table=True):
    __tablename__ = "expert_model_catalogs"

    id: str = Field(default_factory=lambda: new_id("emodel"), primary_key=True)
    tenant_id: str = Field(index=True)
    name: str
    provider: str = "openai_compatible"
    api_protocol: str = Field(default="openai_chat_completions", index=True)
    base_url: Optional[str] = None
    api_key_encrypted: str
    model: str
    temperature: float = 0.2
    max_output_tokens: int = 8192
    enabled: bool = True
    is_default: bool = False            # ← 新增：租户默认模型标记
    created_by_user_id: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

### 2.2 改造 `AgentModelBinding` 表

新增字段，保留旧字段于共存期。两列均设为 `nullable=True` 以支持"仅绑新"或"仅绑旧"：

```python
class AgentModelBinding(SQLModel, table=True):
    __tablename__ = "agent_model_bindings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "agent_id", "role", name="uq_agent_model_binding"),
    )

    id: str = Field(default_factory=lambda: new_id("agentmodel"), primary_key=True)
    tenant_id: str = Field(index=True)
    agent_id: str = Field(index=True)
    role: str = Field(default="default", index=True)

    # 旧字段（保留，Phase 1 兼容）
    model_config_id: Optional[str] = Field(default=None, index=True, nullable=True)

    # 新字段
    expert_model_catalog_id: Optional[str] = Field(default=None, index=True, nullable=True)

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

---

## 3. API 设计

### 3.1 专家模型 CRUD

所有端点需 `Depends(require_tenant_admin)`（仅 admin 可操作）。

**列表**

```
GET /api/enterprise/expert-model-catalog?tenant_id=xxx
→ 200 [ExpertModelCatalogRead, ...]
```

**新增**

```
POST /api/enterprise/expert-model-catalog
Body: {
  tenant_id: string,
  name: string,
  provider: string,
  api_protocol: string,
  base_url?: string,
  api_key: string,          // 明文，后端 Fernet 加密后存 api_key_encrypted
  model: string,
  temperature?: float,
  max_output_tokens?: int,
  is_default?: boolean,     // ← 新增：设为 true 时后台调用 _unset_other_defaults
}
→ 201 ExpertModelCatalogRead
```

**编辑**

```
PUT /api/enterprise/expert-model-catalog/{id}
Body: {
  tenant_id: string,
  name?: string,
  base_url?: string,
  api_key?: string,
  model?: string,
  temperature?: float,
  max_output_tokens?: int,
  is_default?: boolean,     // ← 新增：变更时后台自动维护互斥
}
→ 200 ExpertModelCatalogRead
```

### 3.2 is_default 互斥逻辑

```python
def _unset_other_defaults(db: Session, tenant_id: str, exclude_id: str) -> None:
    """Set is_default=False for all other entries in the same tenant."""
    others = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
            ExpertModelCatalog.is_default == True,
            ExpertModelCatalog.id != exclude_id,
        )
    ).all()
    for other in others:
        other.is_default = False
        db.add(other)
```

在 `create_catalog` 和 `update_catalog` 中写入 `is_default=True` 后调用此函数，确保每租户最多一个默认条目。

**删除**

```
DELETE /api/enterprise/expert-model-catalog/{id}?tenant_id=xxx
→ 200 { status: "deleted" }
```

### 3.2 模型绑定改造

**AgentModelsUpdateRequest Schema 改动**

```python
class AgentModelBindingInput(BaseModel):
    role: Literal["default", "router", "step", "response", "general_skill"]
    model_config_id: Optional[str] = None           # 旧，兼容
    expert_model_catalog_id: Optional[str] = None   # 新
```

**守卫改动**

`update_agent_models` 端点：

```python
# 使用 _ensure_can_manage_agent（创建者或 admin），而非 ensure_tenant_admin
# 原因：普通用户创建专家时也需要绑定模型，不应被 admin-only 守卫阻塞
_ensure_can_manage_agent(agent, current_user)
```

同时增加 ExpertModelCatalog 条目的有效性校验（条目存在、同租户、已启用）。

---

## 4. 解析逻辑更新

### `model_for_agent` 更新

```python
def model_for_agent(
    db: Session, tenant_id: str, agent_id: str | None, role: str = "default"
) -> ResolvedModelConfig | None:
    agent = get_agent(db, tenant_id, agent_id)
    roles: Iterable[str] = (role, "default") if role != "default" else ("default",)
    if agent:
        for candidate_role in roles:
            binding = db.exec(
                select(AgentModelBinding).where(
                    AgentModelBinding.tenant_id == tenant_id,
                    AgentModelBinding.agent_id == agent.id,
                    AgentModelBinding.role == candidate_role,
                )
            ).first()
            if binding:
                # 1. 优先 ExpertModelCatalog（新系统）
                if binding.expert_model_catalog_id:
                    catalog = db.get(ExpertModelCatalog, binding.expert_model_catalog_id)
                    if catalog and catalog.enabled:
                        return _runtime_model_from_catalog(tenant_id, catalog)
                # 2. 回退旧 ModelConfig
                if binding.model_config_id:
                    model = db.get(ModelConfig, binding.model_config_id)
                    if model and model.enabled:
                        return _runtime_model(db, tenant_id, model)
    # 3. 无绑定时：优先租户默认专家模型
    default_catalog = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
            ExpertModelCatalog.is_default == True,
            ExpertModelCatalog.enabled == True,
        )
    ).first()
    if default_catalog:
        return _runtime_model_from_catalog(tenant_id, default_catalog)
    # 4. 最后兜底：用户级默认 ModelConfig
    model = db.exec(
        select(ModelConfig).where(
            ModelConfig.tenant_id == tenant_id,
            ModelConfig.is_default == True,
            ModelConfig.enabled == True,
        )
    ).first()
    return _runtime_model(db, tenant_id, model) if model else None
```

---

## 5. 前端架构

### 5.1 文件清单

```
新增:
  src/components/ExpertModelCatalogPanel.tsx   ← 专家模型管理页

改动:
  src/components/SettingsPanel.tsx              ← 新增「专家模型」导航入口（admin 门禁）
  src/components/ExpertEditorModal.tsx          ← 模型 Tab 数据源改为 EXPERT_MODEL_CATALOG_LIST
  src/main/services/ipc-handlers.ts            ← 新增 EXPERT_MODEL_CATALOG_* handlers
  src/lib/types.ts                             ← 新增 IPC_CHANNELS 条目
  src/lib/expert-model-types.ts                ← 新增 ExpertModelCatalog 类型定义
```

### 5.2 IPC 通道

```typescript
EXPERT_MODEL_CATALOG_LIST: 'expert-model-catalog:list',
EXPERT_MODEL_CATALOG_CREATE: 'expert-model-catalog:create',
EXPERT_MODEL_CATALOG_UPDATE: 'expert-model-catalog:update',
EXPERT_MODEL_CATALOG_DELETE: 'expert-model-catalog:delete',
EXPERT_MODEL_CATALOG_TEST: 'expert-model-catalog:test',
```

### 5.3 ExpertModelCatalogPanel 组件

列表每行显示：
- 名称旁金色「默认」标签（当 `is_default=true`）
- ★ 星标按钮（Lucide `Star`）：点击切换 `is_default` 状态
  - 设为默认：`PUT .../catalog/{id}` with `is_default: true` → 后端 `_unset_other_defaults` 自动取消其余默认
  - 取消默认：`PUT .../catalog/{id}` with `is_default: false`
- 测试连接按钮（刷新图标，调用 `EXPERT_MODEL_CATALOG_TEST`）
- 停用/启用、编辑、删除按钮

### 5.4 ExpertEditorModal 模型 Tab 数据流

```
ExpertEditorModal [模型 Tab]
  └─ 加载: IPC.invoke(EXPERT_MODEL_CATALOG_LIST) → 后端 GET /api/enterprise/expert-model-catalog
  └─ 自动预选: 如果 selectedModelId 为空 → 选 is_default 且 enabled 的条目；仍无则选第一个 enabled 条目
  └─ 权限判断: isAdmin 或 isNew → 单选可选；非 admin 已有绑定 → 只读展示；非 admin 无绑定 → 显示「将使用默认模型」
  └─ 列表项显示 ★ 默认标记
  └─ 保存: bindings.expertModelCatalogId = selectedId
  └─ _syncModelBinding → PUT /api/enterprise/agents/{id}/models
      { expert_model_catalog_id: selectedId }
```

---

## 6. 迁移策略

### Phase 1：共存期
- `model_config_id` 和 `expert_model_catalog_id` 两列都在
- 解析时优先用 `expert_model_catalog_id`，回退 `model_config_id`
- 前端新绑定时写 `expert_model_catalog_id`

### Phase 2：全量迁移（后续）
- 脚本将 `AgentModelBinding.model_config_id` → `ExpertModelCatalog` 对应条目
- 最终移除 `model_config_id` 列

---

## 7. 安全

- 所有 ExpertModelCatalog CRUD → `ensure_tenant_admin` 守卫
- `api_key` 入参明文 → 后端 Fernet 加密存 `api_key_encrypted`
- 输出 Read 时不返回 `api_key_encrypted`（仅返回 id/name/provider/model/enabled）
- 普通用户能读 ExpertModelCatalog 列表（查看模型名），但不能 CRUD
