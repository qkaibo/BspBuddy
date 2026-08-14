from __future__ import annotations

import hashlib

from sqlmodel import Session, select

from app.db.models import PolicyBinding, PolicyRule, PolicyRulePack
from app.policy.schema import KIND_RANK, ResolvedPack, ResolvedPolicy, ResolvedRule, content_hash


def resolve_policy(
    db: Session,
    *,
    tenant_id: str,
    project_key: str | None = None,
    mode: str | None = None,
    expert_id: str | None = None,
) -> ResolvedPolicy:
    bindings = db.exec(
        select(PolicyBinding).where(
            PolicyBinding.tenant_id == tenant_id,
            PolicyBinding.enabled == True,  # noqa: E712
        )
    ).all()

    selected: list[tuple[PolicyBinding, PolicyRulePack]] = []
    for binding in bindings:
        pack = db.get(PolicyRulePack, binding.pack_id)
        if not pack or pack.tenant_id != tenant_id:
            continue
        if binding.target_type == "tenant":
            selected.append((binding, pack))
            continue
        if binding.target_type == "project" and project_key and binding.target_key == project_key:
            selected.append((binding, pack))
            continue
        if binding.target_type == "mode" and mode and binding.target_key == mode:
            selected.append((binding, pack))
            continue
        if binding.target_type == "expert" and expert_id and binding.target_key == expert_id:
            selected.append((binding, pack))
            continue

    selected.sort(
        key=lambda item: (
            KIND_RANK.get(item[1].kind, 50),
            item[0].priority,
            item[1].slug,
        )
    )

    packs_out: list[ResolvedPack] = []
    rules_by_slug: dict[str, ResolvedRule] = {}
    version_parts: list[str] = []

    for _binding, pack in selected:
        packs_out.append(
            ResolvedPack(
                id=pack.id,
                slug=pack.slug,
                name=pack.name,
                kind=pack.kind,
                version=pack.version,
            )
        )
        version_parts.append(f"{pack.slug}@{pack.version}")
        for rule_id in pack.rule_ids_json or []:
            rule = db.get(PolicyRule, rule_id)
            if not rule or rule.tenant_id != tenant_id:
                continue
            if rule.status != "published":
                continue
            ch = rule.content_hash or content_hash(rule.body_md)
            rules_by_slug[rule.slug] = ResolvedRule(
                id=rule.id,
                slug=rule.slug,
                title=rule.title,
                body_md=rule.body_md,
                severity=rule.severity,
                content_hash=ch,
                source_pack_slug=pack.slug,
                source_kind=pack.kind,
            )
            version_parts.append(f"{rule.slug}:{ch}")

    digest = hashlib.sha256("|".join(version_parts).encode("utf-8")).hexdigest()[:24]
    return ResolvedPolicy(
        tenant_id=tenant_id,
        project_key=project_key or None,
        mode=mode or None,
        expert_id=expert_id or None,
        policy_version=f"sha256:{digest}",
        packs=packs_out,
        rules=list(rules_by_slug.values()),
    )
