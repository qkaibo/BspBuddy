"""OpenAI-compatible LLM client with streaming and tool-use support.

Usage::

    client = OpenAIClient(model="gpt-4o", api_key="sk-...", base_url="")
    async for chunk in client.chat(messages, tools=tools, stream=True):
        if chunk.content_delta:
            print(chunk.content_delta, end="")
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from bspbuddy_runtime.llm.protocol import (
    LLMChunk,
    LLMMessage,
    ToolCall,
    ToolCallDelta,
    ToolCallFunction,
)


def _tools_to_openai(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert BspBuddy tool schemas to OpenAI ``tools`` format."""
    result = []
    for t in tools:
        result.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("parameters", {"type": "object", "properties": {}}),
            },
        })
    return result


def _messages_to_openai(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for msg in messages:
        d: dict[str, Any] = {"role": msg.role}
        if msg.content is not None:
            d["content"] = msg.content
        if msg.tool_calls:
            d["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        if msg.tool_call_id:
            d["tool_call_id"] = msg.tool_call_id
        result.append(d)
    return result


class LLMError(Exception):
    """LLM call failed."""


class OpenAIClient:
    """OpenAI-compatible chat completions client."""

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str = "",
        timeout: float = 120.0,
    ):
        self._model = model
        self._api_key = api_key
        self._base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self._timeout = timeout

    async def chat(
        self,
        messages: list[LLMMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        stream: bool = True,
    ) -> AsyncIterator[LLMChunk]:
        """Stream a chat completion, yielding chunks."""
        url = f"{self._base_url}/chat/completions"

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": _messages_to_openai(messages),
            "stream": stream,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = _tools_to_openai(tools)
            payload["tool_choice"] = "auto"
        if system:
            payload["messages"].insert(0, {"role": "system", "content": system})

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            if stream:
                async with client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code != 200:
                        text = await response.aread()
                        raise LLMError(
                            f"HTTP {response.status_code}: {text.decode()[:500]}"
                        )
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            return
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        yield self._parse_chunk(data)
            else:
                response = await client.post(
                    url, json=payload, headers=headers
                )
                if response.status_code != 200:
                    raise LLMError(
                        f"HTTP {response.status_code}: {response.text[:500]}"
                    )
                yield self._parse_completion(response.json())

    def _parse_chunk(self, data: dict[str, Any]) -> LLMChunk:
        """Parse one SSE chunk from OpenAI stream."""
        choice = (data.get("choices") or [{}])[0]
        delta = choice.get("delta") or {}
        finish = choice.get("finish_reason")

        content = delta.get("content")
        tool_deltas: list[ToolCallDelta] = []

        raw_tool_calls = delta.get("tool_calls") or []
        for tc in raw_tool_calls:
            fn = tc.get("function") or {}
            tool_deltas.append(
                ToolCallDelta(
                    index=tc.get("index", 0),
                    id=tc.get("id"),
                    function_name=fn.get("name"),
                    arguments_delta=fn.get("arguments"),
                )
            )

        usage = data.get("usage")

        return LLMChunk(
            content_delta=content,
            tool_call_deltas=tool_deltas if tool_deltas else None,
            finish_reason=finish,
            usage=usage,
        )

    def _parse_completion(self, data: dict[str, Any]) -> LLMChunk:
        """Parse a non-streaming response."""
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        return LLMChunk(
            content_delta=message.get("content"),
            finish_reason=choice.get("finish_reason"),
            usage=data.get("usage"),
        )
