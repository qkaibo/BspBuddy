"""BspBuddy 本地 Agent 运行时 — Python Sidecar 进程。

通过 stdin/stdout JSON-RPC 与 Electron 桌面端通信，
内部使用 ReAct 循环 + OpenAI function calling 执行工具调用。
"""

__version__ = "0.1.0"
