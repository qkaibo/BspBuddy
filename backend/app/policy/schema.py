from __future__ import annotations

import hashlib
from typing import Literal, Optional

from pydantic import BaseModel, Field


PolicyKind = Literal["org_baseline", "project", "mode", "expert"]
TargetType = Literal["tenant", "project", "mode", "expert"]


class PolicyRuleCreate(BaseModel):
    slug: str
    title: str
    body_md: str
    severity: str = "required"
    status: str = "published"


class PolicyRuleRead(BaseModel):
    id: str
    tenant_id: str
    slug: str
    title: str
    body_md: str
    severity: str
    status: str
    content_hash: str
    updated_at: str


class PolicyPackCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    kind: PolicyKind = "project"
    rule_slugs: list[str] = Field(default_factory=list)
    rule_ids: list[str] = Field(default_factory=list)
    version: str = "1.0.0"


class PolicyPackRead(BaseModel):
    id: str
    tenant_id: str
    slug: str
    name: str
    description: Optional[str] = None
    kind: str
    rule_ids: list[str] = Field(default_factory=list)
    version: str
    updated_at: str


class PolicyBindingCreate(BaseModel):
    pack_id: Optional[str] = None
    pack_slug: Optional[str] = None
    target_type: TargetType
    target_key: str = ""
    priority: int = 0
    enabled: bool = True


class PolicyBindingRead(BaseModel):
    id: str
    tenant_id: str
    pack_id: str
    pack_slug: Optional[str] = None
    target_type: str
    target_key: str
    priority: int
    enabled: bool
    updated_at: str


class ResolvedPack(BaseModel):
    id: str
    slug: str
    name: str
    kind: str
    version: str


class ResolvedRule(BaseModel):
    id: str
    slug: str
    title: str
    body_md: str
    severity: str
    content_hash: str
    source_pack_slug: str
    source_kind: str


class ResolvedPolicy(BaseModel):
    tenant_id: str
    project_key: Optional[str] = None
    mode: Optional[str] = None
    expert_id: Optional[str] = None
    policy_version: str
    packs: list[ResolvedPack] = Field(default_factory=list)
    rules: list[ResolvedRule] = Field(default_factory=list)


def content_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]


KIND_RANK = {
    "org_baseline": 10,
    "project": 20,
    "mode": 30,
    "expert": 40,
}
