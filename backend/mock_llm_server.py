"""OpenAI-compatible mock LLM server for local development.

Serves {base_url}/chat/completions (non-streaming + SSE streaming).
Used when the demo model endpoint (default http://localhost:52010/v1) has no
real model server behind it, so expert agents can complete a full turn loop.

Run:  python backend/mock_llm_server.py
"""

from __future__ import annotations

import json
import sys
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="BspBuddy Mock LLM", docs_url=None, redoc_url=None)


def _last_user_content(body: dict) -> str:
    for message in reversed(body.get("messages", [])):
        if message.get("role") == "user":
            content = message.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = [
                    item.get("text", "") for item in content if isinstance(item, dict)
                ]
                return "".join(parts)
    return ""


def _build_reply(body: dict) -> str:
    prompt = _last_user_content(body).strip()
    if not prompt:
        prompt = "（空消息）"
    preview = prompt[:120]
    model = body.get("model", "mock")
    reply = (
        f"[Mock·{model}] 收到你的消息：{preview}\n\n"
        "（这是本地 Mock 模型回复，仅用于打通专家对话链路。"
        "如需真实回答，请在「设置 → 专家模型」中配置真实模型。）"
    )
    return reply


def _usage() -> dict:
    return {"prompt_tokens": 12, "completion_tokens": 24, "total_tokens": 36}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    if body.get("stream"):
        async def event_stream():
            reply = _build_reply(body)
            chunk_payload = {
                "id": "mock-chatcmpl",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": body.get("model", "mock"),
                "choices": [
                    {
                        "index": 0,
                        "delta": {"role": "assistant", "content": reply},
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(chunk_payload, ensure_ascii=False)}\n\n"
            final = {
                "id": "mock-chatcmpl",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": body.get("model", "mock"),
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(final, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    reply = _build_reply(body)
    payload = {
        "id": "mock-chatcmpl",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "mock"),
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": reply},
                "finish_reason": "stop",
            }
        ],
        "usage": _usage(),
    }
    return JSONResponse(payload)


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "qwen3.6-27b", "object": "model", "owned_by": "mock"},
            {"id": "gpt-4o", "object": "model", "owned_by": "mock"},
        ],
    }


if __name__ == "__main__":
    import uvicorn

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 52010
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
