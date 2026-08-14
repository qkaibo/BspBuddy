"""Phase B selftest: L1/L2/L3 access requests and gating."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine, init_db
from app.db.models import GeneralSkill, SkillAccessGrant, User
from app.db.seed import seed_demo_data
from app.main import app
from app.security.auth import create_access_token


def _user(db: Session, username: str) -> User:
    row = db.exec(
        select(User).where(User.tenant_id == "tenant_demo", User.username == username)
    ).first()
    assert row is not None, username
    return row


def _set_level(db: Session, slug: str, level: str) -> GeneralSkill:
    skill = db.exec(
        select(GeneralSkill).where(
            GeneralSkill.tenant_id == "tenant_demo", GeneralSkill.slug == slug
        )
    ).first()
    assert skill is not None, slug
    skill.access_level = level
    skill.allow_local_download = level != "L3"
    skill.secure_content_enabled = True
    db.add(skill)
    # clear grants for clean cases
    for grant in db.exec(
        select(SkillAccessGrant).where(SkillAccessGrant.skill_id == skill.id)
    ).all():
        db.delete(grant)
    db.commit()
    db.refresh(skill)
    return skill


def _detail(resp) -> dict:
    data = resp.json()
    detail = data.get("detail")
    if isinstance(detail, dict):
        return detail
    return data


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        member = _user(db, "user_demo")
        admin = _user(db, "admin")
        member_token = create_access_token(member)
        admin_token = create_access_token(admin)
        slug = "demo-checklist"

    client = TestClient(app)
    member_h = {"Authorization": f"Bearer {member_token}"}
    admin_h = {"Authorization": f"Bearer {admin_token}"}
    params = {"tenant_id": "tenant_demo"}

    # --- L2 ---
    with Session(engine) as db:
        _set_level(db, slug, "L2")

    runtime = client.get(
        f"/api/enterprise/general-skills/{slug}/runtime",
        params={**params, "intent": "install"},
        headers=member_h,
    )
    assert runtime.status_code == 200, runtime.text

    denied = client.get(
        f"/api/enterprise/general-skills/{slug}/download",
        params=params,
        headers=member_h,
    )
    assert denied.status_code == 403, denied.text
    d = _detail(denied)
    assert d.get("code") == "skill_access_denied"
    assert d.get("denied_action") == "download"
    assert any(a.get("type") == "request_download" for a in d.get("next_actions") or [])

    bad_use = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "use", "reason": "need use"},
    )
    assert bad_use.status_code == 400, bad_use.text

    req1 = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "download", "reason": "need zip for offline"},
    )
    assert req1.status_code == 200, req1.text
    request_id = req1.json()["id"]
    assert req1.json()["status"] == "pending"

    req_idem = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "download", "reason": "again"},
    )
    assert req_idem.status_code == 200
    assert req_idem.json()["id"] == request_id

    decide = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests/{request_id}/decide",
        params=params,
        headers=admin_h,
        json={"decision": "approve", "note": "ok"},
    )
    assert decide.status_code == 200, decide.text
    assert decide.json()["status"] == "approved"

    ok_dl = client.get(
        f"/api/enterprise/general-skills/{slug}/download",
        params=params,
        headers=member_h,
    )
    assert ok_dl.status_code == 200, ok_dl.text
    assert ok_dl.headers.get("content-type", "").startswith("application/zip")

    # --- L3 ---
    with Session(engine) as db:
        skill = _set_level(db, slug, "L3")
        skill_id = skill.id

    blocked = client.get(
        f"/api/enterprise/general-skills/{slug}/runtime",
        params={**params, "intent": "install"},
        headers=member_h,
    )
    assert blocked.status_code == 403, blocked.text
    b = _detail(blocked)
    assert b.get("denied_action") == "invoke"
    assert any(a.get("type") == "request_use" for a in b.get("next_actions") or [])

    no_dl = client.get(
        f"/api/enterprise/general-skills/{slug}/download",
        params=params,
        headers=member_h,
    )
    assert no_dl.status_code == 403, no_dl.text

    bad_dl_req = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "download", "reason": "want zip"},
    )
    assert bad_dl_req.status_code == 400, bad_dl_req.text

    use_req = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "use", "reason": "need invoke"},
    )
    assert use_req.status_code == 200, use_req.text
    use_id = use_req.json()["id"]

    client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests/{use_id}/decide",
        params=params,
        headers=admin_h,
        json={"decision": "approve"},
    )

    allowed = client.get(
        f"/api/enterprise/general-skills/{slug}/runtime",
        params={**params, "intent": "install"},
        headers=member_h,
    )
    assert allowed.status_code == 200, allowed.text

    still_no_dl = client.get(
        f"/api/enterprise/general-skills/{slug}/download",
        params=params,
        headers=member_h,
    )
    assert still_no_dl.status_code == 403, still_no_dl.text

    grants = client.get(
        f"/api/enterprise/general-skills/{slug}/grants",
        params=params,
        headers=admin_h,
    )
    assert grants.status_code == 200
    grant_id = next(g["id"] for g in grants.json() if g["status"] == "approved")

    revoked = client.delete(
        f"/api/enterprise/general-skills/{slug}/grants/{grant_id}",
        params=params,
        headers=admin_h,
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "revoked"

    blocked_again = client.get(
        f"/api/enterprise/general-skills/{slug}/runtime",
        params={**params, "intent": "install"},
        headers=member_h,
    )
    assert blocked_again.status_code == 403, blocked_again.text

    # restore L1 for other tests
    with Session(engine) as db:
        _set_level(db, slug, "L1")

    print("OK phase B selftest", {"slug": slug, "skill_id": skill_id})


if __name__ == "__main__":
    main()
