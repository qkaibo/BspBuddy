"""Phase A selftest: policy resolved + seed packs."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine, init_db
from app.db.models import PolicyBinding, PolicyRule, PolicyRulePack, User
from app.db.seed import seed_demo_data
from app.main import app
from app.security.auth import create_access_token


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        user = db.exec(
            select(User).where(User.tenant_id == "tenant_demo", User.username == "admin")
        ).first()
        assert user is not None, "admin user missing"
        rules = db.exec(
            select(PolicyRule).where(
                PolicyRule.tenant_id == "tenant_demo",
                PolicyRule.status == "published",
            )
        ).all()
        assert len(rules) >= 2, f"expected >=2 policy rules, got {len(rules)}"
        expert_binding = db.exec(
            select(PolicyBinding).where(
                PolicyBinding.tenant_id == "tenant_demo",
                PolicyBinding.target_type == "expert",
                PolicyBinding.enabled == True,  # noqa: E712
            )
        ).first()
        assert expert_binding is not None, "expert policy binding missing"
        expert_id = expert_binding.target_key
        token = create_access_token(user)

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}

    base = client.get(
        "/api/enterprise/policy/resolved",
        params={"tenant_id": "tenant_demo"},
        headers=headers,
    )
    assert base.status_code == 200, base.text
    data = base.json()
    assert data["tenant_id"] == "tenant_demo"
    assert len(data["packs"]) >= 1
    assert any(p["kind"] == "org_baseline" for p in data["packs"])
    slugs = {r["slug"] for r in data["rules"]}
    assert "no-secrets" in slugs
    assert "prefer-pr" in slugs
    assert "project-layout" not in slugs
    assert "expert-cite-mcp" not in slugs
    assert data["policy_version"].startswith("sha256:")
    org_secrets = next(r for r in data["rules"] if r["slug"] == "no-secrets")
    assert "专家增强" not in org_secrets["body_md"]
    assert org_secrets["source_kind"] == "org_baseline"

    proj = client.get(
        "/api/enterprise/policy/resolved",
        params={
            "tenant_id": "tenant_demo",
            "project_key": "github.com/demo/bspbuddy-app",
        },
        headers=headers,
    )
    assert proj.status_code == 200, proj.text
    pdata = proj.json()
    pslugs = {r["slug"] for r in pdata["rules"]}
    assert "project-layout" in pslugs
    assert "no-secrets" in pslugs

    mode = client.get(
        "/api/enterprise/policy/resolved",
        params={
            "tenant_id": "tenant_demo",
            "project_key": "github.com/demo/bspbuddy-app",
            "mode": "review",
        },
        headers=headers,
    )
    assert mode.status_code == 200, mode.text
    mslugs = {r["slug"] for r in mode.json()["rules"]}
    assert "review-checklist" in mslugs

    expert = client.get(
        "/api/enterprise/policy/resolved",
        params={
            "tenant_id": "tenant_demo",
            "project_key": "github.com/demo/bspbuddy-app",
            "mode": "review",
            "expert_id": expert_id,
        },
        headers=headers,
    )
    assert expert.status_code == 200, expert.text
    edata = expert.json()
    eslugs = {r["slug"] for r in edata["rules"]}
    assert "expert-cite-mcp" in eslugs
    assert "review-checklist" in eslugs
    overridden = next(r for r in edata["rules"] if r["slug"] == "no-secrets")
    assert "专家增强" in overridden["body_md"], overridden["body_md"]
    assert overridden["source_kind"] == "expert"
    assert overridden["source_pack_slug"] == "expert-qcm-charging"

    anon = client.get(
        "/api/enterprise/policy/resolved",
        params={"tenant_id": "tenant_demo"},
    )
    assert anon.status_code == 401

    print("selftest_policy_phase_a: OK")


if __name__ == "__main__":
    main()
