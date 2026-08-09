from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import ExpertModelCatalog, User, utc_now
from app.security.auth import get_current_user
from app.security.encryption import decrypt_secret, encrypt_secret, mask_secret
from app.security.permissions import ensure_tenant_admin
from app.llm import LLMClient, LLMError

router = APIRouter(
    prefix="/api/enterprise/expert-model-catalog",
    tags=["enterprise:expert-model-catalog"],
    dependencies=[Depends(get_current_user)],
)


# ── Schemas ──────────────────────────────────────────────

class ExpertModelCatalogCreateRequest(BaseModel):
    tenant_id: Optional[str] = None
    name: str
    provider: Optional[str] = None
    api_protocol: Optional[str] = None
    base_url: Optional[str] = None
    api_key: str = Field(default="", repr=False)
    model: str
    temperature: float = 0.2
    max_output_tokens: int = 8192
    is_default: bool = False


class ExpertModelCatalogUpdateRequest(BaseModel):
    tenant_id: Optional[str] = None
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = Field(default=None, repr=False)
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    enabled: Optional[bool] = None
    is_default: Optional[bool] = None


class ExpertModelCatalogRead(BaseModel):
    id: str
    tenant_id: str
    name: str
    provider: str
    api_protocol: str
    base_url: Optional[str] = None
    api_key_masked: str
    model: str
    temperature: float
    max_output_tokens: int
    enabled: bool
    is_default: bool
    created_by_user_id: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


# ── Helpers ──────────────────────────────────────────────

def _catalog_read(row: ExpertModelCatalog) -> ExpertModelCatalogRead:
    api_key = decrypt_secret(row.api_key_encrypted)
    return ExpertModelCatalogRead(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        provider=row.provider,
        api_protocol=row.api_protocol,
        base_url=row.base_url,
        api_key_masked=mask_secret(api_key),
        model=row.model,
        temperature=row.temperature,
        max_output_tokens=row.max_output_tokens,
        enabled=row.enabled,
        is_default=row.is_default,
        created_by_user_id=row.created_by_user_id,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


def _unset_other_defaults(db: Session, tenant_id: str, exclude_id: str) -> None:
    """Set is_default=False for all other entries in the same tenant."""
    others = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
            ExpertModelCatalog.is_default == True,  # noqa: E712
            ExpertModelCatalog.id != exclude_id,
        )
    ).all()
    for other in others:
        other.is_default = False
        db.add(other)


def _ensure_default(db: Session, tenant_id: str) -> None:
    """Guarantee at least one enabled entry is marked as default."""
    existing = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
            ExpertModelCatalog.is_default == True,  # noqa: E712
        )
    ).first()
    if existing:
        return
    first = db.exec(
        select(ExpertModelCatalog)
        .where(
            ExpertModelCatalog.tenant_id == tenant_id,
            ExpertModelCatalog.enabled == True,  # noqa: E712
        )
        .order_by(ExpertModelCatalog.created_at)
    ).first()
    if first:
        first.is_default = True
        db.add(first)


def _get_catalog_entry(db: Session, tenant_id: str, entry_id: str) -> ExpertModelCatalog:
    row = db.get(ExpertModelCatalog, entry_id)
    if row is None or row.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="EXPERT_MODEL_CATALOG_NOT_FOUND")
    return row


# ── Routes ───────────────────────────────────────────────

@router.get(
    "",
    response_model=list[ExpertModelCatalogRead],
)
def list_catalog(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ExpertModelCatalogRead]:
    """List all expert model catalog entries for the tenant.  All authenticated users can read."""
    # No admin guard on read — all users need the list for ExpertEditorModal model tab
    rows = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
        )
    ).all()
    _ensure_default(db, tenant_id)
    db.commit()
    # Re-fetch after potential auto-default change
    rows = db.exec(
        select(ExpertModelCatalog).where(
            ExpertModelCatalog.tenant_id == tenant_id,
        )
    ).all()
    return [_catalog_read(row) for row in rows]


