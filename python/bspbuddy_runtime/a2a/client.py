"""A2A client for discovering agents and delegating tasks from the Sidecar runtime."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

import httpx


class A2AClient:
    """Minimal A2A client for agent discovery and task delegation.

    Used by the Python Sidecar to discover expert Agent Cards from the
    BspBuddy backend and delegate tasks to them via SSE streaming.
    """

    def __init__(self, backend_url: str, auth_token: str = "") -> None:
        self.backend_url = backend_url.rstrip("/")
        self.auth_token = auth_token

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {}
        if self.auth_token:
            h["Authorization"] = f"Bearer {self.auth_token}"
        return h

    async def discover_agents(self) -> list[dict[str, Any]]:
        """GET /a2a/agents → return list of Agent Cards."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{self.backend_url}/a2a/agents",
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("agents", [])

    async def send_task_streaming(
        self, agent_url: str, task: str
    ) -> AsyncGenerator[dict[str, Any], None]:
        """POST {agent_url}/tasks → SSE stream.

        Yields parsed SSE event dicts as they arrive.
        """
        body = {
            "message": {
                "role": "user",
                "parts": [{"text": task}],
            },
            "metadata": {},
        }

        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{agent_url}/tasks",
                json=body,
                headers={**self._headers(), "Accept": "text/event-stream"},
            ) as resp:
                resp.raise_for_status()
                buffer = ""
                async for chunk in resp.aiter_text():
                    if not chunk:
                        continue
                    buffer += chunk
                    while "\n\n" in buffer:
                        line, buffer = buffer.split("\n\n", 1)
                        # Parse SSE: "event: <type>\ndata: <json>"
                        event_type = ""
                        data_str = ""
                        for sub in line.split("\n"):
                            sub = sub.strip()
                            if sub.startswith("event:"):
                                event_type = sub[6:].strip()
                            elif sub.startswith("data:"):
                                data_str = sub[5:].strip()
                        if data_str:
                            try:
                                parsed = json.loads(data_str)
                            except json.JSONDecodeError:
                                parsed = {"raw": data_str}
                            if event_type:
                                parsed["_event_type"] = event_type
                            yield parsed
