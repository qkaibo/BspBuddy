from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import AgentSkillToken, GeneralSkill, User, UserSkillStar, utc_now
from app.general_skills.access import grant_to_read, is_author_or_admin
from app.general_skills.schema import SkillAccessGrantRead
from app.db.models import SkillAccessGrant
from app.security.auth import get_current_user
from app.security.tenant import ensure_tenant

router = APIRouter(
    prefix="/api/enterprise",
    tags=["enterprise:skills-extras"],
    dependencies=[Depends(get_current_user)],
)


AGENT_TOKEN_PURPOSES = ("a2a", "skill_runtime")
_PURPOSE_PREFIX = {"a2a": "bba2a_", "skill_runtime": "bbsk_"}


class AgentTokenCreateRequest(BaseModel):
    device_label: str = Field(default="agent", max_length=100)
    ttl_hours: int = Field(default=720, ge=1, le=24 * 365)
    purpose: str = Field(default="skill_runtime")


class AgentTokenCreateResponse(BaseModel):
    id: str
    token: str
    device_label: str | None = None
    purpose: str = "skill_runtime"
    token_suffix: str | None = None
    expires_at: str


class AgentTokenRead(BaseModel):
    id: str
    device_label: str | None = None
    purpose: str = "skill_runtime"
    token_suffix: str | None = None
    expires_at: str
    revoked_at: str | None = None
    created_at: str


class StarToggleResponse(BaseModel):
    slug: str
    starred: bool
    star_count: int


def hash_agent_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _normalize_purpose(raw: str | None) -> str:
    purpose = (raw or "skill_runtime").strip()
    if purpose not in AGENT_TOKEN_PURPOSES:
        raise HTTPException(
            status_code=400,
            detail=f"purpose must be one of: {', '.join(AGENT_TOKEN_PURPOSES)}",
        )
    return purpose


def _token_read(row: AgentSkillToken) -> AgentTokenRead:
    return AgentTokenRead(
        id=row.id,
        device_label=row.device_label,
        purpose=getattr(row, "purpose", None) or "skill_runtime",
        token_suffix=getattr(row, "token_suffix", None),
        expires_at=row.expires_at.isoformat(),
        revoked_at=row.revoked_at.isoformat() if row.revoked_at else None,
        created_at=row.created_at.isoformat(),
    )


def resolve_user_from_agent_token(db: Session, raw_token: str) -> User | None:
    token_hash = hash_agent_token(raw_token)
    row = db.exec(
        select(AgentSkillToken).where(
            AgentSkillToken.token_hash == token_hash,
            AgentSkillToken.revoked_at == None,  # noqa: E711
        )
    ).first()
    if not row:
        return None
    if row.expires_at < utc_now():
        return None
    return db.get(User, row.user_id)


@router.post("/agent-tokens", response_model=AgentTokenCreateResponse)
def create_agent_token(
    body: AgentTokenCreateRequest,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentTokenCreateResponse:
    ensure_tenant(db, tenant_id)
    purpose = _normalize_purpose(body.purpose)
    prefix = _PURPOSE_PREFIX[purpose]
    raw = f"{prefix}{secrets.token_urlsafe(32)}"
    suffix = raw[-4:]
    row = AgentSkillToken(
        tenant_id=tenant_id,
        user_id=current_user.id,
        token_hash=hash_agent_token(raw),
        device_label=(body.device_label or "agent").strip()[:100] or "agent",
        purpose=purpose,
        token_suffix=suffix,
        expires_at=utc_now() + timedelta(hours=body.ttl_hours),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AgentTokenCreateResponse(
        id=row.id,
        token=raw,
        device_label=row.device_label,
        purpose=purpose,
        token_suffix=suffix,
        expires_at=row.expires_at.isoformat(),
    )


@router.get("/agent-tokens", response_model=list[AgentTokenRead])
def list_agent_tokens(
    tenant_id: str = Query(...),
    purpose: str | None = Query(default=None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AgentTokenRead]:
    ensure_tenant(db, tenant_id)
    statement = select(AgentSkillToken).where(
        AgentSkillToken.tenant_id == tenant_id,
        AgentSkillToken.user_id == current_user.id,
    )
    if purpose is not None and purpose.strip():
        statement = statement.where(AgentSkillToken.purpose == _normalize_purpose(purpose))
    rows = db.exec(statement.order_by(AgentSkillToken.created_at.desc())).all()
    return [_token_read(row) for row in rows]


@router.delete("/agent-tokens/{token_id}")
def revoke_or_delete_agent_token(
    token_id: str,
    tenant_id: str = Query(...),
    permanent: bool = Query(default=False),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentTokenRead | dict[str, str | bool]:
    ensure_tenant(db, tenant_id)
    row = db.get(AgentSkillToken, token_id)
    if not row or row.tenant_id != tenant_id or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Token not found")
    if permanent:
        db.delete(row)
        db.commit()
        return {"ok": True, "id": token_id}
    if row.revoked_at is None:
        row.revoked_at = utc_now()
        db.add(row)
        db.commit()
        db.refresh(row)
    return _token_read(row)


@router.post("/general-skills/{slug}/star", response_model=StarToggleResponse)
def toggle_skill_star(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StarToggleResponse:
    ensure_tenant(db, tenant_id)
    skill = db.exec(
        select(GeneralSkill).where(GeneralSkill.tenant_id == tenant_id, GeneralSkill.slug == slug)
    ).first()
    if not skill or skill.status == "archived":
        raise HTTPException(status_code=404, detail="General skill not found")
    existing = db.exec(
        select(UserSkillStar).where(
            UserSkillStar.tenant_id == tenant_id,
            UserSkillStar.user_id == current_user.id,
            UserSkillStar.skill_id == skill.id,
        )
    ).first()
    if existing:
        db.delete(existing)
        skill.star_count = max(0, int(skill.star_count or 0) - 1)
        starred = False
    else:
        db.add(
            UserSkillStar(
                tenant_id=tenant_id,
                user_id=current_user.id,
                skill_id=skill.id,
            )
        )
        skill.star_count = int(skill.star_count or 0) + 1
        starred = True
    skill.updated_at = utc_now()
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return StarToggleResponse(slug=slug, starred=starred, star_count=int(skill.star_count or 0))


@router.get("/general-skills/access-requests/inbox", response_model=list[SkillAccessGrantRead])
def list_access_request_inbox(
    tenant_id: str = Query(...),
    status: str = Query("pending"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[SkillAccessGrantRead]:
    """Pending (or filtered) access requests for skills managed by current user."""
    ensure_tenant(db, tenant_id)
    skills = db.exec(select(GeneralSkill).where(GeneralSkill.tenant_id == tenant_id)).all()
    managed_ids = [skill.id for skill in skills if is_author_or_admin(current_user, skill)]
    if not managed_ids:
        return []
    statement = select(SkillAccessGrant).where(
        SkillAccessGrant.tenant_id == tenant_id,
        SkillAccessGrant.skill_id.in_(managed_ids),
    )
    if status:
        statement = statement.where(SkillAccessGrant.status == status.strip().lower())
    rows = db.exec(statement.order_by(SkillAccessGrant.created_at.desc())).all()
    skill_slug = {skill.id: skill.slug for skill in skills}
    return [
        SkillAccessGrantRead.model_validate(
            grant_to_read(row, skill_slug=skill_slug.get(row.skill_id, row.skill_id))
        )
        for row in rows
    ]
