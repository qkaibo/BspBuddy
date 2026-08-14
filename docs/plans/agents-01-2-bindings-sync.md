---
id: agents-01-2
title: 本地绑定同步到后端 AgentResourceBinding
type: plan
related: [agents-01-1, agents-004]
parent: agents-01
---

# 本地绑定同步到后端

> 父 Plan: [agents-01](agents-01-expert-management.md)
> Tech Spec: [agents-004 专家执行环路](../tech-spec/agents-004-agent-loop.md)
> Status: ⚒️ 进行中

## 背景

前端 `SkillsPanel` / `McpPanel` 通过 `RESOURCE_IMPORT` IPC 将技能/MCP 安装到专家时，只写了本地 `ExpertBindings` JSON 文件。但后端 HarnessV2Engine 执行专家对话时，读的是数据库 `AgentResourceBinding` 表。**两边数据不同步，导致本地安装的技能后端不可见。**

## 现状分析

| 操作 | 本地持久化 | 后端同步 | 后果 |
|---|---|---|---|
| `RESOURCE_IMPORT(general_skill)` | `expertService.addBinding()` → 本地 JSON | ❌ 未同步 | Skill 在后端对话中不可用 |
| `RESOURCE_IMPORT(mcp)` | `expertService.addBinding()` → 本地 JSON | ❌ 未同步 | MCP 工具在后端对话中不可用 |
| `RESOURCE_UNBIND(general_skill)` | `expertService.unbindResources()` → 本地 JSON | ❌ 未同步 | 残留后端绑定 |
| `RESOURCE_UNBIND(mcp)` | `expertService.unbindResources()` → 本地 JSON | ❌ 未同步 | 残留后端绑定 |

## 实现方案

### 核心改动

```
RESOURCE_IMPORT IPC handler
  ├─ 1. expertService.addBinding()  → 本地 JSON（保持不变）
  └─ 2. syncBindingToBackend()     → POST/PUT AgentResourceBinding（新增）
```

### 改动文件

```
src/main/services/ipc-handlers.ts         ← RESOURCE_IMPORT/UNBIND 增加后端同步
src/main/services/fastapi-client.ts       ← _syncAgentResources()
src/lib/types.ts                          ← EXPERT_RESOURCE_SYNC（可选，供调试）
docs/tech-spec/agents-004-agent-loop.md
docs/plans/agents-01-2-bindings-sync.md  ← 本文件
docs/prd/agents-002-editor-ux.md         ← 补充运行时章节
```

### Phase A：同步 RESOURCE_IMPORT

**目标**：安装技能/Tool 到专家时，同时调用后端 API 创建绑定。

**流程**：

```
RESOURCE_IMPORT({ targetAgentId, sourceAgentId, resourceType, resourceIds })
  │
  ├─ 1. 本地持久化（保持不变）
  │     expertService.addBinding(targetAgentId, resourceType, resourceId)
  │
  ├─ 2. 后端同步（新增）
  │     对于 resourceType 映射：
  │
  │     resourceType === "sop"       → backendType = "skill"
  │     resourceType === "general_skill" → backendType = "general_skill"
  │     resourceType === "mcp"       → backendType = "tool"
  │     resourceType === "knowledge" → backendType = "knowledge_base"
  │
  │     可选路径 A（全量替换）：
  │       GET /api/enterprise/agents/{agentId}/resources      ← 获取现有绑定列表
  │       [合并新增的 resourceIds]
  │       PUT /api/enterprise/agents/{agentId}/resources      ← 覆盖写入
  │       body: { tenant_id, resources: [...existing, ...new] }
  │
  │     可选路径 B（增量添加，需先查，但如果后端已有旧绑定会重复）：
  │       不用 import endpoint——它是从别的 agent 复制，不是直接加
  │
  │     选路径 A：PUT 全量同步，保持本地和远端一致
  │
  └─ 3. 返回结果
        { status: "ok", synced: true/false }
```

**注意**：
- MCP 同步需要特殊处理：后端 `AgentResourceType` 是 `"tool"`，不是 `"mcp"`。MCP 工具在后端是 `Tool` 表 + `MCPServer` 表的组合。本次只同步已注册的 Tool 记录；MCP Server 本身的注册不在本 phase 范围。
- 如果后端 agent 不存在（`status_code === 404`），跳过同步并返回 warning。
- 同步失败不阻塞本地操作（返回 `synced: false, sync_error: "..."`）。

### Phase B：同步 RESOURCE_UNBIND

**目标**：卸载/移除时，同时从后端删除绑定。

**流程**：

```
RESOURCE_UNBIND({ targetAgentId, resourceType, resourceIds })
  │
  ├─ 1. 本地移除（保持不变）
  │     expertService.unbindResources(targetAgentId, resourceType, resourceIds)
  │
  ├─ 2. 后端同步（新增）
  │     GET /api/enterprise/agents/{agentId}/resources
  │     [过滤掉要删除的 resourceIds]
  │     PUT /api/enterprise/agents/{agentId}/resources
  │     body: { tenant_id, resources: remaining }
  │
  └─ 3. 返回结果
```

### Phase C：EXPERT_CREATE 同步

**目标**：新建专家时，如果本地已有 FastAPI 后端，确保专家记录在两处都存在。

**当前状态**：`EXPERT_CREATE` 已调用 `fastApiFetch('POST', '/api/enterprise/agents', ...)` 写后端。如果后端不可达，fallback 到本地。这部分已基本实现，本 phase 主要是确认。

### 资源 ID 映射问题

