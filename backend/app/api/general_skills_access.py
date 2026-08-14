from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import GeneralSkill, SkillAccessGrant, SkillAccessWhitelist, User, utc_now
from app.general_skills.access import (
    ensure_skill_access_manager,
    find_pending_or_approved_grant,
    grant_to_read,
    normalize_access_level,
)
from app.general_skills.schema import (
    SkillAccessDecideRequest,
    SkillAccessGrantRead,
    SkillAccessRequestCreate,
    SkillAccessWhitelistEntry,
    SkillAccessWhitelistPutRequest,
    SkillAccessWhitelistRead,
)
from app.security.auth import get_current_user
from app.security.tenant import ensure_tenant

router = APIRouter(
    prefix="/api/enterprise/general-skills",
    tags=["enterprise:general-skills-access"],
    dependencies=[Depends(get_current_user)],
)


def _get_skill(db: Session, tenant_id: str, slug: str) -> GeneralSkill:
    ensure_tenant(db, tenant_id)
    row = db.exec(
        select(GeneralSkill).where(GeneralSkill.tenant_id == tenant_id, GeneralSkill.slug == slug)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="General skill not found")
    if row.status == "archived":
        raise HTTPException(status_code=410, detail="General skill archived")
    return row


@router.post("/{slug}/access-requests", response_model=SkillAccessGrantRead)
def create_access_request(
    slug: str,
    body: SkillAccessRequestCreate,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SkillAccessGrantRead:
    skill = _get_skill(db, tenant_id, slug)
    level = normalize_access_level(getattr(skill, "access_level", None))
    request_type = body.request_type
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason is required")
    if level == "L1":
        raise HTTPException(status_code=400, detail="L1 skills do not require access requests")
    if level == "L3" and request_type == "download":
        raise HTTPException(status_code=400, detail="L3 skills forbid download requests")
    if level == "L2" and request_type == "use":
        raise HTTPException(
            status_code=400,
            detail="L2 skills allow invoke without use grant; request download instead",
        )

    existing = find_pending_or_approved_grant(
        db, skill=skill, user=current_user, grant_type=request_type
    )
    if existing:
        return SkillAccessGrantRead.model_validate(
            grant_to_read(
                existing,
                skill_slug=skill.slug,
                already_authorized=existing.status == "approved",
            )
        )

    row = SkillAccessGrant(
        tenant_id=tenant_id,
        skill_id=skill.id,
        grantee_user_id=current_user.id,
        grant_type=request_type,
        status="pending",
        reason=reason[:500],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SkillAccessGrantRead.model_validate(grant_to_read(row, skill_slug=skill.slug))


@router.get("/{slug}/access-requests", response_model=list[SkillAccessGrantRead])
def list_access_requests(
    slug: str,
    tenant_id: str = Query(...),
    status: str | None = Query(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[SkillAccessGrantRead]:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    statement = select(SkillAccessGrant).where(
        SkillAccessGrant.tenant_id == tenant_id,
        SkillAccessGrant.skill_id == skill.id,
    )
    if status:
        statement = statement.where(SkillAccessGrant.status == status.strip().lower())
    rows = db.exec(statement.order_by(SkillAccessGrant.created_at.desc())).all()
    return [
        SkillAccessGrantRead.model_validate(grant_to_read(row, skill_slug=skill.slug))
        for row in rows
    ]


@router.post("/{slug}/access-requests/{request_id}/decide", response_model=SkillAccessGrantRead)
def decide_access_request(
    slug: str,
    request_id: str,
    body: SkillAccessDecideRequest,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SkillAccessGrantRead:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    row = db.get(SkillAccessGrant, request_id)
    if not row or row.tenant_id != tenant_id or row.skill_id != skill.id:
        raise HTTPException(status_code=404, detail="Access request not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {row.status}")

    note = (body.note or "").strip()
    if body.decision == "reject" and not note:
        raise HTTPException(status_code=400, detail="reject note is required")

    row.status = "approved" if body.decision == "approve" else "rejected"
    row.decision_note = note or None
    row.decided_by = current_user.id
    row.decided_at = utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    return SkillAccessGrantRead.model_validate(grant_to_read(row, skill_slug=skill.slug))


@router.get("/{slug}/grants", response_model=list[SkillAccessGrantRead])
def list_active_grants(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[SkillAccessGrantRead]:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    rows = db.exec(
        select(SkillAccessGrant)
        .where(
            SkillAccessGrant.tenant_id == tenant_id,
            SkillAccessGrant.skill_id == skill.id,
            SkillAccessGrant.status == "approved",
        )
        .order_by(SkillAccessGrant.created_at.desc())
    ).all()
    return [
        SkillAccessGrantRead.model_validate(
            grant_to_read(row, skill_slug=skill.slug, already_authorized=True)
        )
        for row in rows
    ]


@router.delete("/{slug}/grants/{grant_id}", response_model=SkillAccessGrantRead)
def revoke_grant(
    slug: str,
    grant_id: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SkillAccessGrantRead:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    row = db.get(SkillAccessGrant, grant_id)
    if not row or row.tenant_id != tenant_id or row.skill_id != skill.id:
        raise HTTPException(status_code=404, detail="Grant not found")
    if row.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved grants can be revoked")
    row.status = "revoked"
    row.decided_by = current_user.id
    row.decided_at = utc_now()
    row.decision_note = (row.decision_note or "") + (" | revoked" if row.decision_note else "revoked")
    db.add(row)
    db.commit()
    db.refresh(row)
    return SkillAccessGrantRead.model_validate(grant_to_read(row, skill_slug=skill.slug))


@router.put("/{slug}/whitelist", response_model=SkillAccessWhitelistRead)
def put_whitelist(
    slug: str,
    body: SkillAccessWhitelistPutRequest,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SkillAccessWhitelistRead:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    existing = db.exec(
        select(SkillAccessWhitelist).where(
            SkillAccessWhitelist.tenant_id == tenant_id,
            SkillAccessWhitelist.skill_id == skill.id,
        )
    ).all()
    for row in existing:
        db.delete(row)
    entries: list[SkillAccessWhitelistEntry] = []
    for item in body.entries:
        principal_id = item.principal_id.strip()
        if not principal_id:
            continue
        row = SkillAccessWhitelist(
            tenant_id=tenant_id,
            skill_id=skill.id,
            principal_type="user",
            principal_id=principal_id,
            grant_type=item.grant_type,
        )
        db.add(row)
        entries.append(
            SkillAccessWhitelistEntry(
                principal_type="user",
                principal_id=principal_id,
                grant_type=item.grant_type,
            )
        )
    db.commit()
    return SkillAccessWhitelistRead(skill_slug=skill.slug, entries=entries)


@router.get("/{slug}/whitelist", response_model=SkillAccessWhitelistRead)
def get_whitelist(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SkillAccessWhitelistRead:
    skill = _get_skill(db, tenant_id, slug)
    ensure_skill_access_manager(current_user, skill)
    rows = db.exec(
        select(SkillAccessWhitelist).where(
            SkillAccessWhitelist.tenant_id == tenant_id,
            SkillAccessWhitelist.skill_id == skill.id,
        )
    ).all()
    return SkillAccessWhitelistRead(
        skill_slug=skill.slug,
        entries=[
            SkillAccessWhitelistEntry(
                principal_type="user",
                principal_id=row.principal_id,
                grant_type=row.grant_type,  # type: ignore[arg-type]
            )
            for row in rows
        ],
    )
