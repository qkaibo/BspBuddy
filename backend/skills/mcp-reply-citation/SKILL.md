---
name: MCP 回复引用规范
description: >
  MCP citation / reply attribution skill. After any MCP tool call
  (search_aosp, database query, etc.), put path+line evidence in the
  body and append which MCP server and tool were used at the end of
  the final reply. Instruction-only; no scripts.
  Use when the task involves MCP tools or the user asks to query via MCP.
---

# MCP 回复引用规范

这是一份**指令型技能**（无代码、无 `execute`）。读取后，把它当作本 TaskFrame 的强制输出规范。

## 何时生效

本轮 TaskFrame 中**实际调用过**至少一个 MCP 工具（capability 来自 MCP 服务器，例如 `search_aosp`）时生效。

## 必须遵守

1. 在 `finish` 的 `reply_fragment` **正文之后**追加引用块；不得省略。
2. 多个 MCP 工具按**首次成功调用顺序**列出，同名去重。
3. 未调用任何 MCP 时，**禁止**伪造引用块。
4. 不要把引用块写进 `task_summary` 以外的字段；引用只出现在 `reply_fragment` 末尾。
5. **正文证据**：凡依据 MCP 命中得出的路径/默认值/改法，正文中至少给出一条  
   `path` + 行号（或 `Lxxx-Lyyy`）+ 短摘录（fenced 或行内值）；禁止只有通识编码说明、没有任何命中文件。
6. **回答顺序**（配置类问题）：先写证据中的**默认/现状**（是否已有目标档位），再写主配置路径与改法/不生效排查；不要默认写成「从零新增」。
7. **截断**：命中文本在关键赋值处被截断时，换关键词再搜或标明截断依据；禁止编造未出现的完整赋值。
8. **路径降噪**：主栈（如 ADSP battmngr）写清楚后，次要栈（如 Kernel TCPM）最多一句附注。

## 固定格式

```text
（你的正常回答正文，含路径/行号/摘录）

---
本次调用 MCP：{mcp_server_name} / {tool_name}
```

多条时每行一条：

```text
---
本次调用 MCP：H618充电数据库 / search_aosp
本次调用 MCP：H618充电数据库 / get_board_dts
```

## 字段取值

| 字段 | 来源 |
|------|------|
| `mcp_server_name` | 能力 metadata 中的 `mcp_server_name`；若不可得，用可读的 MCP 服务器显示名 |
| `tool_name` | 实际调用的工具名（如 `search_aosp`），不要加 `mcp.` 前缀 |

## 禁止

- 未调用 MCP 却写「本次调用 MCP」
- 只写工具名不写服务器名，或只写服务器名不写工具名
- 用模糊说法代替固定格式（如「通过相关工具查询」而不写引用块）
- 有 MCP 命中却只给教科书编码、不给 path/行号/摘录
