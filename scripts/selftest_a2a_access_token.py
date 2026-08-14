from sqlmodel import Session

from app.db.database import init_db, engine
from app.db.seed import seed_demo_data
from app.db.models import User
from app.api.skills_extras import (
    AgentTokenCreateRequest,
    create_agent_token,
    list_agent_tokens,
    resolve_user_from_agent_token,
    revoke_or_delete_agent_token,
)


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        user = db.get(User, "admin")
        assert user
        created = create_agent_token(
            AgentTokenCreateRequest(device_label="cursor-ide", ttl_hours=24, purpose="a2a"),
            tenant_id="tenant_demo",
            db=db,
            current_user=user,
        )
        assert created.token.startswith("bba2a_"), created.token
        assert created.purpose == "a2a"
        resolved = resolve_user_from_agent_token(db, created.token)
        assert resolved and resolved.id == "admin"
        rows = list_agent_tokens(tenant_id="tenant_demo", purpose="a2a", db=db, current_user=user)
        assert any(r.id == created.id for r in rows)
        skill = create_agent_token(
            AgentTokenCreateRequest(device_label="cursor-workspace", purpose="skill_runtime"),
            tenant_id="tenant_demo",
            db=db,
            current_user=user,
        )
        assert skill.token.startswith("bbsk_")
        a2a_only = list_agent_tokens(tenant_id="tenant_demo", purpose="a2a", db=db, current_user=user)
        assert all(r.purpose == "a2a" for r in a2a_only)
        revoke_or_delete_agent_token(created.id, tenant_id="tenant_demo", db=db, current_user=user)
        assert resolve_user_from_agent_token(db, created.token) is None
        print("OK", created.token[:12], "suffix", created.token_suffix)


if __name__ == "__main__":
    main()
