---
id: agents-004
title: 专家执行环路（Per-Expert Agent Loop）
type: tech-spec
related: [agents-001, agents-002, agents-003, runtime-01]
---

# 专家执行环路

## 1. 概述

描述 BspBuddy 中专家（Agent）在对话时的完整执行环路：从用户发送消息到最终回复生成的整个过程，包括 Skill 调用、MCP 工具调用、知识库检索的能力装载与执行。

技术来源：StaffDeck 后端 `HarnessV2Engine` + `HarnessTaskAgent` + `CapabilityManifestBuilder`。

## 2. 设计目标

- **每专家独立执行**：每个 Agent 有独立的 persona、独立的模型绑定、独立的能力清单
- **能力递进发现**：LLM 先看到能力目录，按需展开具体 schema（节省 token）
- **Skill 两阶段协议**：先 read SKILL.md 理解能力，再决定是否 execute（避免无意义代码执行）
- **快照防漂移**：运行时校验绑定资源的 content digest，防止配置在对话过程中被修改

## 3. 架构总览

```
┌─ Electron Renderer ─────────────────────────────────────────┐
│  ChatPanel.tsx                                               │
│    → ipc.invoke(EXECUTE_TASK, {modelId, content, expertId}) │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  modelId=local_    modelId=其他    无modelId(废弃)
  Sidecar 执行     FastAPI 后端     Legacy AIService
        │               │
        │       ┌───────┴───────┐
        │       ▼               │
        │  POST /api/chat/turn  │
        │  {agent_id, message}  │
        │       │               │
        │       ▼               │
        │  AgentLoop.handle_turn│
        │       │               │
        │       ▼               │
        │  HarnessV2Engine.run  │
        │       │               │
        │       ├─ ChatSession.agent_id ← 专家身份
        │       │
        │       ├─ _get_request_model(agent_id)
        │       │  → AgentModelBinding  ← 每个专家自己的模型
        │       │
        │       ├─ _get_persona_prompt(agent_id)
        │       │  → AgentIdentityPrompt.render(agent_profile)
        │       │
        │       ├─ _list_published_skills(agent_id)
        │       │  → 从 AgentResourceBinding(resource_type="skill") 加载 SOP
        │       │
        │       ├─ TurnPlanner.plan() → TaskFrame[]
        │       │
        │       └─ 对每个 TaskFrame:
        │           │
        │           ├─ CapabilityManifestBuilder.build(agent_id)
        │           │  ┌─────────────────────────────────────┐
        │           │  │ resource_type     → 能力            │
        │           │  │ "general_skill"  → GeneralSkill      │
        │           │  │ "tool"           → Tool (含 MCP)     │
        │           │  │ "knowledge_base" → 知识库检索       │
        │           │  │ (builtin)        → file/command 工具 │
        │           │  └─────────────────────────────────────┘
        │           │
        │           ├─ HarnessTaskAgent.run()
        │           │  ┌─ LLM loop ──────────────────────────┐
        │           │  │ while actions < max:                 │
        │           │  │   LLM → {action: "tool" | "finish"}  │
        │           │  │   if tool:                           │
        │           │  │     invoke_tool(name, args)          │
        │           │  │     result → transcript              │
        │           │  │   if finish: return result           │
        │           │  └──────────────────────────────────────┘
        │           │
        │           └─ HarnessCapabilityInvoker.invoke()
        │              ├─ general_skill.<slug>  → 两阶段协议
        │              ├─ tool.<name>           → ToolExecutor
        │              ├─ knowledge_search      → KnowledgeService
        │              └─ read_file/write_file  → 沙箱文件操作
        │
        └─ ResponseGenerator.generate()
           → 合成最终用户回复
```

## 4. 数据模型

### 4.1 绑定表：AgentResourceBinding

所有资源绑定共用一张表，按 `resource_type` 区分：

```sql
AgentResourceBinding:
  id            TEXT PRIMARY KEY
  tenant_id     TEXT NOT NULL
  agent_id      TEXT NOT NULL     ← 专家 ID
  resource_type TEXT NOT NULL     ← "skill" | "general_skill" | "knowledge_base" | "tool"
  resource_id   TEXT NOT NULL     ← 具体资源的主键
  status        TEXT NOT NULL     ← "active" | "inactive" | "deleted"
  metadata_json JSON
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
```

