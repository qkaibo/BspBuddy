"""A2A REST endpoints — expose BspBuddy experts as A2A agents.

- GET  /a2a/agents               → list all online agent cards
- GET  /a2a/agents/{agent_id}     → single agent card
- POST /a2a/agents/{agent_id}/tasks → delegate task, SSE streaming response
"""

from __future__ import annotations

import asyncio
import json
import queue
import threading
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.a2a.agent_card import build_agent_card, build_agent_cards
from app.a2a.schema import (
    A2AAgentCard,
    A2AAgentListResponse,
    A2ATaskRequest,
)
from app.api.auth import get_current_user
from app.api.chat import (
    _ensure_chat_session_available,
    _bind_request_to_session_agent,
    _ensure_chat_agent_available,
)
from app.core import AgentLoop
from app.db.database import engine, get_session
from app.db.models import AgentProfile, ChatSession, User
from app.session.session_schema import ChatTurnRequest

router = APIRouter(prefix="/a2a", tags=["a2a"])


def _get_active_agents(db: Session, tenant_id: str) -> list[AgentProfile]:
    return list(
        db.exec(
            select(AgentProfile).where(
                AgentProfile.tenant_id == tenant_id,
                AgentProfile.status == "active",
            )
        ).all()
    )


def _extract_text(request: A2ATaskRequest) -> str:
    parts = request.message.parts if request.message else []
    texts: list[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if text:
            texts.append(str(text))
        elif isinstance(part, dict) and part.get("text"):
            texts.append(str(part["text"]))
    return "\n".join(texts).strip()


def _format_sse(event_type: str, data: dict | str) -> str:
    """Format a dict or string as an SSE event."""
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n"


@router.get("/agents", response_model=A2AAgentListResponse)
def list_a2a_agents(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_session)],
) -> A2AAgentListResponse:
    agents = _get_active_agents(db, current_user.tenant_id)
    return A2AAgentListResponse(agents=build_agent_cards(db, agents))


@router.get("/agents/{agent_id}", response_model=A2AAgentCard)
def get_a2a_agent(
    agent_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_session)],
) -> A2AAgentCard:
    agent = db.get(AgentProfile, agent_id)
    if not agent or agent.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.status != "active":
        raise HTTPException(status_code=404, detail="Agent is not active")
    return build_agent_card(db, agent)


@router.post("/agents/{agent_id}/tasks")
async def create_a2a_task(
    agent_id: str,
    request: A2ATaskRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_session)],
) -> StreamingResponse:
    """Delegate a task to an expert agent via A2A protocol. Returns SSE stream."""
    # Validate agent exists and is active
    agent = db.get(AgentProfile, agent_id)
    if not agent or agent.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.status != "active":
        raise HTTPException(status_code=404, detail="Agent is not active")

    # Extract text from A2A message parts
    user_message = _extract_text(request)

    # Build ChatTurnRequest (reuse existing auth/session logic)
    session_id = request.metadata.session_id if request.metadata else None

    turn_request = ChatTurnRequest(
        tenant_id=current_user.tenant_id,
        session_id=session_id,
        agent_id=agent_id,
        user_id=current_user.id,
        message=user_message,
        channel="a2a",
    )

    # Apply session availability checks (same as chat_turn endpoint)
    if session_id:
        chat_session: ChatSession = _ensure_chat_session_available(
            db, turn_request.tenant_id, current_user.id, session_id
        )
        turn_request = _bind_request_to_session_agent(db, turn_request, chat_session, current_user)
    else:
        _ensure_chat_agent_available(db, turn_request.tenant_id, agent_id, current_user)

    if not turn_request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    agent_name = agent.name

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _format_sse(
            "status",
            {"state": "working", "message": f"正在委托 {agent_name} 专家处理..."},
        )

        # Producer owns its own DB session and pushes events onto a thread-safe
        # queue so this async generator never blocks the FastAPI event loop on
        # handle_turn / LLM work.
        event_q: queue.Queue[dict | None] = queue.Queue()

        def produce() -> None:
            try:
                with Session(engine) as worker_db:
                    for event in AgentLoop(worker_db).handle_turn_stream(turn_request):
                        event_q.put(event)
            except Exception as exc:  # noqa: BLE001 — surface on SSE
                event_q.put(
                    {
                        "event": "error",
                        "type": "error",
                        "data": {"kind": "error", "message": str(exc)},
                    }
                )
            finally:
                event_q.put(None)

        threading.Thread(
            target=produce,
            name=f"a2a-stream-{agent_id[:12]}",
            daemon=True,
        ).start()

        loop = asyncio.get_running_loop()
        while True:
            event = await loop.run_in_executor(None, event_q.get)
            if event is None:
                break
            event_type = (
                event.get("event")
                or event.get("type")
                or "unknown"
            )
            yield _format_sse(str(event_type), event)
            # Let other requests breathe between SSE frames.
            await asyncio.sleep(0)

        yield _format_sse("final", {"state": "completed", "stopReason": "completed"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
