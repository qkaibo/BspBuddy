from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException
from sqlmodel import Session, select

from app.db.models import GeneralSkill, SkillAccessGrant, SkillAccessWhitelist, User

AccessAction = Literal["invoke", "download", "read_body"]
GrantType = Literal["use", "download", "both"]


def normalize_access_level(value: str | None) -> str:
    raw = (value or "L1").strip().upper()
    if raw in {"PUBLIC", "L1"}:
        return "L1"
    if raw in {"L2"}:
        return "L2"
    if raw in {"L3", "RESTRICTED", "PRIVATE", "DEPARTMENT_ONLY"}:
        return "L3"
    return "L1"


def is_author_or_admin(user: User | None, skill: GeneralSkill) -> bool:
    if user is None:
        return False
    if (user.role or "").lower() in {"admin", "owner", "tenant_admin"}:
        return True
    author_id = getattr(skill, "author_user_id", None)
    return bool(author_id and author_id == user.id)


def _has_approved_grant(
    db: Session, *, skill: GeneralSkill, user: User, grant_type: Literal["use", "download"]
) -> bool:
    row = db.exec(
        select(SkillAccessGrant).where(
            SkillAccessGrant.tenant_id == skill.tenant_id,
            SkillAccessGrant.skill_id == skill.id,
            SkillAccessGrant.grantee_user_id == user.id,
            SkillAccessGrant.grant_type == grant_type,
            SkillAccessGrant.status == "approved",
        )
    ).first()
    return row is not None


def _whitelisted(
    db: Session, *, skill: GeneralSkill, user: User, grant_type: Literal["use", "download"]
) -> bool:
    rows = db.exec(
        select(SkillAccessWhitelist).where(
            SkillAccessWhitelist.tenant_id == skill.tenant_id,
            SkillAccessWhitelist.skill_id == skill.id,
            SkillAccessWhitelist.principal_type == "user",
            SkillAccessWhitelist.principal_id == user.id,
        )
    ).all()
    for row in rows:
        gt = (row.grant_type or "both").lower()
        if gt == "both" or gt == grant_type:
            return True
    return False


def can_invoke(db: Session, user: User | None, skill: GeneralSkill) -> bool:
    if is_author_or_admin(user, skill):
        return True
    if user is None:
        return False
    level = normalize_access_level(getattr(skill, "access_level", None))
    if level in {"L1", "L2"}:
        return True
    if _whitelisted(db, skill=skill, user=user, grant_type="use"):
        return True
    return _has_approved_grant(db, skill=skill, user=user, grant_type="use")


def can_download(db: Session, user: User | None, skill: GeneralSkill) -> bool:
    level = normalize_access_level(getattr(skill, "access_level", None))
    allow_download = bool(getattr(skill, "allow_local_download", True))
    if level == "L3" or not allow_download:
        return False
    if is_author_or_admin(user, skill):
        return True
    if user is None:
        return False
    if level == "L1":
        return True
    if _whitelisted(db, skill=skill, user=user, grant_type="download"):
        return True
    return _has_approved_grant(db, skill=skill, user=user, grant_type="download")


def can_read_full_body(db: Session, user: User | None, skill: GeneralSkill) -> bool:
    if not bool(getattr(skill, "secure_content_enabled", True)):
        return can_invoke(db, user, skill)
    level = normalize_access_level(getattr(skill, "access_level", None))
    if level != "L3":
        return can_invoke(db, user, skill)
    return can_invoke(db, user, skill)


def access_denied_envelope(
    *,
    skill: GeneralSkill,
    denied_action: AccessAction,
    message: str | None = None,
) -> dict[str, Any]:
    level = normalize_access_level(getattr(skill, "access_level", None))
    if denied_action == "download":
        action_type = "request_download"
        label = "申请下载"
        default_message = f"{level}：下载需要授权"
    else:
        action_type = "request_use"
        label = "申请使用"
        default_message = f"{level}：需要使用授权"
    return {
        "code": "skill_access_denied",
        "message": message or default_message,
        "skill_slug": skill.slug,
        "access_level": level,
        "denied_action": denied_action,
        "next_actions": [
            {
                "type": action_type,
                "label": label,
                "url": f"bspbuddy://skills/{skill.slug}/request-access",
            }
        ],
    }


def raise_access_denied(
    *,
    skill: GeneralSkill,
    denied_action: AccessAction,
    message: str | None = None,
) -> None:
    raise HTTPException(
        status_code=403,
        detail=access_denied_envelope(
            skill=skill, denied_action=denied_action, message=message
        ),
    )


def ensure_can_invoke(db: Session, user: User | None, skill: GeneralSkill) -> None:
    if not can_invoke(db, user, skill):
        raise_access_denied(skill=skill, denied_action="invoke")


def ensure_can_download(db: Session, user: User | None, skill: GeneralSkill) -> None:
    if not can_download(db, user, skill):
        raise_access_denied(skill=skill, denied_action="download")


def ensure_can_read_full_body(db: Session, user: User | None, skill: GeneralSkill) -> None:
    if not can_read_full_body(db, user, skill):
        raise_access_denied(skill=skill, denied_action="read_body")


def ensure_skill_access_manager(user: User, skill: GeneralSkill) -> None:
    if is_author_or_admin(user, skill):
        return
    raise HTTPException(status_code=403, detail="Only skill author or admin can manage access")


def find_pending_or_approved_grant(
    db: Session,
    *,
    skill: GeneralSkill,
    user: User,
    grant_type: Literal["use", "download"],
) -> SkillAccessGrant | None:
    pending = db.exec(
        select(SkillAccessGrant).where(
            SkillAccessGrant.tenant_id == skill.tenant_id,
            SkillAccessGrant.skill_id == skill.id,
            SkillAccessGrant.grantee_user_id == user.id,
            SkillAccessGrant.grant_type == grant_type,
            SkillAccessGrant.status == "pending",
        )
    ).first()
    if pending:
        return pending
    return db.exec(
        select(SkillAccessGrant).where(
            SkillAccessGrant.tenant_id == skill.tenant_id,
            SkillAccessGrant.skill_id == skill.id,
            SkillAccessGrant.grantee_user_id == user.id,
            SkillAccessGrant.grant_type == grant_type,
            SkillAccessGrant.status == "approved",
        )
    ).first()


def grant_to_read(
    row: SkillAccessGrant, *, skill_slug: str, already_authorized: bool = False
) -> dict[str, Any]:
    return {
        "id": row.id,
        "skill_id": row.skill_id,
        "skill_slug": skill_slug,
        "grantee_user_id": row.grantee_user_id,
        "grant_type": row.grant_type,
        "status": row.status,
        "reason": row.reason,
        "decision_note": row.decision_note,
        "decided_by": row.decided_by,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
        "created_at": row.created_at.isoformat(),
        "already_authorized": already_authorized,
    }
