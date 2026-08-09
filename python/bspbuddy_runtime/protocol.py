"""JSON-RPC 2.0 framing for the sidecar's stdio transport.

Line-delimited JSON: exactly one JSON value per line, ``\n``-terminated.

Shapes:
- request:      {"jsonrpc":"2.0","id":<id>,"method":<str>,"params":<obj>}
- response ok:  {"jsonrpc":"2.0","id":<id>,"result":<obj>}
- response err: {"jsonrpc":"2.0","id":<id>,"error":{"code":<int>,"message":<str>}}
- notification: {"jsonrpc":"2.0","method":<str>,"params":<obj>}
"""

from __future__ import annotations

import json
from typing import Any

PROTOCOL_VERSION = "0.1"
JSONRPC_VERSION = "2.0"

# JSON-RPC reserved error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# Server-defined codes (-32000..-32099)
TURN_CANCELLED = -32001
NOT_INITIALIZED = -32002


class ProtocolError(ValueError):
    """A line could not be parsed as a JSON-RPC message."""


def encode_line(message: dict[str, Any]) -> str:
    return json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n"


def decode_line(line: str) -> dict[str, Any]:
    try:
        value = json.loads(line.lstrip("\ufeff"))
    except json.JSONDecodeError as e:
        raise ProtocolError(f"invalid JSON: {e}") from e
    if not isinstance(value, dict):
        raise ProtocolError("message must be a JSON object")
    return value


def make_result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": JSONRPC_VERSION, "id": request_id, "result": result}


def make_error(
    request_id: Any, code: int, message: str, *, data: Any = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": JSONRPC_VERSION, "id": request_id, "error": error}


def make_notification(method: str, params: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": JSONRPC_VERSION, "method": method, "params": params}
