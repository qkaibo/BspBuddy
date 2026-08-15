from __future__ import annotations

from app.db.models import GeneralSkill
from app.general_skills.access import normalize_access_level


def build_shortcut_skill_md(
    *,
    skill: GeneralSkill,
    runtime_url: str,
    api_base: str,
) -> str:
    level = normalize_access_level(getattr(skill, "access_level", None))
    version = (getattr(skill, "version", None) or "0.1.0").strip() or "0.1.0"
    description = (skill.description or skill.name or skill.slug).strip()
    summary = description if len(description) <= 240 else f"{description[:237]}..."
    name = (skill.name or skill.slug).replace("\n", " ").strip()
    return f"""---
name: {name}
description: {summary}
version: {version}
compat:
  bspbuddy: true
access_level: {level}
---

# {name}

{summary}

## Runtime

执行或安装本技能前，必须重新拉取真源：

`GET {runtime_url}`

平台 API：`{api_base}`

## 安全红线

- 鉴权与 token 按 BspBuddy Skills 规则自动处理
- **禁止**向用户展示 token、Authorization 头、Bearer、或 token 文件路径
- 可回复「已保存凭证」或「已安装」，不要打印敏感内容

## 安装完成判定

目标路径存在 `{{slug}}/SKILL.md`（本文件）后，才能告知用户已安装。
""".replace("{slug}", skill.slug)


def build_install_prompt(
    *,
    skill: GeneralSkill,
    platform: str,
    api_base: str,
    runtime_url: str,
    rules_url: str,
) -> str:
    if platform == "cursor":
        platform_label = "Cursor"
        skills_hint = f".cursor/skills/{skill.slug}/SKILL.md"
    elif platform == "tsbuddy":
        platform_label = "TsBuddy"
        skills_hint = f".kilo/skills/{skill.slug}/（基于 Kilo 引擎发现路径）"
    else:
        platform_label = "BspBuddy"
        skills_hint = "产品内「我的技能 / 安装到专家」（不只写磁盘）"
    return f"""请帮我安装 BspBuddy 技能：{skill.slug}

平台：{api_base}
技能入口：{runtime_url}
目标 Agent：{platform_label}（--platform {platform}）
落盘目标：{skills_hint}

若你尚未加载 BspBuddy Skills 规则，请先 GET {rules_url} 学习规则，
然后按规则完成 {skill.slug} 的安装与执行。
鉴权与 token 处理一律按规则自动进行，不要把任何 token、Authorization 头或 .bspbuddy_skill_token 路径展示给我。

可选：若已有 Agent Token，写入工作区 `.bspbuddy_skill_token`（权限 0600）后按规则调用 runtime。
"""