@router.post("", response_model=ExpertModelCatalogRead)
def create_catalog(
    request: ExpertModelCatalogCreateRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpertModelCatalogRead:
    tid = request.tenant_id or current_user.tenant_id
    ensure_tenant_admin(tid, current_user)
    if not request.api_key:
        raise HTTPException(status_code=422, detail="MODEL_API_KEY_REQUIRED")
    row = ExpertModelCatalog(
        tenant_id=tid,
        name=request.name,
        provider=request.provider or "openai_compatible",
        api_protocol=request.api_protocol or "openai_chat_completions",
        base_url=request.base_url,
        api_key_encrypted=encrypt_secret(request.api_key),
        model=request.model,
        temperature=request.temperature,
        max_output_tokens=request.max_output_tokens,
        is_default=request.is_default,
        enabled=True,
        created_by_user_id=current_user.id,
    )
    if request.is_default:
        _unset_other_defaults(db, tid, row.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    _ensure_default(db, tid)
    db.commit()
    db.refresh(row)
    return _catalog_read(row)


@router.put("/{entry_id}", response_model=ExpertModelCatalogRead)
def update_catalog(
    entry_id: str,
    request: ExpertModelCatalogUpdateRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpertModelCatalogRead:
    tid = request.tenant_id or current_user.tenant_id
    ensure_tenant_admin(tid, current_user)
    row = _get_catalog_entry(db, tid, entry_id)
    for field in ("name", "base_url", "model", "temperature", "max_output_tokens", "enabled"):
        value = getattr(request, field)
        if value is not None:
            setattr(row, field, value)
    if request.is_default is not None:
        row.is_default = request.is_default
        if request.is_default:
            _unset_other_defaults(db, tid, entry_id)
    if request.api_key not in {None, ""}:
        row.api_key_encrypted = encrypt_secret(request.api_key)
    row.updated_at = utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    _ensure_default(db, tid)
    db.commit()
    db.refresh(row)
    return _catalog_read(row)


@router.delete("/{entry_id}")
def delete_catalog(
    entry_id: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    ensure_tenant_admin(tenant_id, current_user)
    row = _get_catalog_entry(db, tenant_id, entry_id)
    db.delete(row)
    db.commit()
    _ensure_default(db, tenant_id)
    db.commit()
    return {"status": "deleted", "id": entry_id}


# ── Test ──────────────────────────────────────────────────

class ExpertModelCatalogTestResult(BaseModel):
    success: bool
    message: str
    output: str | None = None


@router.post("/{entry_id}/test", response_model=ExpertModelCatalogTestResult)
def test_expert_model(
    entry_id: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpertModelCatalogTestResult:
    ensure_tenant_admin(tenant_id, current_user)
    row = _get_catalog_entry(db, tenant_id, entry_id)
    api_key = decrypt_secret(row.api_key_encrypted)
    if not api_key:
        raise HTTPException(status_code=422, detail="MODEL_API_KEY_REQUIRED")

    from types import SimpleNamespace

    cfg = SimpleNamespace(
        api_protocol=row.api_protocol or "openai_chat_completions",
        api_key_encrypted=row.api_key_encrypted,
        base_url=row.base_url,
        model=row.model,
        temperature=row.temperature,
        max_output_tokens=row.max_output_tokens,
        timeout_seconds=10.0,
    )

    try:
        client = LLMClient(cfg)
        output = client.generate_text(
            "你是一个连接测试助手。请用一句中文回复连接成功。",
            {"message": "ping"},
        )
        return ExpertModelCatalogTestResult(
            success=True,
            message="连接成功",
            output=output[:200],
        )
    except LLMError as exc:
        return ExpertModelCatalogTestResult(
            success=False,
            message=str(exc),
            output=None,
        )
    except Exception as exc:
        return ExpertModelCatalogTestResult(
            success=False,
            message=f"测试失败: {type(exc).__name__}: {exc}",
            output=None,
        )
