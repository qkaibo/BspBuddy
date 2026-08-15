"""Portal 飞书 SSO 换票（portal-001 / portal-01）。

与渠道 Feishu Bot 分家：这里只处理 Portal 签发的一次性 portal_code → Buddy JWT。
"""

from __future__ import annotations

import logging
import secrets
from typing import Any

import httpx
from fastapi import HTTPException
from sqlmodel import Session, select

from app.config import get_settings
from app.db.models import Tenant, User, utc_now
from app.security.auth import hash_password
from app.security.permissions import MEMBER_ROLE

logger = logging.getLogger(__name__)


def introspect_portal_code(code: str, *, target: str = "bspbuddy") -> dict[str, Any]:
    """向 Portal BFF 验 code（一次性消费）。成功返回 identity 字典。"""
    settings = get_settings()
    url = (settings.portal_introspect_url or "").strip()
    if not url:
        raise HTTPException(status_code=503, detail="Portal introspect URL is not configured")

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(url, json={"code": code, "target": target})
    except httpx.HTTPError as exc:
        logger.exception("Portal introspect 请求失败")
        raise HTTPException(status_code=502, detail=f"Portal introspect unreachable: {exc}") from exc

    if res.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Portal introspect HTTP {res.status_code}: {res.text[:200]}",
        )

    try:
        payload = res.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Portal introspect returned non-JSON") from exc

    if not payload.get("valid"):
        reason = payload.get("reason") or "invalid_code"
        raise HTTPException(status_code=400, detail=f"portal_code invalid: {reason}")

    if payload.get("target") and payload.get("target") != target:
        raise HTTPException(status_code=400, detail="portal_code target mismatch")

    identity = payload.get("identity") or {}
    union_id = (identity.get("union_id") or identity.get("open_id") or "").strip()
    if not union_id:
        raise HTTPException(status_code=400, detail="Portal identity missing union_id/open_id")

    return {
        "union_id": union_id,
        "open_id": (identity.get("open_id") or "").strip(),
        "name": (identity.get("name") or "").strip(),
        "email": (identity.get("email") or "").strip().lower(),
        "return_url": payload.get("return_url") or "/",
    }


def resolve_tenant_id(db: Session, requested: str | None) -> str:
    settings = get_settings()
    tenant_id = (requested or settings.portal_default_tenant_id or "tenant_demo").strip()
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        # 本地演示：默认租户不存在时自动建一个，避免对接卡在空库
        tenant = Tenant(id=tenant_id, name=f"Portal Tenant ({tenant_id})")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        logger.info("Portal SSO 自动创建租户 %s", tenant_id)
    return tenant_id


def find_or_create_portal_user(db: Session, *, tenant_id: str, identity: dict[str, Any]) -> User:
    """按 feishu_union_id 映射；没有则建户（source=portal）。"""
    settings = get_settings()
    union_id = identity["union_id"]

    user = db.exec(select(User).where(User.feishu_union_id == union_id)).first()
    if user:
        changed = False
        if user.tenant_id != tenant_id:
            # 已有映射绑在别的租户：不静默搬家，避免串租户
            raise HTTPException(
                status_code=409,
                detail=f"feishu_union_id already bound to tenant {user.tenant_id}",
            )
        name = identity.get("name") or ""
        email = identity.get("email") or ""
        open_id = identity.get("open_id") or ""
        if name and user.display_name != name:
            user.display_name = name[:80]
            changed = True
        if email and user.email != email:
            user.email = email[:200]
            changed = True
        if open_id and user.feishu_open_id != open_id:
            user.feishu_open_id = open_id[:128]
            changed = True
        if changed:
            user.updated_at = utc_now()
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    if not settings.portal_allow_create_user:
        raise HTTPException(status_code=403, detail="Portal auto-provisioning is disabled")

    role = (settings.portal_default_role or MEMBER_ROLE).strip().lower()
    if role not in {"admin", "member"}:
        role = MEMBER_ROLE

    short = "".join(ch for ch in union_id if ch.isalnum())[:12] or secrets.token_hex(4)
    username = f"feishu_{short}"
    # 极端碰撞时追加随机后缀
    existing = db.exec(
        select(User).where(User.tenant_id == tenant_id, User.username == username)
    ).first()
    if existing:
        username = f"feishu_{short}_{secrets.token_hex(3)}"

    display = (identity.get("name") or username).strip()[:80]
    user = User(
        tenant_id=tenant_id,
        username=username,
        display_name=display,
        role=role,
        source="portal",
        feishu_union_id=union_id,
        feishu_open_id=(identity.get("open_id") or None) or None,
        email=(identity.get("email") or None) or None,
        password_hash=hash_password(secrets.token_urlsafe(24)),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Portal SSO 建户 user=%s tenant=%s union_id=%s", user.id, tenant_id, union_id[:12])
    return user
