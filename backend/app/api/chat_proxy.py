"""Chat proxy API — routes LLM calls through the server so API keys stay encrypted.

Endpoints:
  POST /api/chat/proxy/send   — non-streaming (sync) LLM call
  POST /api/chat/proxy/stream — SSE streaming LLM call

All clients (desktop Electron / web browser / mobile Capacitor) use the same endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session

from app.core.llm_proxy import llm_proxy
from app.db import get_session
from app.security.auth import get_current_user, require_current_tenant

router = APIRouter(
    prefix="/api/chat/proxy",
    tags=["chat-proxy"],
    dependencies=[Depends(get_current_user)],
)


class ChatProxyRequest(BaseModel):
    model_config_id: str | None = None
    agent_id: str | None = None
    messages: list[dict[str, str]]
    temperature: float = 0.3
    max_tokens: int = 4096

    def model_post_init(self, __context: object) -> None:
        if not self.model_config_id and not self.agent_id:
            raise ValueError("either model_config_id or agent_id must be provided")


class ChatProxyResponse(BaseModel):
    content: str
    model: str
    usage: dict


@router.post("/send", response_model=ChatProxyResponse, dependencies=[Depends(require_current_tenant)])
def chat_proxy_send(
    request: ChatProxyRequest,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
) -> ChatProxyResponse:
    try:
        result = llm_proxy.chat_sync(
            db=db,
            tenant_id=tenant_id,
            config_id=request.model_config_id,
            messages=request.messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            agent_id=request.agent_id,
        )
        return ChatProxyResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM_PROXY_ERROR: {exc}") from exc


@router.post("/stream", dependencies=[Depends(require_current_tenant)])
def chat_proxy_stream(
    request: ChatProxyRequest,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
):
    try:
        generator = llm_proxy.chat_stream(
            db=db,
            tenant_id=tenant_id,
            config_id=request.model_config_id,
            messages=request.messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            agent_id=request.agent_id,
        )
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM_PROXY_ERROR: {exc}") from exc
