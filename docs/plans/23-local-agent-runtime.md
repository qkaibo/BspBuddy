---
id: runtime-01
title: 本地 Agent 运行时（Python Sidecar + ReAct + Tool Use）
type: plan
related: [architecture-01, settings-001, agents-003]
---

# 本地 Agent 运行时

> Status: 🟡 P0 进行中（Phase 1 ✅ Python Sidecar 骨架 + 最简 ReAct 循环；Phase 2–4 🟡 进行中）

## 概述

把 BspBuddy 当前 Electron 主进程里的临时 AIService（正则解析 JSON）替换为独立 Python Sidecar 进程，复用 AgentCore 的 Sidecar 框架 + ReAct 引擎，实现工具调用的 function calling 原生支持，从根本上消除 JSON 解析异常。

**当前问题**：`src/main/services/ai.ts` 用正则 `/```json\s*([\s\S]*?)\s*```/` 从 LLM 文本中提取 JSON，特殊字符导致解析崩溃，用户看到原始 JSON。

**目标方案**：Python Sidecar 进程（stdin/stdout JSON-RPC）→ AgentCore ReAct 循环 → OpenAI function calling (tool_use) → 流式 SSE 事件回传 Electron。

## 运行模式选择

| 模式 | 何时用 | LLM 地址 | 工具执行 | 引擎 |
|---|---|---|---|---|
| **本地 Sidecar** | 选了"本机保存"的模型 | 用本地 api_key 直连 OpenAI | 本地 Python 函数 | Sidecar ReAct |
| **云代理** | 选了租户共享模型 | POST `/api/chat/proxy/send` → 后端加密 key | 后端工具 | 后端 AgentLoop |
| **无网络** | 离线环境 | 本地 Ollama / LM Studio | 本地 Python 函数 | Sidecar ReAct |

> 本地 Sidecar 与云代理共存在 `EXECUTE_TASK` handler 中，按 `modelId` 前缀路由：
> - `modelId.startsWith('local_')` → Sidecar JSON-RPC
> - 其他 → `_planViaBackend()` 不走 Sidecar

## 架构

```
┌───────────────────────────────────────────────┐
│              BspBuddy Electron                │
│                                               │
│  ChatPanel (React)                            │
│    → useAgent.sendMessage(content, modelId)   │
│    → IPC invoke('agent:execute-task', ...)    │
│                                               │
│  Main Process                                 │
│    ├─ modelId.startsWith('local_') →          │
│    │    sidecarService.startTurn(...)          │
│    │       │ stdin JSON-RPC                   │
│    │       ▼                                  │
│    │   ┌──────────────────────┐               │
│    │   │  Python Sidecar 进程  │               │
│    │   │  (bspbuddy_runtime)  │               │
│    │   │                      │               │
│    │   │  SidecarServer       │               │
│    │   │  ├─ initialize       │               │
│    │   │  │  workspaceRoot    │               │
│    │   │  │  inference:{model,│               │
│    │   │  │    apiKey,baseUrl}│               │
│    │   │  │                  │               │
│    │   │  ├─ startTurn        │               │
│    │   │  │  → ReAct Loop ───→│               │
│    │   │  │    ┌──────────┐   │               │
│    │   │  │    │ LLM      │   │               │
│    │   │  │    │ (tool_use)│  │               │
│    │   │  │    └────┬─────┘   │               │
│    │   │  │         │         │               │
│    │   │  │    ┌────▼─────┐   │               │
│    │   │  │    │ ToolExec  │  │               │
│    │   │  │    │ 本地函数   │  │               │
│    │   │  │    └──────────┘   │               │
│    │   │  │                   │               │
│    │   │  └─ → SSE events    │               │
│    │   │     (content_delta, │               │
│    │   │      tool_use_start,│               │
│    │   │      message_final) │               │
│    │   └──────────────────────┘               │
│    │         ↑ stdout JSON-RPC                │
│    │                                          │
│    └─ modelId 非 local → _planViaBackend()    │
│         → POST /api/chat/proxy/send           │
└───────────────────────────────────────────────┘
```

## 分期

### Phase 1：Python Sidecar 骨架 + 最简 ReAct 循环（本阶段）

**目标**：让 BspBuddy 能启动本地 Python Sidecar，发一条消息，得到流式文本回复。

**文件清单**：

