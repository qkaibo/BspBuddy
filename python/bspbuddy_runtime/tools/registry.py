"""ToolRegistry: register tools and convert to OpenAI format."""

from __future__ import annotations

from typing import Any

from bspbuddy_runtime.tools.schema import ToolFn, ToolSchema


class ToolRegistry:
    """In-memory tool registry. Register local Python functions, query by mode."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolSchema] = {}
        self._mode_allowlist: dict[str, set[str]] = {}  # tool name → allowed modes
        # External tools registered from Electron (MCP etc.) — no local fn, need remote execution
        self._external_handlers: dict[str, callable] = {}

    def register(
        self,
        name: str,
        description: str,
        fn: ToolFn,
        parameters: dict[str, Any] | None = None,
        modes: list[str] | None = None,
    ) -> None:
        """Register a tool with optional mode filtering.

        ``modes=None`` means available in all modes.
        ``modes=[]`` means disabled.
        """
        params = parameters or {"type": "object", "properties": {}, "required": []}
        tool = ToolSchema(name=name, description=description, parameters=params, fn=fn)
        self._tools[name] = tool
        if modes is not None:
            self._mode_allowlist[name] = set(modes)

    def register_external(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any] | None = None,
        modes: list[str] | None = None,
        handler: callable | None = None,
    ) -> None:
        """Register a tool whose execution is handled externally (e.g. MCP from Electron).

        If ``handler`` is provided, it's called directly. Otherwise, ``execute()``
        will mark the tool as needing external execution — the caller (Electron side)
        should intercept ``tool_use_start`` events and resolve them.
        """
        params = parameters or {"type": "object", "properties": {}, "required": []}
        tool = ToolSchema(name=name, description=description, parameters=params, fn=None)
        self._tools[name] = tool
        if modes is not None:
            self._mode_allowlist[name] = set(modes)
        if handler:
            self._external_handlers[name] = handler

    def get(self, name: str) -> ToolSchema | None:
        return self._tools.get(name)

    def list_for_mode(self, mode: str | None = None) -> list[dict[str, Any]]:
        """Return all tools visible to ``mode``, in OpenAI format."""
        result: list[dict[str, Any]] = []
        for name, tool in self._tools.items():
            allowed = self._mode_allowlist.get(name)
            if allowed is not None and mode not in allowed:
                continue
            result.append(tool.to_openai())
        return result

    async def execute(self, name: str, arguments: dict[str, Any]) -> str:
        """Execute a tool by name with kwargs.

        Checks local function first, then external handlers.
        If the tool has no local fn and no external handler, it's marked
        as needing external resolution (caller should handle it).
        """
        tool = self._tools.get(name)
        if not tool:
            return f"Unknown tool: {name}"

        # External handler takes priority
        ext_handler = self._external_handlers.get(name)
        if ext_handler:
            try:
                result = ext_handler(**arguments)
                if hasattr(result, "__await__"):
                    result = await result
                return str(result)
            except Exception as e:
                return f"Tool '{name}' failed: {e}"

        # Local function
        if tool.fn:
            return await tool.execute(**arguments)

        # Marked as external — caller must resolve
        return f"[EXTERNAL:{name}]: This tool requires external execution. "
        "Caller should intercept tool_use_start events for this tool."

    @property
    def external_tool_names(self) -> set[str]:
        """Names of tools that have no local fn (need external execution)."""
        return {
            name for name, tool in self._tools.items()
            if tool.fn is None and name not in self._external_handlers
        }
