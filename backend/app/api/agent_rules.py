from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.db.models import User
from app.paths import app_root
from app.security.auth import get_optional_user

router = APIRouter(
    prefix="/api/enterprise/agent-rules",
    tags=["enterprise:agent-rules"],
)

_RULES_DIR = app_root() / "skills" / "agent-rules"


def _read_rule(name: str) -> str:
    path = _RULES_DIR / name
    if not path.is_file():
        return f"# missing rule file: {name}\n"
    return path.read_text(encoding="utf-8")


@router.get("/bspbuddy-skills.mdc", response_class=PlainTextResponse)
def get_bspbuddy_skills_rule(
    current_user: User | None = Depends(get_optional_user),
) -> PlainTextResponse:
    if current_user is None:
        body = _read_rule("bspbuddy-skills.bootstrap.mdc")
    else:
        body = _read_rule("bspbuddy-skills.mdc")
    return PlainTextResponse(content=body, media_type="text/markdown; charset=utf-8")
