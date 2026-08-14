from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.capability_scope import CapabilityScope


class GeneralSkillFile(BaseModel):
    path: str
    content: str
    size: Optional[int] = None
    mime_type: Optional[str] = None


class GeneralSkillImportRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    homepage: Optional[str] = None
    markdown: Optional[str] = None
    files: list[GeneralSkillFile] = Field(default_factory=list)
    directories: Optional[list[str]] = None
    status: str = "published"
    capability_scope: Optional[CapabilityScope] = None
    original_slug: Optional[str] = None


class GeneralSkillClawHubImportRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    source: str
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    homepage: Optional[str] = None
    status: str = "published"
    capability_scope: CapabilityScope = "general"
    access_level: str = "L1"
    category_id: Optional[str] = None
    version: Optional[str] = None


class GeneralSkillPackageUploadRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    filename: str
    content_base64: str
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    homepage: Optional[str] = None
    status: str = "published"
    capability_scope: CapabilityScope = "general"
    access_level: str = "L1"
    category_id: Optional[str] = None
    version: Optional[str] = None
    source: Optional[str] = "local"
    changelog: Optional[str] = None


class GeneralSkillRead(BaseModel):
    id: str
    tenant_id: str
    slug: str
    name: str
    description: Optional[str] = None
    homepage: Optional[str] = None
    skill_markdown: str
    skill_files: list[GeneralSkillFile] = Field(default_factory=list)
    skill_directories: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: str
    capability_scope: CapabilityScope
    permissions: dict[str, Any] = Field(default_factory=dict)
    runtime_config: dict[str, Any] = Field(default_factory=dict)
    access_level: str = "L1"
    version: str = "0.1.0"
    package_digest: Optional[str] = None
    author_user_id: Optional[str] = None
    source: str = "local"
    is_highlighted: bool = False
    category_id: Optional[str] = None
    download_count: int = 0
    invoke_count: int = 0
    star_count: int = 0
    secure_content_enabled: bool = True
    allow_local_download: bool = True
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class GeneralSkillRuntimeManifestItem(BaseModel):
    path: str
    sha256: str
    size: int = 0
    download_url: str


class GeneralSkillRuntimeResponse(BaseModel):
    slug: str
    version: str
    package_digest: str
    access_level: str
    shortcut_skill_md: str
    skill_markdown: str
    manifest: list[GeneralSkillRuntimeManifestItem] = Field(default_factory=list)
    instruction_for_agent: str
    api_base_hint: Optional[str] = None
    intent: Literal["install", "invoke"] = "install"


class GeneralSkillInstallPromptResponse(BaseModel):
    platform: str
    prompt_text: str
    runtime_url: str
    rules_url: str
    slug: str
    access_level: str


class SkillAccessRequestCreate(BaseModel):
    request_type: Literal["use", "download"]
    reason: str = Field(min_length=1, max_length=500)


class SkillAccessDecideRequest(BaseModel):
    decision: Literal["approve", "reject"]
    note: Optional[str] = Field(default=None, max_length=500)


class SkillAccessGrantRead(BaseModel):
    id: str
    skill_id: str
    skill_slug: str
    grantee_user_id: str
    grant_type: str
    status: str
    reason: Optional[str] = None
    decision_note: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    created_at: str
    already_authorized: bool = False


class SkillAccessWhitelistEntry(BaseModel):
    principal_type: Literal["user"] = "user"
    principal_id: str
    grant_type: Literal["use", "download", "both"] = "both"


class SkillAccessWhitelistPutRequest(BaseModel):
    entries: list[SkillAccessWhitelistEntry] = Field(default_factory=list)


class SkillAccessWhitelistRead(BaseModel):
    skill_slug: str
    entries: list[SkillAccessWhitelistEntry] = Field(default_factory=list)


class SkillCategoryRead(BaseModel):
    id: str
    name: str
    sort_order: int = 0


class GeneralSkillStoreItem(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    version: str = "0.1.0"
    source: str = "local"
    access_level: str = "L1"
    is_highlighted: bool = False
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    author_user_id: Optional[str] = None
    author_display_name: Optional[str] = None
    is_mine: bool = False
    download_count: int = 0
    invoke_count: int = 0
    star_count: int = 0
    status: str = "published"
    updated_at: str
    in_library: bool = False


class GeneralSkillLeaderboardItem(GeneralSkillStoreItem):
    rank: int
    metric_value: int


class GeneralSkillAuthorLeaderboardItem(BaseModel):
    rank: int
    author_user_id: Optional[str] = None
    author_display_name: str
    skill_count: int
    is_mine: bool = False


class GeneralSkillLeaderboardResponse(BaseModel):
    metric: str
    kind: Literal["skills", "authors"] = "skills"
    items: list[GeneralSkillLeaderboardItem] = Field(default_factory=list)
    authors: list[GeneralSkillAuthorLeaderboardItem] = Field(default_factory=list)


class GeneralSkillRevisionRead(BaseModel):
    id: str
    version: str
    changelog: Optional[str] = None
    package_digest: Optional[str] = None
    file_size: int = 0
    created_by: Optional[str] = None
    created_at: str


class GeneralSkillRevisionCreate(BaseModel):
    version: str = Field(min_length=1, max_length=64)
    changelog: str = Field(min_length=1, max_length=2000)
    markdown: Optional[str] = None


class UserSkillLibraryItem(BaseModel):
    skill_id: str
    slug: str
    name: str
    description: Optional[str] = None
    version: str = "0.1.0"
    access_level: str = "L1"
    added_at: str


class GeneralSkillRunRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    user_id: str = ""
    query: str
    operation: Literal["read", "execute"] = "execute"
    session_id: Optional[str] = None
    model_config_id: Optional[str] = None
    max_attempts: int = Field(default=10, ge=1, le=10)


class GeneralSkillRunResponse(BaseModel):
    skill_slug: str
    operation: Literal["read", "execute"] = "execute"
    execution_trace: list[dict[str, Any]] = Field(default_factory=list)
    generated_code: str = ""
    stdout: str = ""
    stderr: str = ""
    structured_result: dict[str, Any] = Field(default_factory=dict)
    reply: str


class GeneralSkillSelection(BaseModel):
    use_general_skill: bool = False
    selected_slug: Optional[str] = None
    operation: Literal["read", "execute"] = "execute"
    use_knowledge: bool = False
    knowledge_query: Optional[str] = None
    confidence: float = 0.0
    reason: Optional[str] = None


class GeneralSkillExecutionPlan(BaseModel):
    code: str
    runtime: str = "python"
    rationale: Optional[str] = None
    expected_output: Optional[str] = None


class GeneralSkillExecutionReview(BaseModel):
    result_sufficient: bool = False
    needs_retry: bool = False
    terminal: bool = False
    reason: str = ""
    repair_hint: Optional[str] = None


class GeneralSkillReply(BaseModel):
    reply: str
