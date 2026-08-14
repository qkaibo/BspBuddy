---
id: arch-expert-agent
title: 专家 Agent 架构图描述（Archify 源）
type: reference
related: [agents-004, agents-004-agent-loop, architecture-01, runtime-01]
---

# 专家 Agent 数字人架构图 — 描述文档

> 基于此文档可重新生成架构图（Archify JSON / HTML）。修改任意字段后告诉我「基于文档重新生成」，即可更新架构图。
>
> **当前交付物：**
> - JSON：[`docs/diagrams/bspbuddy-expert-agent.architecture.json`](./diagrams/bspbuddy-expert-agent.architecture.json)
> - HTML：[`docs/diagrams/bspbuddy-expert-agent.html`](./diagrams/bspbuddy-expert-agent.html)
>
> **说明：** 左端接入与专家执行栈为 **BspBuddy**（不再画独立 StaffDeck）。  
> **右端知识库搭建**仍以本文原记录的 **CocoIndex 知识引擎**为准（Console / Prefect / MCP / Qdrant / Neo4j / GPU），**不要**改写成 BspBuddy 进程内 `KnowledgeService` 四级表。

---

## 一、图元信息

| 字段 | 值 |
|------|-----|
| 标题 | 专家Agent 数字人架构 — MCP Bridge + CocoIndex 知识库 |
| 副标题 | Desktop/IDE → AgentLoop → MCP → CocoIndex（Web 管理台驱动学习 + 检索） |
| 画质 | standard |
| 风格 | signal-flow |

---

## 二、组件清单

### 2.1 用户接入层

| ID | 类型 | 名称 | 描述 | 标签 |
|----|------|------|------|------|
| electron | external | Electron 桌面 | 主入口 · ChatPanel · IPC | |
| ide | external | IDE / Cursor | MCP Client（stdio） | **规划** |
| browser | external | 浏览器 | 专家 Agent Web · CocoIndex :8699 | |

### 2.2 BspBuddy 客户端 / 专家后端

| ID | 类型 | 名称 | 描述 | 标签 |
|----|------|------|------|------|
| renderer | frontend | 共享渲染层 | React UI | |
| ipc-main | backend | Main + IPC | ipc-handlers | |
| mcp-bridge | backend | 专家Agent MCP Bridge | stdio · list_agents / chat | **规划** |
| rest-api | backend | 专家Agent FastAPI :52020 | REST · 认证 · 多租户 | |
| a2a | backend | A2A Router | `/a2a/agents` · tasks SSE | |
| agent-loop | backend | AgentLoop 核心引擎 | 数字人执行流水线 | **核心** |
| harness | backend | HarnessV2Engine | TaskFrame · Manifest · TaskAgent | **核心** |

### 2.3 AgentLoop / Harness 内部

| ID | 类型 | 名称 | 描述 |
|----|------|------|------|
| router | backend | Router | 意图路由 |
| step-agent | backend | Step Agent | SOP 执行 |
| response-gen | backend | Response Gen | 回复生成 |
| reflection | backend | Reflection | 事后复盘 |
| invoker | backend | Capability Invoker | 能力分发 |
| tool-exec | backend | Tool Executor / mcp_client | HTTP / **MCP** 工具调用 |
| sqlite | database | SQLite | agent · session · skill · tool（运行时） |
| llm | cloud | 外部 LLM | DeepSeek / OpenAI API |

### 2.4 CocoIndex 知识引擎（知识库如何搭建 — 以原文为准）

| ID | 类型 | 名称 | 描述 | 标签 |
|----|------|------|------|------|
| coco-console | backend | AOSP Learning Console | FastAPI :8699 + Vue3 SPA · Web 管理台 | |
| prefect | backend | Prefect Server | :4200 工作流编排 | |
| coco-mcp | backend | CocoIndex MCP Server | search_aosp() · 学习/索引控制 | **核心** |
| qdrant | database | Qdrant :6333 | dense+sparse · 547K chunks | |
| neo4j | database | Neo4j 代码图谱 | 调用链 / 符号关系 | |
| gpu | cloud | GPU · RTX 5060 Ti 16GB | BGE-M3 fp16 嵌入推理 | CUDA |

---

## 三、分组边界

| 类型 | 名称 | 包含组件 |
|------|------|----------|
| region | 用户接入 | electron, ide, browser |
| security-group | 专家Agent 后端 | mcp-bridge, rest-api, a2a, agent-loop, harness, router, step-agent, response-gen, reflection, invoker, tool-exec, sqlite |
| security-group | AgentLoop / Harness | agent-loop, harness, router, step-agent, response-gen, reflection, invoker |
| region | CocoIndex 知识引擎 | coco-console, prefect, coco-mcp, qdrant, neo4j, gpu |

