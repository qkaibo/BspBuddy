"""LLM proxy service — decrypted key → OpenAI-compatible API call.

This is the single authoritative LLM call path. All clients (desktop/web/mobile)
route through here so API keys stay server-side encrypted.
"""

from __future__ import annotations

import logging
from collections.abc import Generator

from fastapi import HTTPException
from openai import OpenAI
from sqlmodel import Session

from app.agents.branching import model_for_agent
from app.db.models import ModelConfig
from app.security.encryption import decrypt_secret

logger = logging.getLogger("bspbuddy.llm_proxy")


def _resolve_config(db: Session, tenant_id: str, config_id: str) -> tuple[str, str, str]:
    """Look up a ModelConfig and return (api_key, base_url, model)."""
    row = db.get(ModelConfig, config_id)
    if row is None or row.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="MODEL_CONFIG_NOT_FOUND")
    if not row.enabled:
        raise HTTPException(status_code=409, detail="MODEL_CONFIG_DISABLED")

    api_key = decrypt_secret(row.api_key_encrypted)
    base_url = row.base_url or "https://api.openai.com/v1"
    model = row.model
    return api_key, base_url, model


def _resolve_config_for_agent(
    db: Session, tenant_id: str, agent_id: str
) -> tuple[str, str, str]:
    """Resolve the runtime model for an expert agent (ExpertModelCatalog or fallback)."""
    resolved = model_for_agent(db, tenant_id, agent_id)
    if resolved is None:
        raise HTTPException(
            status_code=404, detail="AGENT_MODEL_NOT_CONFIGURED"
        )
    api_key = decrypt_secret(resolved.api_key_encrypted)
    base_url = resolved.base_url or "https://api.openai.com/v1"
    model = resolved.model
    return api_key, base_url, model


class LlmProxyService:
    """Calls OpenAI-compatible API with server-side decrypted credentials."""

    def chat_sync(
        self,
        db: Session,
        tenant_id: str,
        config_id: str | None,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 4096,
        agent_id: str | None = None,
    ) -> dict:
        if agent_id:
            api_key, base_url, model = _resolve_config_for_agent(db, tenant_id, agent_id)
        else:
            api_key, base_url, model = _resolve_config(db, tenant_id, config_id)

        client = OpenAI(api_key=api_key, base_url=base_url, timeout=60.0, max_retries=1)
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return {
                "content": response.choices[0].message.content or "",
                "model": model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                },
            }
        except Exception as exc:
            logger.exception("LLM proxy sync call failed")
            raise HTTPException(
                status_code=502,
                detail=f"LLM_CALL_FAILED: {exc}",
            ) from exc

    def chat_stream(
        self,
        db: Session,
        tenant_id: str,
        config_id: str | None,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 4096,
        agent_id: str | None = None,
    ) -> Generator[str, None, None]:
        """Generate SSE chunks: 'data: {delta}\\n\\n'"""
        if agent_id:
            api_key, base_url, model = _resolve_config_for_agent(db, tenant_id, agent_id)
        else:
            api_key, base_url, model = _resolve_config(db, tenant_id, config_id)

        client = OpenAI(api_key=api_key, base_url=base_url, timeout=120.0, max_retries=1)
        try:
            stream = client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield f"data: {delta.content}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("LLM proxy stream call failed")
            yield f"data: [ERROR] LLM_CALL_FAILED: {exc}\n\n"


llm_proxy = LlmProxyService()
