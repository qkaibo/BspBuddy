from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import PolicyBinding, PolicyRule, PolicyRulePack, User, utc_now
from app.policy.resolve import resolve_policy
from app.policy.schema import (
    PolicyBindingCreate,
    PolicyBindingRead,
    PolicyPackCreate,
    PolicyPackRead,
    PolicyRuleCreate,
    PolicyRuleRead,
    ResolvedPolicy,
    content_hash,
)
from app.security.auth import get_current_user
from app.security.tenant import ensure_tenant

router = APIRouter(
    prefix="/api/enterprise/policy",
    tags=["enterprise:policy"],
    dependencies=[Depends(get_current_user)],
)


def _iso(dt) -> str:
    return dt.isoformat() if dt else ""


def _rule_read(row: PolicyRule) -> PolicyRuleRead:
    return PolicyRuleRead(
        id=row.id,
        tenant_id=row.tenant_id,
        slug=row.slug,
        title=row.title,
        body_md=row.body_md,
        severity=row.severity,
        status=row.status,
        content_hash=row.content_hash,
        updated_at=_iso(row.updated_at),
    )


def _pack_read(row: PolicyRulePack) -> PolicyPackRead:
    return PolicyPackRead(
        id=row.id,
        tenant_id=row.tenant_id,
        slug=row.slug,
        name=row.name,
        description=row.description,
        kind=row.kind,
        rule_ids=list(row.rule_ids_json or []),
        version=row.version,
        updated_at=_iso(row.updated_at),
    )


@router.get("/resolved", response_model=ResolvedPolicy)
def get_resolved_policy(
    tenant_id: str = Query(...),
    project_key: str | None = Query(None),
    mode: str | None = Query(None),
    expert_id: str | None = Query(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ResolvedPolicy:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    return resolve_policy(
        db,
        tenant_id=tenant_id,
        project_key=(project_key or "").strip() or None,
        mode=(mode or "").strip() or None,
        expert_id=(expert_id or "").strip() or None,
    )


@router.get("/rules", response_model=list[PolicyRuleRead])
def list_rules(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[PolicyRuleRead]:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    rows = db.exec(select(PolicyRule).where(PolicyRule.tenant_id == tenant_id)).all()
    rows = sorted(rows, key=lambda r: r.slug)
    return [_rule_read(row) for row in rows]


@router.post("/rules", response_model=PolicyRuleRead)
def create_rule(
    body: PolicyRuleCreate,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PolicyRuleRead:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    slug = body.slug.strip()
    # Same slug may exist for higher-priority pack overrides (policy-001).
    row = PolicyRule(
        tenant_id=tenant_id,
        slug=slug,
        title=body.title.strip(),
        body_md=body.body_md,
        severity=body.severity,
        status=body.status,
        content_hash=content_hash(body.body_md),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _rule_read(row)


@router.get("/packs", response_model=list[PolicyPackRead])
def list_packs(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[PolicyPackRead]:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    rows = db.exec(select(PolicyRulePack).where(PolicyRulePack.tenant_id == tenant_id)).all()
    rows = sorted(rows, key=lambda r: r.slug)
    return [_pack_read(row) for row in rows]


@router.post("/packs", response_model=PolicyPackRead)
def create_pack(
    body: PolicyPackCreate,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PolicyPackRead:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    slug = body.slug.strip()
    existing = db.exec(
        select(PolicyRulePack).where(PolicyRulePack.tenant_id == tenant_id, PolicyRulePack.slug == slug)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Pack slug already exists")

    rule_ids = list(body.rule_ids)
    if body.rule_slugs:
        for rule_slug in body.rule_slugs:
            rule = db.exec(
                select(PolicyRule).where(
                    PolicyRule.tenant_id == tenant_id,
                    PolicyRule.slug == rule_slug.strip(),
                )
            ).first()
            if not rule:
                raise HTTPException(status_code=404, detail=f"Rule not found: {rule_slug}")
            if rule.id not in rule_ids:
                rule_ids.append(rule.id)
    if not rule_ids:
        raise HTTPException(status_code=400, detail="Pack requires at least one rule")

    row = PolicyRulePack(
        tenant_id=tenant_id,
        slug=slug,
        name=body.name.strip(),
        description=body.description,
        kind=body.kind,
        rule_ids_json=rule_ids,
        version=body.version,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _pack_read(row)


@router.get("/bindings", response_model=list[PolicyBindingRead])
def list_bindings(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[PolicyBindingRead]:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    rows = db.exec(select(PolicyBinding).where(PolicyBinding.tenant_id == tenant_id)).all()
    out: list[PolicyBindingRead] = []
    for row in rows:
        pack = db.get(PolicyRulePack, row.pack_id)
        out.append(
            PolicyBindingRead(
                id=row.id,
                tenant_id=row.tenant_id,
                pack_id=row.pack_id,
                pack_slug=pack.slug if pack else None,
                target_type=row.target_type,
                target_key=row.target_key,
                priority=row.priority,
                enabled=row.enabled,
                updated_at=_iso(row.updated_at),
            )
        )
    return out


@router.post("/bindings", response_model=PolicyBindingRead)
def create_binding(
    body: PolicyBindingCreate,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PolicyBindingRead:
    ensure_tenant(db, tenant_id)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    pack: PolicyRulePack | None = None
    if body.pack_id:
        pack = db.get(PolicyRulePack, body.pack_id)
    elif body.pack_slug:
        pack = db.exec(
            select(PolicyRulePack).where(
                PolicyRulePack.tenant_id == tenant_id,
                PolicyRulePack.slug == body.pack_slug.strip(),
            )
        ).first()
    if not pack or pack.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Pack not found")

    target_key = body.target_key.strip()
    if body.target_type == "tenant":
        target_key = tenant_id

    row = PolicyBinding(
        tenant_id=tenant_id,
        pack_id=pack.id,
        target_type=body.target_type,
        target_key=target_key,
        priority=body.priority,
        enabled=body.enabled,
        updated_at=utc_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return PolicyBindingRead(
        id=row.id,
        tenant_id=row.tenant_id,
        pack_id=row.pack_id,
        pack_slug=pack.slug,
        target_type=row.target_type,
        target_key=row.target_key,
        priority=row.priority,
        enabled=row.enabled,
        updated_at=_iso(row.updated_at),
    )
