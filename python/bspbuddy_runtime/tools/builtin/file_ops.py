"""File system tools: read / write / list.

Registered in the ToolRegistry, these are the local counterparts of
BspBuddy's TypeScript file tools in ``src/main/services/tools/file.ts``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from bspbuddy_runtime.tools.registry import ToolRegistry


def _safe_read(path: str, workspace_root: str) -> str:
    """Read a file, resolving against workspace_root and checking containment."""
    abs_path = (Path(workspace_root) / path).resolve()
    if not str(abs_path).startswith(str(Path(workspace_root).resolve())):
        raise ValueError(f"Path escapes workspace: {path}")
    if not abs_path.exists():
        return f"File not found: {path}"
    if not abs_path.is_file():
        return f"Not a file: {path}"
    return abs_path.read_text(encoding="utf-8", errors="replace")


def _safe_write(path: str, content: str, workspace_root: str) -> str:
    """Write a file, resolving against workspace_root and checking containment."""
    abs_path = (Path(workspace_root) / path).resolve()
    if not str(abs_path).startswith(str(Path(workspace_root).resolve())):
        raise ValueError(f"Path escapes workspace: {path}")
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(content, encoding="utf-8")
    return f"File written: {path} ({len(content)} chars)"


def _safe_list(path: str, workspace_root: str) -> str:
    """List directory contents."""
    abs_path = (Path(workspace_root) / path).resolve()
    if not str(abs_path).startswith(str(Path(workspace_root).resolve())):
        raise ValueError(f"Path escapes workspace: {path}")
    if not abs_path.exists():
        return f"Directory not found: {path}"
    if not abs_path.is_dir():
        # fallback: list the parent directory
        abs_path = abs_path.parent
    entries = []
    for entry in sorted(abs_path.iterdir()):
        kind = "dir" if entry.is_dir() else "file"
        entries.append(f"  [{kind}] {entry.name}")
    return f"Contents of {abs_path.name}:\n" + "\n".join(entries) if entries else f"{abs_path.name} is empty"


def register_file_tools(
    registry: ToolRegistry,
    workspace_root: str,
    modes: list[str] | None = None,
) -> None:
    """Register file_read, file_write, file_list in the tool registry."""

    registry.register(
        name="file_read",
        description="Read the contents of a file at the given path. Returns the file's text content.",
        fn=lambda path: _safe_read(path, workspace_root),
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to read, relative to the workspace root.",
                }
            },
            "required": ["path"],
        },
        modes=modes,
    )

    registry.register(
        name="file_write",
        description="Write text content to a file at the given path. Creates parent directories if needed.",
        fn=lambda path, content: _safe_write(path, content, workspace_root),
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to write to, relative to workspace root.",
                },
                "content": {
                    "type": "string",
                    "description": "Text content to write.",
                },
            },
            "required": ["path", "content"],
        },
        modes=modes,
    )

    registry.register(
        name="file_list",
        description="List files and directories at the given path.",
        fn=lambda path=".": _safe_list(path, workspace_root),
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path to list, relative to workspace root. Defaults to '.'.",
                }
            },
        },
        modes=modes,
    )