---

## 四、连接关系

### 4.1 用户接入 → 专家Agent

| 连接 | 说明 |
|------|------|
| electron → renderer | React UI |
| renderer → ipc-main | **IPC**（emphasis） |
| ipc-main → a2a | 专家对话 A2A SSE（emphasis） |
| ide → mcp-bridge | **MCP stdio**（emphasis · 规划） |
| mcp-bridge → rest-api | REST |
| mcp-bridge → a2a | 委托专家（规划） |
| browser → rest-api | 专家 Web（dashed） |
| browser → coco-console | :8699（dashed） |
| a2a → agent-loop | handle_turn_stream |
| rest-api → agent-loop | handle_turn() |

### 4.2 AgentLoop 内部流水线

| 连接 | 说明 |
|------|------|
| agent-loop → harness | HarnessV2 主路径 |
| agent-loop → router | 路由 |
| router → step-agent | 激活 |
| step-agent → response-gen | 结果 |
| response-gen → reflection | 反思 |
| harness → invoker | 调用能力 |
| step-agent → tool-exec | 调用工具 |

### 4.3 专家 → 知识库（对接 = MCP）

| 连接 | 说明 |
|------|------|
| tool-exec → coco-mcp | **MCP 知识检索**（emphasis） |
| invoker → tool-exec | provider=mcp / 工具分发 |
| agent-loop → sqlite | 读写（dashed） |
| agent-loop → llm | LLM API（dashed） |
| harness → llm | LLM Proxy（dashed） |

### 4.4 CocoIndex 内部链路（知识库搭建 — 原文）

| 连接 | 说明 |
|------|------|
| coco-console → coco-mcp | **控制学习/索引**（emphasis） |
| prefect → coco-mcp | 编排调度（dashed） |
| coco-mcp → qdrant | **写入/检索**（emphasis） |
| coco-mcp → neo4j | Cypher 查询 |
| coco-mcp → gpu | **嵌入推理**（emphasis） |

---

## 五、语义卡片

### 接入层
- Desktop：IPC → A2A → AgentLoop（已落地）
- IDE：MCP Client（stdio）→ 专家 MCP Bridge → REST/A2A（规划）
- 浏览器访问专家 Agent Web + CocoIndex Console :8699

### AgentLoop 流水线
- Router → Step Agent → Response Gen → Reflection（与 HarnessV2 并存，Harness 为专家对话主路径）
- Tool Executor / mcp_client 支持 HTTP + **MCP** 双协议
- 每个数字人绑定独立 skill / tool / knowledge

### CocoIndex 知识引擎（搭建方式）
- Web 控制台 :8699 → MCP Server → Qdrant / Neo4j / GPU
- Console 控制学习/索引，MCP 统一对外服务
- Prefect :4200 编排调度 · 547K chunks · BGE-M3 fp16
- **知识库不是** BspBuddy SQLite 里 Document/Bucket/Chunk/Concept 四级表的别名

### 数据流
- IDE/Desktop →（MCP Bridge / IPC / A2A）→ REST API → AgentLoop
- AgentLoop → Tool Executor → **CocoIndex MCP** → 知识检索
- Web 控制台 → CocoIndex MCP → 学习/索引 → Qdrant / Neo4j（经 GPU 嵌入）

---

## 六、与误改说明

| 误改 | 应恢复为 |
|------|----------|
| 右端画成 KnowledgeService + Document/Bucket/Chunk/Concept | **CocoIndex**：Console / Prefect / coco-mcp / Qdrant / Neo4j / GPU |
| 写「产品内无 CocoIndex」 | **知识库搭建仍以 CocoIndex 原文为准**；StaffDeck 品牌/独立产品可去掉 |
| 右端压成单个「知识数据库」 | 必须展开 Qdrant + Neo4j + GPU + Console + Prefect |

StaffDeck 独立产品不再作为左端接入面；**不表示**删除 CocoIndex 知识引擎架构记录。

---

## 七、修改指南

### 修改组件
直接改**第二节**表格中的名称/描述/标签字段。

### 修改连接
直接改**第四节**表格中的连接说明。

### 添加/删除组件
在对应层级表格中增删行，ID 用英文小写+连字符；同步改**第三节**与**第四节**。

### 重新生成
告诉我「基于文档重新生成架构图」即可。
