"""Build A2A Agent Cards from BspBuddy AgentProfile + resource bindings."""

from __future__ import annotations

from sqlmodel import Session, select

from app.a2a.schema import A2AAgentCard, A2ASkill
from app.config import get_settings
from app.db.models import (
    AgentProfile,
    AgentResourceBinding,
    GeneralSkill,
    Skill,
)


def _base_url() -> str:
    settings = get_settings()
    # Prefer explicit BASE_URL; desktop bridge sets http://127.0.0.1:52020
    return (getattr(settings, "base_url", None) or "http://127.0.0.1:52020").rstrip("/")


def build_agent_cards(
    db: Session, agents: list[AgentProfile]
) -> list[A2AAgentCard]:
    """Build A2A Agent Cards for a list of agents."""
    cards: list[A2AAgentCard] = []
    base = _base_url()
    for agent in agents:
        card = build_agent_card(db, agent, base_url=base)
        cards.append(card)
    return cards


def build_agent_card(
    db: Session, agent: AgentProfile, *, base_url: str | None = None
) -> A2AAgentCard:
    """Build an A2A Agent Card from a single AgentProfile."""
    if base_url is None:
        base_url = _base_url()

    bindings = db.exec(
        select(AgentResourceBinding).where(
            AgentResourceBinding.tenant_id == agent.tenant_id,
            AgentResourceBinding.agent_id == agent.id,
            AgentResourceBinding.status == "active",
        )
    ).all()

    skills: list[A2ASkill] = []
    # Group binding resource IDs by type
    sop_ids = [b.resource_id for b in bindings if b.resource_type == "sop_skill"]
    gs_ids = [b.resource_id for b in bindings if b.resource_type == "general_skill"]

    if sop_ids:
        rows = db.exec(
            select(Skill).where(
                Skill.tenant_id == agent.tenant_id,
                Skill.skill_id.in_(sop_ids),
                Skill.status == "published",
            )
        ).all()
        for row in rows:
            skills.append(
                A2ASkill(
                    id=row.skill_id,
                    name=row.name,
                    description=row.description or row.name,
                    type="sop",
                )
            )

    if gs_ids:
        rows = db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == agent.tenant_id,
                GeneralSkill.slug.in_(gs_ids),
                GeneralSkill.status == "published",
            )
        ).all()
        for row in rows:
            skills.append(
                A2ASkill(
                    id=row.slug,
                    name=row.name,
                    description=row.description or row.name,
                    type="general_skill",
                )
            )

    return A2AAgentCard(
        name=agent.name,
        description=agent.description or agent.name,
        url=f"{base_url}/a2a/agents/{agent.id}",
        skills=skills,
    )
