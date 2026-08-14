"""L2: issue purpose=a2a token → GET /a2a/agents → revoke → 401."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db.database import engine, init_db
from app.db.models import User
from app.db.seed import seed_demo_data
from app.main import app
from app.api.skills_extras import (
    AgentTokenCreateRequest,
    create_agent_token,
    revoke_or_delete_agent_token,
)


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        user = db.get(User, "admin")
        assert user is not None
        created = create_agent_token(
            AgentTokenCreateRequest(device_label="a2a-probe", ttl_hours=1, purpose="a2a"),
            tenant_id="tenant_demo",
            db=db,
            current_user=user,
        )
        token = created.token
        assert token.startswith("bba2a_")

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}

    health = client.get("/api/health")
    assert health.status_code == 200, health.text

    listed = client.get("/a2a/agents", headers=headers)
    assert listed.status_code == 200, listed.text
    payload = listed.json()
    agents = payload.get("agents") if isinstance(payload, dict) else payload
    assert isinstance(agents, list), payload
    print(f"GET /a2a/agents → {len(agents)} agent(s)")
    for card in agents[:3]:
        url = card.get("url") if isinstance(card, dict) else getattr(card, "url", None)
        name = card.get("name") if isinstance(card, dict) else getattr(card, "name", None)
        print(f"  - {name}: {url}")

    with Session(engine) as db:
        user = db.get(User, "admin")
        assert user is not None
        revoke_or_delete_agent_token(created.id, tenant_id="tenant_demo", db=db, current_user=user)

    denied = client.get("/a2a/agents", headers=headers)
    assert denied.status_code == 401, denied.text
    print("revoked → 401 OK")
    print("PASS")


if __name__ == "__main__":
    main()
