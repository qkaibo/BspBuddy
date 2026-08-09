"""BspBuddy single-port API entry point.

Spawned by the Electron main process via uvicorn.
Does NOT serve a SPA frontend -- the Electron renderer handles all UI.
"""
import logging
import os

import httpx
from fastapi.responses import StreamingResponse
from starlette.requests import Request

from app.main import app

logger = logging.getLogger("bspbuddy.static")

SITE_CHAT_UPSTREAM = os.getenv(
    "STAFFDECK_SITE_CHAT_UPSTREAM",
    "http://127.0.0.1:10187",
).rstrip("/")
HOP_BY_HOP_HEADERS = {
    "connection",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


@app.api_route(
    "/api/site-chat/{site_path:path}",
    methods=["GET", "POST", "OPTIONS"],
    include_in_schema=False,
)
async def site_chat_proxy(site_path: str, request: Request) -> StreamingResponse:
    target_url = f"{SITE_CHAT_UPSTREAM}/api/site-chat/{site_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    request_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS and key.lower() != "host"
    }
    request_headers["x-forwarded-host"] = request.headers.get("host", "")
    request_headers["x-forwarded-proto"] = request.url.scheme
    if request.client:
        request_headers["x-forwarded-for"] = request.client.host

    client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=10.0))
    upstream_request = client.build_request(
        request.method,
        target_url,
        headers=request_headers,
        content=await request.body(),
    )
    try:
        upstream_response = await client.send(upstream_request, stream=True)
    except Exception:
        await client.aclose()
        raise

    response_headers = {
        key: value
        for key, value in upstream_response.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    response_headers["x-accel-buffering"] = "no"

    async def stream_body():
        try:
            async for chunk in upstream_response.aiter_raw():
                yield chunk
        finally:
            await upstream_response.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_body(),
        status_code=upstream_response.status_code,
        headers=response_headers,
    )
