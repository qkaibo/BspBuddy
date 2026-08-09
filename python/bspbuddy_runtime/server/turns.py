"""ReAct loop: the core Agent turn execution engine.

Flow::

    startTurn → ReAct loop:
        1. LLM call (streaming, tool_use enabled)
        2. If content_delta → notify renderer
        3. If tool_calls → execute tools → inject results → loop back to 1
        4. If no tool_calls → message_final → done

Supports layered system prompts (identity + mode hint + rules + memory)
and external tools (MCP etc.) registered via the ToolRegistry.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from bspbuddy_runtime.llm.client import LLMError, OpenAIClient
from bspbuddy_runtime.llm.protocol import LLMChunk, LLMMessage, ToolCall, ToolCallFunction
from bspbuddy_runtime.protocol import make_notification
from bspbuddy_runtime.tools.registry import ToolRegistry

# ── event types (mirrors AgentCore SSE events) ──────────────────────────

def _turn_event(event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    return make_notification("turn/event", {"type": event_type, **data})


def content_delta(text: str) -> dict[str, Any]:
    return _turn_event("content_delta", {"text": text})


def tool_use_start(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return _turn_event("tool_use_start", {"tool_name": name, "arguments": arguments})


def tool_use_end(name: str, result: str) -> dict[str, Any]:
    return _turn_event("tool_use_end", {"tool_name": name, "result": result})


def message_final(stop_reason: str, content: str = "") -> dict[str, Any]:
    return _turn_event("message_final", {"stop_reason": stop_reason, "content": content})


def turn_error(message: str) -> dict[str, Any]:
    return _turn_event("error", {"message": message})


# ── tool call accumulator for streaming chunks ───────────────────────────

def _accumulate_tool_calls(
    existing: dict[int, ToolCall], deltas: list[Any]
) -> dict[int, ToolCall]:
    """Merge streaming tool_call deltas into accumulated ToolCall dict."""
    for delta in deltas:
        index = delta.index
        if index not in existing:
            existing[index] = ToolCall(
                id=delta.id or "",
                function=ToolCallFunction(name="", arguments=""),
            )
        tc = existing[index]
        if delta.id:
            tc.id = delta.id
        if delta.function_name:
            tc.function.name = delta.function_name
        if delta.arguments_delta:
            tc.function.arguments += delta.arguments_delta
    return existing


def _parse_tool_args(arguments: str) -> dict[str, Any]:
    """Parse tool arguments JSON string, with fallback."""
    try:
        return json.loads(arguments)
    except json.JSONDecodeError:
        return {"raw": arguments}


# ── default system prompt (fallback) ─────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are BspBuddy, a professional AI desktop workbench assistant.
You have access to tools that can read/write files, search the web, and perform tasks.

## Guidelines
- Use tools when they help the user's task (reading files, writing output, searching).
- When calling tools, use the exact tool name and correct argument names.
- After a tool returns its result, decide whether you need another tool or can reply.
- When replying to the user, be concise and helpful. Do NOT output tool thinking — just the final answer.
- Do not output JSON or code fences in your final reply to the user.
"""

# ── simple question detection for fast path ──────────────────────────────

_SIMPLE_MARKERS = [
    "你好", "谢谢", "再见", "是的", "对的", "好的", "ok", "hi", "hello",
    "thanks", "bye", "什么是", "是什么", "怎么用", "介绍一下",
]
_SIMPLE_MAX_LENGTH = 50  # chars — short greets go fast path


def _is_simple_question(message: str) -> bool:
    """Heuristic: short messages with common patterns skip ReAct tool-calling round."""
    stripped = message.strip().lower()
    if len(message.strip()) > _SIMPLE_MAX_LENGTH:
        return False
    for marker in _SIMPLE_MARKERS:
        if marker in stripped:
            return True
    return False


# ── layered prompt builder ────────────────────────────────────────────────

