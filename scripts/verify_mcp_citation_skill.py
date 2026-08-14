"""L2: seed mcp-reply-citation skill and verify H618 binding."""
from __future__ import annotations

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
# Match Electron FastAPIBridge DB (not empty default skill_agent_loop.db)
import os

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{(ROOT / 'backend' / 'bspbuddy.db').as_posix()}",
)
sys.path.insert(0, str(ROOT / "backend"))

from sqlmodel import Session, select  # noqa: E402

from app.db.database import engine  # noqa: E402
from app.agents.branching import is_open_gallery_resource  # noqa: E402
from app.db.models import AgentProfile, AgentResourceBinding, GeneralSkill  # noqa: E402
from app.db.seed import _seed_mcp_reply_citation_skill  # noqa: E402


def main() -> int:
    print("DB:", engine.url)
    with Session(engine) as session:
        _seed_mcp_reply_citation_skill(session)
        session.commit()

        skill = session.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == "tenant_demo",
                GeneralSkill.slug == "mcp-reply-citation",
            )
        ).first()
        if not skill:
            print("FAIL: skill mcp-reply-citation not found")
            return 1
        print(f"OK skill id={skill.id} status={skill.status}")
        print(f"   markdown_len={len(skill.skill_markdown or '')}")

        if not is_open_gallery_resource(session, "tenant_demo", "general_skill", skill):
            print("FAIL: skill not in open gallery (SkillsPanel will hide it)")
            return 1
        print("OK open_gallery visible")

        h618 = session.exec(
            select(AgentProfile).where(
                AgentProfile.tenant_id == "tenant_demo",
                AgentProfile.name.like("%H618%"),
            )
        ).first()
        if not h618:
            print("FAIL: H618 agent not found")
            return 1
        print(f"OK agent id={h618.id} name={h618.name}")

        binding = session.exec(
            select(AgentResourceBinding).where(
                AgentResourceBinding.tenant_id == "tenant_demo",
                AgentResourceBinding.agent_id == h618.id,
                AgentResourceBinding.resource_type == "general_skill",
                AgentResourceBinding.resource_id == skill.id,
                AgentResourceBinding.status == "active",
            )
        ).first()
        if not binding:
            print("FAIL: H618 missing general_skill binding for mcp-reply-citation")
            return 1
        print(f"OK binding id={binding.id}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