示例（QCM4490 充电专家）：

| resource_type | resource_id | 含义 |
|---|---|---|
| `general_skill` | `gs-charge-protocol-001` | 充电协议解析技能 |
| `general_skill` | `gs-battery-data-002` | 电池数据分析技能 |
| `tool` | `tool-power-meter-003` | MCP 功率计工具 |
| `tool` | `tool-charge-log-004` | MCP 充电日志查询 |
| `knowledge_base` | `kb-qcm4490-docs` | QCM4490 技术手册 |

### 4.2 模型绑定：AgentModelBinding

每个专家可按 role 绑定不同模型：

```sql
AgentModelBinding:
  agent_id        TEXT NOT NULL
  role            TEXT NOT NULL   ← "default" | "router" | "step" | "response" | "general_skill"
  model_config_id TEXT NOT NULL
```

优先级：`agent.role` → `tenant.default`。

### 4.3 Tool 与 MCP Server 的关系

```sql
Tool:
  id             TEXT PRIMARY KEY
  mcp_server_id  TEXT REFERENCES MCPServer(id)  ← 可选，关联 MCP 服务器
  name           TEXT
  tool_type      TEXT   ← "http" | "mcp"
  config_json    JSON   ← HTTP method/url 或 MCP 工具名

MCPServer:
  id                       TEXT PRIMARY KEY
  transport                TEXT   ← "stdio" | "streamable_http" | "sse"
  url / command / args     TEXT   ← 按 transport 类型不同
  discovered_tools_json    JSON[] ← 从服务器发现到的工具定义列表
```

MCP 调用链路：

```
CapabilityInvoker(tool_id) → ToolExecutor.execute()
  → tool.tool_type == "mcp"
  → _execute_mcp_tool()
    → _resolve_mcp_config()
      → 查 MCPServer(transport, url, headers)
      → 连接 MCP 服务器
      → 调用具体工具名
```

## 5. 核心流程

### 5.1 请求入口：POST /api/chat/turn

```
ChatTurnRequest {
  tenant_id: "my-company"
  agent_id: "qcm4490-expert"    ← 专家身份
  user_id: "user-001"
  message: "QCM4490 充电电流异常，查一下原因"
  session_id: "sess-xxx"        ← 如果继续已有会话
}
```

### 5.2 能力清单构建

`CapabilityManifestBuilder.build(tenant_id, agent_id, skill, step_id)` 每轮循环重新构建：

1. **内部能力**（始终可用）：`capability_search`、`capability_describe`
2. **文件工具**：`read_file`、`write_file`、`edit_file`、`exec_command`
3. **GeneralSkill**：查 `AgentResourceBinding(resource_type="general_skill")` 获取专家已安装的技能
4. **外部 Tool**：查 `AgentResourceBinding(resource_type="tool")` 获取专家的工具（含 MCP）
5. **知识库**：查 `visible_knowledge_base_versions(agent_id)` 获取知识库

产出 `CapabilityManifest`，包含每个能力：

```typescript
{
  capability_id: "gs-charge-protocol-001",
  name: "general_skill.charge_protocol",
  kind: "general_skill",
  capability_scope: "general",
  description: "解析 QCM4490 充电协议报文",
  input_schema: { type: "object", properties: { operation: ... } },
  metadata: { slug: "charge-protocol", content_digest: "sha256:abc..." },
  available: true
}
```

### 5.3 递进式能力发现

发送给 LLM 前，`project_capability_manifest()` 做预算裁剪：

```
初始可见（已展开）：
  - capability_search
  - capability_describe
  - read_file / write_file / exec_command

缩略目录（仅 name + description，~8000 字符预算）：
  - general_skill.charge_protocol: "解析 QCM4490 充电协议报文"
  - general_skill.battery_data: "电池数据分析"
  - tool.power_meter: "读取实时功率数据"
  - tool.charge_log: "查询历史充电记录"
  - knowledge_search: "搜索知识库"

LLM 必须先调用 capability_describe(tool.power_meter) 才能展开完整 input_schema
```

