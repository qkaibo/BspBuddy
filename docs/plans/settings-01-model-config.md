---
id: settings-01
title: AI 模型配置 — BYOK 与租户共享实现计划
type: plan
status: 🟡 P3 进行中
related: [settings-001, architecture-01, 17-data-settings]
---

## 目标

将已有的基础模型配置（plan 17 部分完成）升级为支持 **BYOK 仅本机** / **BYOK 上传后端** / **租户共享** 三种模式，并适配三端（桌面 / Web / 移动端）。

当前状态：plan 17 已完成基础 CRUD API + ModelConfigSettings UI，但 API key 统一加密上传后端，无「仅本机」选项，无租户共享。

---

## 分期任务

### Phase A: 后端扩展（2 天）

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| A1 | ModelConfig 表新增 `storage_mode` 和 `scope` 字段 | `backend/app/db/models.py` | — |
| A2 | 新增 `/api/enterprise/model-configs/local` 端点——接收桌面端本机模型的元数据（不含 key）用于登记 | `backend/app/api/model_configs.py` | A1 |
| A3 | LLM 代理支持「本机模型直连」旁路（IPC handler 判断 storage_mode） | `backend/app/core/llm_proxy.py`, `src/main/services/ipc-handlers.ts` | A1 |
| A4 | 管理员创建时可选 `scope: tenant` | `model_configs.py` | A1 |

### Phase B: 前端桌面端 (Electron)（3 天）

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| B1 | 本地 JSON 存储服务 `src/main/services/model-config-local.ts`（比删掉的那个更简洁：只存 key+base_url，用于直连 LLM） | `src/main/services/model-config-local.ts` | — |
| B2 | ModelConfigSettings 表单加「仅本机保存」checkbox +「租户共享」checkbox（管理员可见） | `src/components/ModelConfigSettings.tsx` | A1 |
| B3 | 新增 IPC handler `MODEL_CONFIG_SAVE_LOCAL`——写本地 JSON | `src/main/services/ipc-handlers.ts` | B1 |
| B4 | ModelSelector 合并本地列表 + 后端列表，标记来源 | `src/components/ModelSelector.tsx` | B3 |
| B5 | EXECUTE_TASK handler 判断模型来源：本地 → 本地 AIService 直连；云 → 后端代理 | `src/main/services/ipc-handlers.ts` | A3, B1 |
| B6 | 本机存储模型的测试连接功能（本地直连） | `src/main/services/ai.ts` | B1 |

### Phase C: Web / 移动端适配（2 天）

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| C1 | 能力门禁 `isElectronDesktop()` 控制「仅本机保存」是否渲染 | `src/lib/capabilities.ts`, `ModelConfigSettings.tsx` | B2 |
| C2 | Web/移动端不渲染「仅本机保存」选项（不是灰掉，是直接不显示） | `ModelConfigSettings.tsx` | C1 |
| C3 | ModelSelector Web/移动端：只展示后端模型（含租户共享） | `ModelSelector.tsx` | B4 |
| C4 | Web/移动端发消息 → 后端代理 | 已由 Phase A3 覆盖 | A3 |

### Phase D: 租户共享集成（1 天）

| # | 任务 | 改动范围 | 前置 |
|---|------|---------|------|
| D1 | 后端列表端点按 scope 过滤：个人模型 + 租户共享模型 | `model_configs.py` | A4 |
| D2 | 管理员可见「租户共享」checkbox + 管理租户共享模型列表 | `ModelConfigSettings.tsx` | B2, A4 |
| D3 | Web 端无个人模型时自动展示租户共享模型 | `ModelSelector.tsx` | C3, D1 |

---

## 改动范围总览

```
后端:
  backend/app/db/models.py           [+2 字段]
  backend/app/api/model_configs.py   [+ /local 端点, + scope 过滤]
  backend/app/core/llm_proxy.py      [本机直连旁路判断]

前端共享:
  src/components/ModelConfigSettings.tsx [+checkbox, +tooltip, +能力门禁]
  src/components/ModelSelector.tsx   [合并本地+后端列表, 来源标记]

桌面端:
  src/main/services/model-config-local.ts  [新建: 本机存储]
  src/main/services/ipc-handlers.ts  [+直连 vs 代理分流]

Web:
  src/lib/capabilities.ts            [hasLocalStorage]
  src/renderer/preview/browserStubs.ts [无额外变更, 现有 stubs 已处理]
```

---

## 关键决策

1. **桌面端默认本机直连**：添加模型时「仅本机保存」默认勾选，用户可手动取消以上传后端。Web/移动端无此选项，必走后端代理。
2. **本机存储持久化方案**：桌面端用 `%APPDATA%/BspBuddy/model-configs-local.json` 文件，与 Electron `app.getPath('userData')` 对齐。不上传到后端。
3. **本机 vs 云混合列表**：ModelSelector 拉取时并行加载本地 + 后端列表，合并去重（按 id），标记 `source: 'local' | 'cloud'`。
4. **LLM 调用分流**：EXECUTE_TASK handler 判断 `model.source === 'local'` 时用本地 AIService 直连，否则走后端 LLM 代理。
5. **模型 ID 冲突**：本地模型 ID 用 `local_<uuid>` 前缀，后端模型 ID 用 `model_` 前缀，保证不冲突。

---

## 依赖

- 依赖 `architecture-01` Phase 5 认证统一完成（Web 端需要登录后才能加载模型列表）
- 无需等待 auth-001 RBAC 完成——当前用 tenant_demo 参数即可
