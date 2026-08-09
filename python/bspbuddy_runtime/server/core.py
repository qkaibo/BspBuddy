"""SidecarServer: transport dispatch and outbound I/O.

Routes inbound JSON-RPC lines to handler methods, streams turn events back via
notifications.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from bspbuddy_runtime import protocol
from bspbuddy_runtime.a2a import A2AClient
from bspbuddy_runtime.tools.builtin.file_ops import register_file_tools
from bspbuddy_runtime.tools.builtin.search import register_search_tools
from bspbuddy_runtime.tools.registry import ToolRegistry


class SidecarServer:
    """Routes inbound JSON-RPC lines to handlers and streams events back out."""

    def __init__(self, write_line: Callable[[str], Awaitable[None]]) -> None:
        self._write_line = write_line
        self._initialized = False
        self._user_id = ""
        self._root: Path | None = None
        # LLM inference config
        self._model: str = ""
        self._api_key: str = ""
        self._base_url: str = ""
        # Tool registry (built once; per-turn tool lists are queried by mode)
        self._tool_registry = ToolRegistry()
        # turn_id → running asyncio.Task
        self._turns: dict[str, asyncio.Task[None]] = {}
        self._turn_conversations: dict[str, str] = {}
        self._pending_sends: set[asyncio.Task[None]] = set()
        self.shutdown_requested = asyncio.Event()
        # A2A agent delegation
        self._backend_url: str = ""
        self._auth_token: str = ""
        self._a2a_client: A2AClient | None = None
        self._agent_cards: list[dict[str, Any]] = []

    def _register_turn(
        self, turn_id: str, task: asyncio.Task[None], *, conversation_id: str
    ) -> None:
        self._turns[turn_id] = task
        cid = (conversation_id or "").strip()
        if cid:
            self._turn_conversations[turn_id] = cid

    def _unregister_turn(self, turn_id: str) -> None:
        self._turns.pop(turn_id, None)
        self._turn_conversations.pop(turn_id, None)

    async def handle_line(self, line: str) -> None:
        """Parse and dispatch one inbound line. Never raises."""
        line = line.strip()
        if not line:
            return
        try:
            message = protocol.decode_line(line)
        except protocol.ProtocolError as e:
            await self._send(
                protocol.make_error(None, protocol.PARSE_ERROR, str(e))
            )
            return

        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") or {}
        if not isinstance(method, str):
            if request_id is not None:
                await self._send(
                    protocol.make_error(
                        request_id, protocol.INVALID_REQUEST, "missing method"
                    )
                )
            return

        try:
            await self._dispatch(request_id, method, params)
        except Exception:
            import traceback
            traceback.print_exc()
            if request_id is not None:
                await self._send(
                    protocol.make_error(
                        request_id, protocol.INTERNAL_ERROR, "dispatch failed"
                    )
                )

    async def _dispatch(
        self, request_id: Any, method: str, params: dict[str, Any]
    ) -> None:
        if method == "initialize":
            await self._on_initialize(request_id, params)
        elif method == "startTurn":
            await self._on_start_turn(request_id, params)
        elif method == "cancel":
            await self._on_cancel(request_id, params)
        elif method == "shutdown":
            self.shutdown_requested.set()
            await self._reply(request_id, {"ok": True})
        else:
            await self._send(
                protocol.make_error(
                    request_id,
                    protocol.METHOD_NOT_FOUND,
                    f"unknown method: {method}",
                )
            )

    # ── handlers ──────────────────────────────────────────────────────────

    async def _on_initialize(self, request_id: Any, params: dict[str, Any]) -> None:
        root_raw = str(params.get("workspaceRoot") or "").strip()
        root = Path(root_raw)
        if not root_raw or not root.is_dir():
            await self._send(
                protocol.make_error(
                    request_id,
                    protocol.INVALID_PARAMS,
                    f"workspaceRoot is not an existing directory: {root_raw!r}",
                )
            )
            return

        self._root = root.resolve()
        self._user_id = str(params.get("userId") or "")

        inference = params.get("inference") or {}
        self._model = str(inference.get("model") or "").strip()
        self._api_key = str(inference.get("apiKey") or "").strip()
        self._base_url = str(inference.get("baseUrl") or "").strip()

        self._initialized = True

        # Register built-in tools (scoped to workspace root)
        register_file_tools(self._tool_registry, str(self._root))
        register_search_tools(self._tool_registry)

        # ── A2A agent discovery ──
        self._backend_url = str(params.get("backendUrl") or "").strip()
        self._auth_token = str(params.get("authToken") or "").strip()
        if self._backend_url:
            self._a2a_client = A2AClient(self._backend_url, self._auth_token)
            try:
                self._agent_cards = await self._a2a_client.discover_agents()
            except Exception:
                self._agent_cards = []

        # Register delegate_to_expert tool
        agent_desc = self._describe_agents()
        self._tool_registry.register(
            name="delegate_to_expert",
            description=(
                "将任务委托给专门的 AI 专家执行。"
                "当用户的任务需要专业领域知识（如产品管理、代码审查、需求分析、架构设计）时使用。"
                "不要为简单问题或普通对话使用此工具。"
                f"可用专家: {agent_desc}"
            ),
            parameters={
                "type": "object",
                "properties": {
                    "expert_id": {
                        "type": "string",
                        "description": f"专家 ID。可用专家列表: {agent_desc}",
                    },
                    "task": {
                        "type": "string",
                        "description": "要委托给专家的任务描述，越详细越好",
                    },
                },
                "required": ["expert_id", "task"],
            },
            handler=self._handle_delegate_to_expert,
            is_external=False,
        )

        await self._reply(
            request_id,
            {
                "ok": True,
                "protocolVersion": protocol.PROTOCOL_VERSION,
                "capabilities": {
                    "turns": True,
                    "cancel": True,
                },
            },
        )

    async def _on_start_turn(
        self, request_id: Any, params: dict[str, Any]
    ) -> None:
        if not self._initialized or self._root is None:
            await self._send(
                protocol.make_error(
                    request_id,
                    protocol.NOT_INITIALIZED,
                    "initialize must be called first",
                )
            )
            return

        turn_id = str(params.get("turnId") or "").strip()
        if not turn_id:
            await self._send(
                protocol.make_error(
                    request_id, protocol.INVALID_PARAMS, "turnId is required"
                )
            )
            return
        if turn_id in self._turns:
            await self._send(
                protocol.make_error(
                    request_id,
                    protocol.INVALID_PARAMS,
                    f"turn already running: {turn_id}",
                )
            )
            return

        conversation_id = str(params.get("conversationId") or turn_id)

        # Spawn the turn as an async task; events flow as notifications.
        task = asyncio.create_task(
            self._run_turn(request_id, turn_id, params)
        )
        self._register_turn(turn_id, task, conversation_id=conversation_id)

    async def _on_cancel(self, request_id: Any, params: dict[str, Any]) -> None:
        turn_id = str(params.get("turnId") or "")
        task = self._turns.get(turn_id)
        if task is not None and not task.done():
            task.cancel()
            await self._reply(request_id, {"cancelled": True})
        else:
            await self._reply(request_id, {"cancelled": False})

    # ── turn execution ────────────────────────────────────────────────────

    def _describe_agents(self) -> str:
        """Build a compact string describing available agents for tool descriptions."""
        if not self._agent_cards:
            return "暂无可用专家"
        lines: list[str] = []
        for card in self._agent_cards:
            name = card.get("name", "")
            desc = card.get("description", "")
            agent_id = card.get("url", "").rsplit("/", 1)[-1] if "/" in card.get("url", "") else ""
            lines.append(f"- {agent_id}: {name} — {desc}")
        return "\n".join(lines)

    async def _handle_delegate_to_expert(self, args: dict[str, Any]) -> dict[str, Any]:
        """Execute delegate_to_expert tool: send task to a server-side expert via A2A."""
        expert_id = str(args.get("expert_id") or "")
        task = str(args.get("task") or "")

        if not self._a2a_client:
            return {"error": "A2A client 未初始化，请确认 backendUrl 已配置"}

        # Find agent card by ID
        agent = None
        for card in self._agent_cards:
            card_url = card.get("url", "")
            card_id = card_url.rsplit("/", 1)[-1] if "/" in card_url else ""
            if card_id == expert_id or card.get("name") == expert_id:
                agent = card
                break

        if not agent:
            return {
                "error": f"未找到专家: {expert_id}。可用专家: {self._describe_agents()}"
            }

        results: list[dict[str, Any]] = []
        try:
            async for event in self._a2a_client.send_task_streaming(agent["url"], task):
                results.append(event)
        except Exception as exc:
            return {"error": f"委托专家失败: {exc}"}

        # Extract text content from all events
        texts: list[str] = []
        for event in results:
            content = event.get("content") or event.get("text") or ""
            if content:
                texts.append(str(content))

        return {
            "result": "\n".join(texts) if texts else "专家已完成任务（无文本输出）",
            "events_count": len(results),
        }

    async def _run_turn(
        self, request_id: Any, turn_id: str, params: dict[str, Any]
    ) -> None:
        """Execute one user turn via the ReAct loop, streaming events as notifications."""
        from bspbuddy_runtime.server.turns import build_system_prompt, react_loop

        message = str(params.get("message") or "")
        mode = str(params.get("mode") or "craft")
        turn_id = str(params.get("turnId") or "").strip()
        user_rules = str(params.get("userRules") or "")
        memory_context = str(params.get("memoryContext") or "")
        external_tools = params.get("tools") or []
        expert_id = str(params.get("expertId") or "")
        context_resources = str(params.get("contextResources") or "")

        if not message:
            await self._send(
                protocol.make_error(
                    request_id, protocol.INVALID_PARAMS, "message is required"
                )
            )
            return

        # Register external tools (MCP etc.) from Electron
        for tool_def in external_tools:
            if isinstance(tool_def, dict):
                self._tool_registry.register_external(
                    name=str(tool_def.get("name") or ""),
                    description=str(tool_def.get("description") or ""),
                    parameters=tool_def.get("parameters"),
                )

        # Build layered system prompt
        expert_hint = ""
        if expert_id:
            expert_hint = (
                f"\n\n## 专家委托\n"
                f"用户当前已经召唤了专家（ID: {expert_id}）。"
                f"当用户的任务需要该专家的专业领域能力时，请使用 delegate_to_expert 工具委托任务。"
                f"简单的对话和不需要专业技能的问题仍然由你直接回答。"
            )
        resource_hint = ""
        if context_resources:
            resource_hint = (
                f"\n\n## 对话上下文资源\n"
                f"当前对话中已激活以下资源，请优先参考这些资源来回答问题：\n"
                f"{context_resources}"
            )
        system_prompt = build_system_prompt(
            mode=mode,
            user_rules=user_rules,
            memory_context=memory_context,
            workspace_root=str(self._root) if self._root else "",
        ) + expert_hint + resource_hint

        try:
            async for event in react_loop(
                user_message=message,
                model=self._model,
                api_key=self._api_key,
                base_url=self._base_url,
                tool_registry=self._tool_registry,
                mode=mode,
                system_prompt=system_prompt,
            ):
                self._send_notification(
                    method=event.get("method", "turn/event"),
                    params=event.get("params", event),
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            import traceback
            traceback.print_exc()
            await self._send(
                protocol.make_error(
                    request_id, protocol.INTERNAL_ERROR, str(e)
                )
            )
            return

        await self._reply(request_id, {"turnId": turn_id, "status": "completed"})
        self._unregister_turn(turn_id)

    # ── I/O helpers ───────────────────────────────────────────────────────

    async def _send(self, message: dict[str, Any]) -> None:
        await self._write_line(protocol.encode_line(message))

    def _send_notification(self, method: str, params: dict[str, Any]) -> None:
        """Schedule a fire-and-forget notification send."""
        task = asyncio.create_task(
            self._send(protocol.make_notification(method, params))
        )
        self._pending_sends.add(task)
        task.add_done_callback(self._pending_sends.discard)

    async def _reply(self, request_id: Any, result: Any) -> None:
        if request_id is not None:
            await self._send(protocol.make_result(request_id, result))
