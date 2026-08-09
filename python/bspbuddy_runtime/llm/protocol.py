"""LLM request/response protocol types.

Kept thin — only the types needed for the OpenAI-compatible client and ReAct loop.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class ToolCallFunction:
    name: str
    arguments: str  # JSON string — parsed at execution time


@dataclass
class ToolCall:
    id: str
    type: Literal["function"] = "function"
    function: ToolCallFunction = field(
        default_factory=lambda: ToolCallFunction("", "{}")
    )


@dataclass
class ToolCallDelta:
    """Accumulated during streaming: one tool call assembled across chunks."""
    index: int
    id: str | None = None
    function_name: str | None = None
    arguments_delta: str | None = None


@dataclass
class LLMMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None


@dataclass
class LLMChunk:
    """One chunk from an OpenAI-compatible streaming response."""
    content_delta: str | None = None
    tool_call_deltas: list[ToolCallDelta] | None = None
    finish_reason: str | None = None
    usage: dict[str, int] | None = None