```
python/bspbuddy_runtime/          ← 新建 Python package
├── __init__.py
├── __main__.py                   ← Sidecar 入口 (python -m bspbuddy_runtime)
├── protocol.py                   ← JSON-RPC 2.0 帧协议 (复用 AgentCore 设计)
├── server/
│   ├── __init__.py
│   ├── core.py                   ← SidecarServer: dispatch + I/O
│   ├── handlers.py               ← JSON-RPC 方法处理 (initialize, startTurn, cancel, shutdown)
│   └── turns.py                  ← startTurn → ReAct 循环 → SSE 事件流
├── llm/
│   ├── __init__.py
│   ├── client.py                 ← OpenAI 兼容客户端 (stream + tool_use)
│   └── protocol.py               ← LLMRequest, LLMChunk, ToolCall, TokenUsage
├── tools/
│   ├── __init__.py
│   ├── schema.py                 ← ToolSchema (name, description, parameters JSON Schema)
│   ├── registry.py               ← ToolRegistry (注册 + 执行 + to_openai_tools)
│   └── builtin/
│       ├── __init__.py
│       ├── file_ops.py           ← file_read, file_write, file_list
│       ├── search.py             ← web_search
│       └── office.py             ← word_generate, excel_analyze (placeholder)
├── workspace/
│   ├── __init__.py
│   └── local.py                  ← LocalWorkspace (文件系统操作)
└── pyproject.toml                ← 依赖声明

Electron 端改动:
├── src/main/services/
│   ├── sidecar-service.ts        ← 新增: spawn + stdin/stdout 管理
│   └── ipc-handlers.ts           ← 改动: EXECUTE_TASK local_ 分支对接 sidecar
└── src/components/
    └── ChatPanel.tsx             ← 改动: 支持 SSE 事件流 (content_delta, tool_use_*)
```

**ReAct 最简循环**（`turns.py`）：

```python
async def react_loop(user_message, tools, model, api_key, base_url, max_rounds=10):
    client = OpenAIClient(model=model, api_key=api_key, base_url=base_url)
    messages = [{"role": "user", "content": user_message}]
    
    for round_idx in range(max_rounds):
        response = await client.chat(messages, tools=tools, stream=True)
        
        tool_calls = []
        async for chunk in response:
            if chunk.content_delta:
                yield Event("content_delta", chunk.content_delta)
            if chunk.tool_calls:
                tool_calls = accumulate(chunk.tool_calls)
        
        if not tool_calls:
            yield Event("message_final", {"stop_reason": "end_turn"})
            return
        
        # 执行工具 + 结果注入上下文
        for tc in tool_calls:
            yield Event("tool_use_start", {"name": tc.name, "args": tc.args})
            result = await tool_registry.execute(tc.name, tc.args)
            yield Event("tool_use_end", {"name": tc.name, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
```

**本地工具注册**（`tools/builtin/file_ops.py`）：

所有工具从 BspBuddy 当前 `src/main/services/tools/` 的 TypeScript 工具集对应迁移，保持功能一致：
- `file_read` — 读取本地文件
- `file_write` — 写入本地文件（需 Electron 端审批 gate）
- `file_list` — 列出目录内容
- `web_search` — 网络搜索
- `word_generate` / `excel_analyze` / `ppt_create` / `pdf_parse` — Office 工具（placeholder，依赖 Python bridge）

**LLM 调用**（`llm/client.py`）：

```python
# 使用 OpenAI function calling (tool_use)
# 不需要正则解析 JSON —— LLM 返回原生 tool_calls 数组
response = await client.chat.completions.create(
    model=model,
    messages=messages,
    tools=to_openai_tools(tools),    # ← 标准 OpenAI tools 格式
    tool_choice="auto",              # ← LLM 自主决定是否调工具
    stream=True,
)
```

### Phase 2：工具透传 + 审批 + 分层 prompt（本阶段）

**目标**：Electron 主进程将本地工具列表（含 MCP）透传给 Python Sidecar，Sidecar 支持动态工具注册 + 分层 system prompt 装配。

**新增能力**：

