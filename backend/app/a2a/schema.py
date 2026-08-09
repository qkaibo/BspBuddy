"""A2A protocol request/response schemas for BspBuddy."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Agent Card ────────────────────────────────────────────────────────────

class A2ASkill(BaseModel):
    id: str
    name: str
    description: str
    type: str = "sop"  # "sop" | "general_skill"


class A2AAgentCard(BaseModel):
    """A2A Agent Card — each online BspBuddy expert maps to one card."""
    name: str
    description: str
    url: str
    provider: dict[str, str] = Field(default_factory=lambda: {"organization": "BspBuddy"})
    capabilities: dict[str, bool] = Field(
        default_factory=lambda: {"streaming": True, "pushNotifications": False}
    )
    skills: list[A2ASkill] = Field(default_factory=list)
    defaultInputModes: list[str] = Field(default_factory=lambda: ["text", "file"])
    defaultOutputModes: list[str] = Field(default_factory=lambda: ["text", "file"])
    version: str = "1.0.0"


# ── Task (delegation request) ─────────────────────────────────────────────

class A2AMessagePart(BaseModel):
    text: str | None = None
    file: dict[str, Any] | None = None


class A2AMessage(BaseModel):
    role: str = "user"
    parts: list[A2AMessagePart] = Field(default_factory=list)


class A2ATaskMetadata(BaseModel):
    session_id: str | None = None


class A2ATaskRequest(BaseModel):
    """A2A task/send request — the local Sidecar delegates a task to an expert.

    Maps to the backend's ChatTurnRequest internally.
    """
    message: A2AMessage
    metadata: A2ATaskMetadata = Field(default_factory=A2ATaskMetadata)


# ── SSE Events ────────────────────────────────────────────────────────────

class A2ATaskEvent(BaseModel):
    """Single SSE event yielded during task execution."""
    type: str  # "status" | "artifact" | "final" | "error"
    state: str | None = None  # "working" | "completed"
    message: str | None = None
    content: str | None = None
    artifacts: list[Any] | None = None
    stopReason: str | None = None


class A2AAgentListResponse(BaseModel):
    agents: list[A2AAgentCard]
