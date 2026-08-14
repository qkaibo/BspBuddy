"""Phase D selftest: import UX fields, star, agent token, access inbox."""
from __future__ import annotations

import base64
import io
import sys
import zipfile
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


def _zip_b64(files: dict[str, str]) -> str:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for path, text in files.items():
            zf.writestr(path, text.encode("utf-8"))
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        admin = db.exec(select(User).where(User.username == "admin")).first()
        member = db.exec(select(User).where(User.username == "user_demo")).first()
        assert admin and member
        admin_token = create_access_token(admin)
        member_token = create_access_token(member)

    client = TestClient(app)
    admin_h = {"Authorization": f"Bearer {admin_token}"}
    member_h = {"Authorization": f"Bearer {member_token}"}
    params = {"tenant_id": "tenant_demo"}

    # --- import package with store fields ---
    ok_zip = _zip_b64(
        {
            "SKILL.md": "---\nname: Phase D Demo\ndescription: phase d import\n---\n# Hello\n",
            "scripts/hello.py": "print('hi')\n",
        }
    )
    imported = client.post(
        "/api/enterprise/general-skills/import-package",
        headers=admin_h,
        json={
            "tenant_id": "tenant_demo",
            "filename": "phase-d-demo.zip",
            "content_base64": ok_zip,
            "access_level": "L2",
            "version": "2.0.0",
            "source": "local",
            "status": "published",
        },
    )
    assert imported.status_code == 200, imported.text
    body = imported.json()
    slug = body["slug"]
    assert body["access_level"] == "L2"
    assert body["version"] == "2.0.0"

    # --- missing SKILL.md ---
    bad_zip = _zip_b64({"README.md": "# no skill\n"})
    missing = client.post(
        "/api/enterprise/general-skills/import-package",
        headers=admin_h,
        json={
            "tenant_id": "tenant_demo",
            "filename": "bad.zip",
            "content_base64": bad_zip,
            "status": "published",
        },
    )
    assert missing.status_code == 400, missing.text
    assert "SKILL.md" in str(missing.json().get("detail", ""))

    # --- star toggle ---
    star1 = client.post(
        f"/api/enterprise/general-skills/{slug}/star",
        params=params,
        headers=admin_h,
    )
    assert star1.status_code == 200, star1.text
    assert star1.json()["starred"] is True
    assert star1.json()["star_count"] >= 1
    star2 = client.post(
        f"/api/enterprise/general-skills/{slug}/star",
        params=params,
        headers=admin_h,
    )
    assert star2.status_code == 200
    assert star2.json()["starred"] is False

    # --- agent token: create + call runtime ---
    tok = client.post(
        "/api/enterprise/agent-tokens",
        params=params,
        headers=admin_h,
        json={"device_label": "phase-d-selftest", "ttl_hours": 24},
    )
    assert tok.status_code == 200, tok.text
    raw = tok.json()["token"]
    assert raw.startswith("bbsk_")
    token_id = tok.json()["id"]

    # Ensure L1 for runtime via agent token on a known demo skill
    with Session(engine) as db:
        skill = db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == "tenant_demo",
                GeneralSkill.slug == "demo-hello",
            )
        ).first()
        assert skill
        skill.access_level = "L1"
        db.add(skill)
        db.commit()

    runtime = client.get(
        "/api/enterprise/general-skills/demo-hello/runtime",
        params={**params, "intent": "install"},
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert runtime.status_code == 200, runtime.text
    assert "shortcut_skill_md" in runtime.json()

    listed = client.get(
        "/api/enterprise/agent-tokens",
        params=params,
        headers=admin_h,
    )
    assert listed.status_code == 200
    assert any(row["id"] == token_id for row in listed.json())

    revoked = client.delete(
        f"/api/enterprise/agent-tokens/{token_id}",
        params=params,
        headers=admin_h,
    )
    assert revoked.status_code == 200
    dead = client.get(
        "/api/enterprise/general-skills/demo-hello/runtime",
        params={**params, "intent": "install"},
        headers={"Authorization": f"Bearer {raw}"},
    )
    assert dead.status_code == 401

    # --- access inbox (author/admin sees pending) ---
    with Session(engine) as db:
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

    req = client.post(
        f"/api/enterprise/general-skills/{slug}/access-requests",
        params=params,
        headers=member_h,
        json={"request_type": "use", "reason": "phase d inbox test"},
    )
    assert req.status_code == 200, req.text

    inbox = client.get(
        "/api/enterprise/general-skills/access-requests/inbox",
        params={**params, "status": "pending"},
        headers=admin_h,
    )
    assert inbox.status_code == 200, inbox.text
    assert any(row["skill_slug"] == slug for row in inbox.json()), inbox.text

    print("selftest_skills_phase_d: OK")


if __name__ == "__main__":
    main()
