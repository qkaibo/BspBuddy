"""Phase A selftest: runtime / install-prompt / agent-rules."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine, init_db
from app.db.models import GeneralSkill, User
from app.db.seed import seed_demo_data
from app.main import app
from app.security.auth import create_access_token


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        user = db.exec(select(User).where(User.tenant_id == "tenant_demo")).first()
        assert user is not None, "demo user missing"
        skills = db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == "tenant_demo",
                GeneralSkill.status == "published",
            )
        ).all()
        assert len(skills) >= 3, f"expected >=3 published skills, got {len(skills)}"
        slug = next(
            (s.slug for s in skills if s.slug == "demo-hello"),
            skills[0].slug,
        )
        token = create_access_token(user)

    client = TestClient(app)

    anon = client.get("/api/enterprise/agent-rules/bspbuddy-skills.mdc")
    assert anon.status_code == 200, anon.text
    assert "BSPBUDDY_SKILLS_BOOTSTRAP_V1_INTEGRITY_CHECK" in anon.text

    auth = {"Authorization": f"Bearer {token}"}
    full = client.get("/api/enterprise/agent-rules/bspbuddy-skills.mdc", headers=auth)
    assert full.status_code == 200, full.text
    assert "BSPBUDDY_SKILLS_RULE_V1_INTEGRITY_CHECK" in full.text

    runtime = client.get(
        f"/api/enterprise/general-skills/{slug}/runtime",
        params={"tenant_id": "tenant_demo", "intent": "install"},
        headers=auth,
    )
    assert runtime.status_code == 200, runtime.text
    body = runtime.json()
    assert body["slug"] == slug
    assert "shortcut_skill_md" in body and "Runtime" in body["shortcut_skill_md"]
    assert body["access_level"] == "L1"

    prompt = client.get(
        f"/api/enterprise/general-skills/{slug}/install-prompt",
        params={"tenant_id": "tenant_demo", "platform": "cursor"},
        headers=auth,
    )
    assert prompt.status_code == 200, prompt.text
    p = prompt.json()
    assert slug in p["prompt_text"]
    assert "/runtime" in p["runtime_url"]
    assert "bspbuddy-skills.mdc" in p["rules_url"]
    assert "token" in p["prompt_text"].lower()
    assert "不要" in p["prompt_text"] or "禁止" in p["prompt_text"]

    missing = client.get(
        "/api/enterprise/general-skills/___missing_skill___/runtime",
        params={"tenant_id": "tenant_demo"},
        headers=auth,
    )
    assert missing.status_code == 404

    print("OK phase A selftest", {"slug": slug, "skills": len(skills)})


if __name__ == "__main__":
    main()
