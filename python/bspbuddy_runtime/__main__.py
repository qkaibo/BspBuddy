"""Sidecar entrypoint: ``python -m bspbuddy_runtime``.

Runs the stdio JSON-RPC loop that the Electron desktop drives.

Invariants:
1. stdout is the JSON-RPC channel — logging goes to stderr.
2. UTF-8 both ways.
"""

from __future__ import annotations

import asyncio
import contextlib
import sys
from typing import TextIO


def _claim_stdout() -> TextIO:
    """Take ownership of the real stdout for framing; send everything else to stderr."""
    real_stdout = sys.stdout
    with contextlib.suppress(Exception):
        real_stdout.reconfigure(encoding="utf-8")
    with contextlib.suppress(Exception):
        sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout = sys.stderr
    return real_stdout


async def _serve(real_stdout: TextIO) -> None:
    from bspbuddy_runtime.server import SidecarServer

    write_lock = asyncio.Lock()

    async def write_line(line: str) -> None:
        async with write_lock:
            def _write_and_flush() -> None:
                real_stdout.write(line)
                real_stdout.flush()
            await asyncio.to_thread(_write_and_flush)

    server = SidecarServer(write_line)

    while not server.shutdown_requested.is_set():
        line = await asyncio.to_thread(sys.stdin.readline)
        if line == "":
            break
        await server.handle_line(line)


def main() -> None:
    real_stdout = _claim_stdout()
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(_serve(real_stdout))


if __name__ == "__main__":
    main()