- **工具透传**：`startTurn` params 新增 `tools` 数组（OpenAI function calling 格式），Sidecar 动态注册到 `ToolRegistry`。MCP 工具由 Electron 主进程通过 MCP 客户端发现并序列化传入，Python 端不需要 MCP 客户端。
- **分层 prompt 装配**：`react_loop` 接受 `system_prompt` 参数，替代硬编码文字。Electron 端组装：身份 → 模式 hint → 用户规则 → 记忆上下文。
- **审批 Gate（最小）**：`file_write` 返回 `approval_required` 标记，Electron 端弹出确认对话框后通过 `respond` 继续执行（待 Phase 3 完整对接权限服务）。
- **工作区隔离**：Sidecar 只能访问 `workspaceRoot` 下的文件（已在 Phase 1 实现）。

### Phase 3：记忆注入 + 多轮对话

- [ ] 多轮对话历史（Sidecar 内维护 conversation context，通过 `conversation_history` 参数传入）
- [ ] 记忆上下文注入（`memoryService.getContextForQuery` → JSON-RPC params 传入）

### Phase 4：简单对话快路径

- [ ] 检测"无需工具"的简单问题 → 跳过 ReAct，单次 LLM 调用直接回复
- [ ] 减少不必要 token 消耗

## 数据流

```
改前 (BspBuddy 当前):
  ChatPanel → IPC
    → AIService.plan()           ← 本地直连 LLM
    → 正则 /```json/ 提取        ← JSON 崩溃点
    → Orchestrator.execute()     ← 批量执行工具
    → 返回结果

改后 (Phase 1):
  ChatPanel → IPC
    → sidecarService.startTurn() ← spawn Python 进程
    → stdin JSON-RPC
    → ReAct loop                 ← tool_use 多轮循环
    → stdout JSON-RPC SSE events
    → ChatPanel 逐 token 渲染    ← 流式显示
```

## 改动文件

### 新增
| 文件 | 说明 |
|------|------|
| `python/bspbuddy_runtime/__main__.py` | Sidecar 入口 |
| `python/bspbuddy_runtime/protocol.py` | JSON-RPC 帧协议 |
| `python/bspbuddy_runtime/server/core.py` | SidecarServer |
| `python/bspbuddy_runtime/server/handlers.py` | 方法处理 |
| `python/bspbuddy_runtime/server/turns.py` | ReAct 循环 |
| `python/bspbuddy_runtime/llm/client.py` | OpenAI 客户端 |
| `python/bspbuddy_runtime/llm/protocol.py` | LLM 类型 |
| `python/bspbuddy_runtime/tools/schema.py` | ToolSchema |
| `python/bspbuddy_runtime/tools/registry.py` | ToolRegistry |
| `python/bspbuddy_runtime/tools/builtin/file_ops.py` | 文件工具 |
| `python/bspbuddy_runtime/tools/builtin/search.py` | 搜索工具 |
| `python/bspbuddy_runtime/pyproject.toml` | 依赖 |
| `src/main/services/sidecar-service.ts` | Electron 端 Sidecar 管理 |

### 改动
| 文件 | 改动说明 |
|------|----------|
| `src/main/services/ipc-handlers.ts` | `EXECUTE_TASK` 新增 local_ 分支走 sidecar |
| `src/components/ChatPanel.tsx` | 支持 SSE 事件流（content_delta + tool_use_start/end） |
| `src/hooks/useAgent.ts` | sendMessage 支持流式更新 |

### 移除（Phase 4 后）
| 文件 | 说明 |
|------|------|
| `src/main/services/ai.ts` | AIService 正则 JSON 解析 — 被 Sidecar 替代 |
| `src/main/services/orchestrator.ts` | 本地步骤编排 — 被 ReAct 循环替代 |

## 验收标准

- [ ] `python -m bspbuddy_runtime` 能正常启动，监听 stdin JSON-RPC
- [ ] `initialize → startTurn → content_delta 事件 → message_final` 端到端流式通话
- [ ] 工具调用：用户说"读取 README.md"，Sidecar 返回 tool_use_start(file_read) → tool_use_end(文件内容) → 最终回复
- [ ] 多轮 ReAct：用户说"先读 README，然后根据内容写一个总结文件"，LLM 连续两次 tool_use
- [ ] 取消：用户点击"停止生成"，cancel JSON-RPC → turn 中止
- [ ] Electron 集成：`local_` 模型选择后，ChatPanel 用流式渲染文本回复
- [ ] 云模型回归：非 `local_` 模型仍走 `_planViaBackend()`，行为不变
