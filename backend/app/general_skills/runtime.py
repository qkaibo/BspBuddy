from __future__ import annotations

import hashlib
import json
from typing import Any, Literal
from urllib.parse import quote

from app.db.models import GeneralSkill
from app.general_skills.access import normalize_access_level
from app.general_skills.shortcut import build_install_prompt, build_shortcut_skill_md

RuntimeIntent = Literal["install", "invoke"]


def compute_package_digest(skill: GeneralSkill) -> str:
    existing = getattr(skill, "package_digest", None)
    if isinstance(existing, str) and existing.strip():
        return existing.strip()
    payload = {
        "slug": skill.slug,
        "version": getattr(skill, "version", None) or "0.1.0",
        "markdown": skill.skill_markdown or "",
        "files": skill.skill_files_json or [],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"sha256:{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"


def _skill_files(skill: GeneralSkill) -> list[dict[str, Any]]:
    files = skill.skill_files_json or []
    if files:
        return [item for item in files if isinstance(item, dict) and item.get("path")]
    markdown = skill.skill_markdown or ""
    return [
        {
            "path": "SKILL.md",
            "content": markdown,
            "size": len(markdown.encode("utf-8")),
            "mime_type": "text/markdown",
        }
    ]


def build_manifest(
    *,
    skill: GeneralSkill,
    api_base: str,
) -> list[dict[str, Any]]:
    base = api_base.rstrip("/")
    items: list[dict[str, Any]] = []
    for item in _skill_files(skill):
        path = str(item.get("path") or "").lstrip("/")
        if not path or ".." in path.split("/"):
            continue
        content = item.get("content")
        if isinstance(content, str):
            digest = f"sha256:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"
            size = int(item.get("size") or len(content.encode("utf-8")))
        else:
            digest = compute_package_digest(skill)
            size = int(item.get("size") or 0)
        items.append(
            {
                "path": path,
                "sha256": digest,
                "size": size,
                "download_url": (
                    f"{base}/api/enterprise/general-skills/{skill.slug}/files/"
                    f"{quote(path, safe='')}"
                ),
            }
        )
    return items


def resolve_skill_body(*, skill: GeneralSkill, include_full: bool) -> str:
    if include_full:
        return skill.skill_markdown or ""
    description = (skill.description or skill.name or skill.slug).strip()
    return (
        f"# {skill.name or skill.slug}\n\n"
        f"{description}\n\n"
        "（受控正文：当前账号无完整 SKILL.md 阅读权限）\n"
    )


def build_runtime_payload(
    *,
    skill: GeneralSkill,
    intent: RuntimeIntent,
    api_base: str,
    include_full_body: bool,
) -> dict[str, Any]:
    base = api_base.rstrip("/")
    runtime_url = f"{base}/api/enterprise/general-skills/{skill.slug}/runtime"
    digest = compute_package_digest(skill)
    shortcut = build_shortcut_skill_md(
        skill=skill, runtime_url=runtime_url, api_base=base
    )
    body = resolve_skill_body(skill=skill, include_full=include_full_body)
    return {
        "slug": skill.slug,
        "version": getattr(skill, "version", None) or "0.1.0",
        "package_digest": digest,
        "access_level": normalize_access_level(getattr(skill, "access_level", None)),
        "shortcut_skill_md": shortcut,
        "skill_markdown": body if intent == "invoke" or include_full_body else shortcut,
        "manifest": build_manifest(skill=skill, api_base=base) if include_full_body else [],
        "instruction_for_agent": (
            "执行前必须重新 GET runtime；禁止向用户展示 token 或 Authorization。"
        ),
        "api_base_hint": None,
        "intent": intent,
    }


def build_install_prompt_payload(
    *,
    skill: GeneralSkill,
    platform: str,
    api_base: str,
) -> dict[str, Any]:
    base = api_base.rstrip("/")
    normalized = platform.strip().lower() or "cursor"
    if normalized not in {"cursor", "bspbuddy", "tsbuddy"}:
        normalized = "cursor"
    runtime_url = f"{base}/api/enterprise/general-skills/{skill.slug}/runtime"
    rules_url = f"{base}/api/enterprise/agent-rules/bspbuddy-skills.mdc"
    return {
        "platform": normalized,
        "prompt_text": build_install_prompt(
            skill=skill,
            platform=normalized,
            api_base=base,
            runtime_url=runtime_url,
            rules_url=rules_url,
        ),
        "runtime_url": runtime_url,
        "rules_url": rules_url,
        "slug": skill.slug,
        "access_level": normalize_access_level(getattr(skill, "access_level", None)),
    }


def find_skill_file(skill: GeneralSkill, path: str) -> dict[str, Any] | None:
    cleaned = path.lstrip("/").replace("\\", "/")
    if not cleaned or ".." in cleaned.split("/"):
        return None
    for item in _skill_files(skill):
        item_path = str(item.get("path") or "").lstrip("/")
        if item_path == cleaned:
            return item
    return None