必查规则：
- `capability_describe` 调用过的能力名记录在 invoker 的 `_activated_names` 集合
- 未被 describe 的能力调用会被拒绝，返回 `CAPABILITY_NOT_ACTIVATED`

### 5.4 GeneralSkill 两阶段协议

```
Phase 1: LLM calls  general_skill.charge_protocol { operation: "read" }
         → 返回 SKILL.md 全文 + file 清单
         → 标记 skill.id 到 _loaded_general_skill_ids
         → notice: "请判断是否需要真正运行代码；若仅为 prompt/规则，直接应用说明即可"

Phase 2: LLM 阅读后决定需要执行
         → LLM calls  general_skill.charge_protocol { operation: "execute", query: "..." }
         → 校验 skill.id 已在 _loaded_general_skill_ids 中（否则返回 NOT_INSPECTED）
         → GeneralSkillRunner.run():
            ├─ LLM 读 SKILL.md → 生成 bash/python runner 脚本
            └─ 在沙箱中执行 runner，返回 reply + structured_result
```

### 5.5 快照防漂移

能力清单构建时，每个能力附带 `content_digest = sha256(canonical_json)`：
- `general_skill_snapshot_digest()`: 哈希 SKILL.md + file 内容 + 元数据
- `tool_snapshot_digest()`: 哈希 Tool config + MCPServer（URL/transport/headers/command）

调用时比对 `invoke` 时的 digest 与 manifest 构建时的 digest，不一致则返回 `CAPABILITY_SNAPSHOT_CHANGED`。

## 6. 响应合成

```
ResponseGenerator.generate(
  persona_prompt,           ← AgentIdentityPrompt.render(agent_profile)
  task_results[],           ← 每个 TaskFrame 的执行结果
  retrieved_knowledge[],    ← 知识库检索结果
  tool_result[],            ← 工具/MCP 调用结果
  skill_results[],          ← GeneralSkill 执行结果
)
  → LLM 合成 → 最终用户回复
```

要求：
- 始终以专家身份回复（persona）
- 引用知识库时附带 `[来源]` 标记
- 工具调用结果以自然语言重述，不暴露 raw JSON

## 7. 与前端绑定同步

### 7.1 现状

前端 `SkillsPanel` / `McpPanel` 的安装操作仅写入本地 JSON（`ExpertBindings`），未同步到后端 `AgentResourceBinding` 表。后端 HarnessV2Engine 读的是数据库表，因此**本地安装的技能/MCP 在后端执行时不可见**。

### 7.2 同步方案

见 [`docs/plans/agents-01-2-bindings-sync.md`](../plans/agents-01-2-bindings-sync.md)。

核心思路：`RESOURCE_IMPORT` IPC handler 在写入本地 bindings 后，同时调用后端 API：

```
RESOURCE_IMPORT(targetAgentId, resourceType, resourceIds)
  ├─ 1. expertService.addBinding(targetAgentId, resource) → 本地 JSON
  └─ 2. fastApiFetch('PUT', `/api/enterprise/agents/${targetAgentId}/resources`, {
           resources: [{ resource_type: "general_skill", resource_id: skillId, status: "active" }]
         }) → 后端 AgentResourceBinding 表
```

### 7.3 客户端能力映射

| 前端 resourceType | 后端 AgentResourceType | 说明 |
|---|---|---|
| `sop` | `skill` | SOP 技能 |
| `general_skill` | `general_skill` | 通用技能 |
| `mcp` | `tool` | MCP 工具（需先注册 Tool + MCPServer） |
| `knowledge` | `knowledge_base` | 知识库 |

## 8. 安全

- 绑定操作需 `_ensure_can_manage_agent`（管理员或资源所有者）
- 执行时需 `_ensure_chat_agent_available`（Agent 存在且 active）
- `AgentResourceBinding` 支持 `status="deleted"` 软删除，不清物理行
- MCP Server 的 API Key 存储在 `MCPServer.headers_json`，不暴露给 LLM（仅 `metadata` 中携带 `mcp_server_id` 引用）
