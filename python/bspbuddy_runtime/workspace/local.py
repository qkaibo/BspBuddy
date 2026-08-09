"""Local workspace: file-system operations sandboxed to a root directory.

All tools use this module as their file-access backend, ensuring tool code
never escapes the configured workspace root.
"""

from __future__ import annotations

from pathlib import Path


class LocalWorkspace:
    """A sandboxed view of the local file system, rooted at ``root``."""

    def __init__(self, root: str | Path):
        self._root = Path(root).resolve()
        if not self._root.is_dir():
            raise NotADirectoryError(f"Workspace root is not a directory: {self._root}")

    @property
    def root(self) -> Path:
        return self._root

    def resolve(self, path: str) -> Path:
        """Resolve a relative path against the workspace root, enforcing containment."""
        candidate = (self._root / path).resolve()
        if not str(candidate).startswith(str(self._root)):
            raise ValueError(f"Path escapes workspace: {path}")
        return candidate

    def read(self, path: str) -> str:
        abs_path = self.resolve(path)
        if not abs_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        if not abs_path.is_file():
            raise IsADirectoryError(f"Not a file: {path}")
        return abs_path.read_text(encoding="utf-8", errors="replace")

    def write(self, path: str, content: str) -> None:
        abs_path = self.resolve(path)
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")

    def list(self, path: str = ".") -> list[str]:
        abs_path = self.resolve(path)
        if not abs_path.exists():
            raise FileNotFoundError(f"Not found: {path}")
        if not abs_path.is_dir():
            abs_path = abs_path.parent
        return sorted(str(p.relative_to(self._root)) for p in abs_path.iterdir())