| 资源来源 | 本地 ID | 后端 ID 格式 | 是否一致 |
|---|---|---|---|
| GENERAL_SKILL_LIST (FastAPI) | `FastAPI GeneralSkill.id` | 同上 | ✅ 一致 |
| SKILL_LIST (本地 skill-service) | `skill-user-{uuid}` | 后端无此类 | ❌ 不同步本地创建 |
| MCP URL 直接添加 | 本地存储 JSON string 在 bindings | `Tool.id`（需后端已注册） | ❌ 需先注册 Tool |

**结论**：
- **FastAPI general_skill**：直接同步（`resource_id` 对齐）
- **本地创建的 skill**（`SKILL_CREATE`）：不同步到后端（后端无对应 GeneralSkill 实体）。正确路径是先通过 `POST /api/enterprise/general-skills/import` 上传到后端，再安装。
- **MCP**：同步的是 `Tool.id`，MCP 工具需先在后端注册为 Tool 记录。本地 McpPanel 目前存的是 URL+名称 JSON string，需改造为后端 Tool 实体后才能同步。

## 验收标准

- [ ] 从 GENERAL_SKILL_LIST 安装技能到专家 → 后端 `AgentResourceBinding` 表有对应记录
- [ ] 卸载技能 → 后端绑定被移除
- [ ] 后端不可达时安装不中断（synced=false，本地仍生效）
- [ ] 后端已有现有绑定不被误删（PUT 全量合并而非覆盖）
- [ ] L2：`curl` 验证安装后的绑定可见

### Phase D：MCP 服务器端存储（2026-08-09 新增）

**背景**：当前 MCP 绑定存在本地 `binding-overrides.json`（`mcpServers` 字段），以 JSON string 存储 MCP 名称+URL。后端 `agent_resource_bindings` 表不支持 `resource_type='mcp'`，导致服务端 agent loop 完全看不到专家的 MCP 工具。

**原则**：专家系统的所有数据必须在服务器端——因为专家的 agent loop 运行在服务器上。

**方案**：

```
MCP 绑定流程（改造后）:
│
├─ 1. 用户在 McpPanel 选择/添加 MCP 服务器
│     → 写入 MCPServer 表（如尚未存在）
│     → 返回 MCPServer.id（如 mcpsrv_xxx）
│
├─ 2. 用户点击「安装到专家」
│     → RESOURCE_IMPORT({ resourceType: "mcp", resourceIds: [MCPServer.id] })
│       ├─ 本地：不再写 binding-overrides.json（Phase D 废弃本地 MCP 存储）
│       └─ 后端：PUT /api/enterprise/agents/{agentId}/resources
│           body: { resources: [...existing_bindings, { resource_type: "mcp", resource_id: "mcpsrv_xxx", status: "active" }] }
│
├─ 3. CapabilityManifestBuilder.build(agent_id)
│     → 查 agent_resource_bindings (resource_type='mcp', status='active')
│     → 对每条 mcp 绑定，查 MCPServer + 已发现的 tools 列表
│     → 将所有 MCP 工具注入 agent 的 capability manifest
│     → agent loop 自主决定调用哪个 MCP 工具
│
├─ 4. 用户点击「从专家移除」
│     → RESOURCE_UNBIND({ resourceType: "mcp", resourceIds: ["mcpsrv_xxx"] })
│       └─ 后端：PUT 全量替换（过滤掉指定 resource_id）
└─
```

**资源 ID 映射（修订后）**：

| 资源来源 | 本地存储 | 后端 resource_type | 后端 resource_id | 同步策略 |
|---|---|---|---|---|
| FastAPI GeneralSkill | `binding-overrides.json` → 废弃 | `general_skill` | `GeneralSkill.id` | PUT 全量同步 |
| MCP 服务器 | ~~`binding-overrides.json`~~ **废弃** | **`mcp`**（新增） | `MCPServer.id`（如 `mcpsrv_xxx`） | PUT 全量同步 |
| SOP Skill | `binding-overrides.json` → 废弃 | `skill` | `Skill.id` | PUT 全量同步 |

**改动清单**：

```
Phase D 改动文件:
├── backend/app/db/models.py                 ← AgentResourceBinding 无 schema 变化（resource_type 是 string）
├── backend/app/core/capability_manifest.py  ← CapabilityManifestBuilder.build() 增加 resource_type='mcp' 解析
├── src/main/services/ipc-handlers.ts        ← RESOURCE_IMPORT/UNBIND: MCP 路径改走服务器 API
├── src/main/services/expert-service.ts      ← addBinding/unbindResources: MCP 不再写本地 JSON
├── src/lib/types.ts                         ← 如需新的 IPC channel（视情况）
├── docs/plans/agents-01-2-bindings-sync.md  ← 本文件
└── docs/prd/agents-002-editor-ux.md         ← MCP 章节 + 运行时链路
```

**验收标准（Phase D）**：

- [ ] 用户安装 MCP 到专家 → 后端 `agent_resource_bindings` 出现 `resource_type='mcp'` 记录
- [ ] 用户从专家移除 MCP → 后端对应绑定消失
- [ ] `CapabilityManifestBuilder.build(H618_agent_id)` 返回的 manifest 包含 MCP 工具
- [ ] 本地 `binding-overrides.json` 中不再有 `mcpServers` 写入（已有数据做一次性迁移）
- [ ] 专家卡片 UI 的 MCP 数量从后端 API 读取（不再是本地 JSON）
- [ ] L2：`curl GET /api/enterprise/agents/{agentId}/resources` → 返回含 `resource_type=mcp` 的绑定列表
