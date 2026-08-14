"""Phase C selftest: store list / library / revisions / install-prompt."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine, init_db
from app.db.models import User
from app.db.seed import seed_demo_data
from app.main import app
from app.security.auth import create_access_token


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        user = db.exec(select(User).where(User.username == "admin")).first()
        assert user
        token = create_access_token(user)

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}
    params = {"tenant_id": "tenant_demo"}

    cats = client.get("/api/enterprise/skill-categories", params=params, headers=headers)
    assert cats.status_code == 200, cats.text
    assert len(cats.json()) >= 3

    store = client.get(
        "/api/enterprise/general-skills/store",
        params={**params, "q": "demo", "sort": "latest"},
        headers=headers,
    )
    assert store.status_code == 200, store.text
    items = store.json()
    assert len(items) >= 2, items
    slug = next(i["slug"] for i in items if i["slug"].startswith("demo-"))

    featured = client.get(
        "/api/enterprise/general-skills/store",
        params={**params, "featured": True},
        headers=headers,
    )
    assert featured.status_code == 200
    assert all(i.get("is_highlighted") for i in featured.json())

    add = client.post(
        f"/api/enterprise/general-skills/{slug}/library",
        params=params,
        headers=headers,
    )
    assert add.status_code == 200, add.text
    assert add.json()["slug"] == slug

    lib = client.get(
        "/api/enterprise/general-skills/library/me",
        params=params,
        headers=headers,
    )
    assert lib.status_code == 200
    assert any(i["slug"] == slug for i in lib.json())

    revs = client.get(
        f"/api/enterprise/general-skills/{slug}/revisions",
        params=params,
        headers=headers,
    )
    assert revs.status_code == 200
    assert len(revs.json()) >= 1

    import time

    bump_ver = f"1.0.1-test-{int(time.time())}"
    created = client.post(
        f"/api/enterprise/general-skills/{slug}/revisions",
        params=params,
        headers=headers,
        json={"version": bump_ver, "changelog": "phase c selftest bump"},
    )
    assert created.status_code == 200, created.text

    prompt = client.get(
        f"/api/enterprise/general-skills/{slug}/install-prompt",
        params={**params, "platform": "cursor"},
        headers=headers,
    )
    assert prompt.status_code == 200
    assert "不要" in prompt.json()["prompt_text"] or "禁止" in prompt.json()["prompt_text"]

    # L3: install-prompt blocked
    with Session(engine) as db:
        from app.db.models import GeneralSkill

        skill = db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == "tenant_demo", GeneralSkill.slug == slug
            )
        ).first()
        assert skill
        skill.access_level = "L3"
        skill.allow_local_download = False
        db.add(skill)
        db.commit()

    blocked = client.get(
        f"/api/enterprise/general-skills/{slug}/install-prompt",
        params={**params, "platform": "cursor"},
        headers=headers,
    )
    # admin bypasses L3
    assert blocked.status_code == 200

    member = None
    with Session(engine) as db:
        member = db.exec(select(User).where(User.username == "user_demo")).first()
        assert member
        member_token = create_access_token(member)
    blocked_member = client.get(
        f"/api/enterprise/general-skills/{slug}/install-prompt",
        params={**params, "platform": "cursor"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert blocked_member.status_code == 403, blocked_member.text

    with Session(engine) as db:
        from app.db.models import GeneralSkill

        skill = db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == "tenant_demo", GeneralSkill.slug == slug
            )
        ).first()
        assert skill
        skill.access_level = "L1"
        skill.allow_local_download = True
        db.add(skill)
        db.commit()

    print("OK phase C selftest", {"slug": slug, "store": len(items), "categories": len(cats.json())})


if __name__ == "__main__":
    main()