def build_system_prompt(
    mode: str = "craft",
    user_rules: str = "",
    memory_context: str = "",
    workspace_root: str = "",
) -> str:
    """Assemble a layered system prompt from identity + mode hint + rules + memory."""
    mode_hints = {
        "ask": "（Ask 模式：只回答问题和建议，不执行工具操作）",
        "plan": "（Plan 模式：先生成详细计划，标注 waiting_confirmation，等用户确认后再执行）",
        "craft": "（Craft 模式：直接执行任务）",
        "design": "（Design 模式：专注设计任务，可使用 Ardot 画布工具）",
    }
    mode_hint = mode_hints.get(mode, mode_hints["craft"])

    parts = [
        "你是 BspBuddy，一个专业的 AI 桌面工作台助手。",
        f"## 当前模式\n{mode_hint}",
        "## 工具使用原则\n- 使用工具时使用准确的工具名称和参数名\n- 工具执行后，根据结果判断是否需要更多工具或可以直接回复\n- 回复用户时简洁有帮助，不要输出工具思考过程",
    ]

    if workspace_root:
        parts.append(f"## 工作区\n当前工作目录: {workspace_root}")

    if user_rules:
        parts.append(f"## 用户规则（必须遵守）\n{user_rules}")

    if memory_context:
        parts.append(f"## 用户记忆（参考背景）\n{memory_context}")

    parts.append("## 输出要求\n不要输出 JSON 或代码围栏到最终回复。")

    return "\n\n".join(parts)


# ── ReAct loop ───────────────────────────────────────────────────────────

async def react_loop(
    user_message: str,
    *,
    model: str,
    api_key: str,
    base_url: str,
    tool_registry: ToolRegistry,
    mode: str = "craft",
    system_prompt: str = "",
    conversation_history: list[LLMMessage] | None = None,
    max_rounds: int = 10,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    timeout: float = 120.0,
) -> AsyncIterator[dict[str, Any]]:
    """Run a ReAct loop for one user turn.

    Yields ``turn/event`` notification dicts for every content_delta,
    tool_use_start, tool_use_end, and the final message_final.
    """
    client = OpenAIClient(
        model=model,
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
    )

    prompt = system_prompt or DEFAULT_SYSTEM_PROMPT

    # ── Fast path: simple question → single LLM call, no tools ──
    if _is_simple_question(user_message) and not conversation_history:
        messages: list[LLMMessage] = [LLMMessage(role="user", content=user_message)]
        accumulated = ""
        try:
            async for chunk in client.chat(
                messages,
                tools=None,
                system=prompt,
                temperature=temperature,
                max_tokens=min(max_tokens, 1024),
                stream=True,
            ):
                if chunk.content_delta:
                    accumulated += chunk.content_delta
                    yield content_delta(chunk.content_delta)
            yield message_final("end_turn", accumulated)
            return
        except LLMError as e:
            yield turn_error(f"LLM error: {e}")
            return

    # ── Full ReAct loop ──
    tools = tool_registry.list_for_mode(mode)

    messages: list[LLMMessage] = list(conversation_history or [])
    messages.append(LLMMessage(role="user", content=user_message))

    accumulated_content = ""

    for round_idx in range(max_rounds):
        try:
            tool_calls_acc: dict[int, ToolCall] = {}
            current_content = ""

            async for chunk in client.chat(
                messages,
                tools=tools,
                system=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            ):
                if chunk.content_delta:
                    current_content += chunk.content_delta
                    accumulated_content += chunk.content_delta
                    yield content_delta(chunk.content_delta)

                if chunk.tool_call_deltas:
                    tool_calls_acc = _accumulate_tool_calls(
                        tool_calls_acc, chunk.tool_call_deltas
                    )

            if not tool_calls_acc:
                yield message_final("end_turn", accumulated_content)
                return

            assistant_tool_calls = list(tool_calls_acc.values())
            messages.append(
                LLMMessage(
                    role="assistant",
                    content=current_content or None,
                    tool_calls=assistant_tool_calls,
                )
            )

            for tc in assistant_tool_calls:
                args = _parse_tool_args(tc.function.arguments)
                yield tool_use_start(tc.function.name, args)

                result = await tool_registry.execute(tc.function.name, args)
                yield tool_use_end(tc.function.name, result)

                messages.append(
                    LLMMessage(
                        role="tool",
                        content=result,
                        tool_call_id=tc.id,
                    )
                )

        except asyncio.CancelledError:
            yield message_final("cancelled", accumulated_content)
            return
        except LLMError as e:
            yield turn_error(f"LLM error: {e}")
            return
        except Exception as e:
            yield turn_error(f"Internal error: {e}")
            return

    yield message_final("max_rounds", accumulated_content)
