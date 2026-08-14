from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.db.models import (
    GeneralSkill,
    GeneralSkillRevision,
    SkillCategory,
    User,
    UserSkillLibrary,
    utc_now,
)
from app.general_skills.access import normalize_access_level
from app.general_skills.runtime import compute_package_digest
from app.general_skills.schema import (
    GeneralSkillAuthorLeaderboardItem,
    GeneralSkillLeaderboardItem,
    GeneralSkillLeaderboardResponse,
    GeneralSkillRevisionCreate,
    GeneralSkillRevisionRead,
    GeneralSkillStoreItem,
    SkillCategoryRead,
    UserSkillLibraryItem,
)
from app.security.auth import get_current_user
from app.security.tenant import ensure_tenant

router = APIRouter(
    prefix="/api/enterprise/general-skills",
    tags=["enterprise:general-skills-store"],
    dependencies=[Depends(get_current_user)],
)

categories_router = APIRouter(
    prefix="/api/enterprise/skill-categories",
    tags=["enterprise:skill-categories"],
    dependencies=[Depends(get_current_user)],
)


def _get_skill(db: Session, tenant_id: str, slug: str) -> GeneralSkill:
    ensure_tenant(db, tenant_id)
    row = db.exec(
        select(GeneralSkill).where(GeneralSkill.tenant_id == tenant_id, GeneralSkill.slug == slug)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="General skill not found")
    if row.status == "archived":
        raise HTTPException(status_code=410, detail="General skill archived")
    return row


def _category_map(db: Session, tenant_id: str) -> dict[str, str]:
    rows = db.exec(select(SkillCategory).where(SkillCategory.tenant_id == tenant_id)).all()
    return {row.id: row.name for row in rows}


def _library_ids(db: Session, tenant_id: str, user_id: str) -> set[str]:
    rows = db.exec(
        select(UserSkillLibrary).where(
            UserSkillLibrary.tenant_id == tenant_id,
            UserSkillLibrary.user_id == user_id,
        )
    ).all()
    return {row.skill_id for row in rows}


def _author_label(user: User | None) -> str | None:
    if not user:
        return None
    name = (user.display_name or "").strip() or (user.username or "").strip()
    return name or None


def _to_store_item(
    row: GeneralSkill,
    *,
    category_name: str | None,
    in_library: bool,
    author: User | None,
    current_user_id: str,
) -> GeneralSkillStoreItem:
    author_id = getattr(row, "author_user_id", None)
    return GeneralSkillStoreItem(
        id=row.id,
        slug=row.slug,
        name=row.name,
        description=row.description,
        version=getattr(row, "version", None) or "0.1.0",
        source=getattr(row, "source", None) or "local",
        access_level=normalize_access_level(getattr(row, "access_level", None)),
        is_highlighted=bool(getattr(row, "is_highlighted", False)),
        category_id=getattr(row, "category_id", None),
        category_name=category_name,
        author_user_id=author_id,
        author_display_name=_author_label(author),
        is_mine=bool(author_id and author_id == current_user_id),
        download_count=int(getattr(row, "download_count", 0) or 0),
        invoke_count=int(getattr(row, "invoke_count", 0) or 0),
        star_count=int(getattr(row, "star_count", 0) or 0),
        status=row.status,
        updated_at=row.updated_at.isoformat(),
        in_library=in_library,
    )


@categories_router.get("", response_model=list[SkillCategoryRead])
def list_skill_categories(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
) -> list[SkillCategoryRead]:
    ensure_tenant(db, tenant_id)
    rows = db.exec(
        select(SkillCategory)
        .where(SkillCategory.tenant_id == tenant_id)
        .order_by(SkillCategory.sort_order.asc(), SkillCategory.name.asc())
    ).all()
    return [
        SkillCategoryRead(id=row.id, name=row.name, sort_order=row.sort_order) for row in rows
    ]


@router.get("/store", response_model=list[GeneralSkillStoreItem])
def list_skill_store(
    tenant_id: str = Query(...),
    q: str | None = Query(None),
    source: str | None = Query(None),
    category_id: str | None = Query(None),
    sort: str = Query("latest"),
    featured: bool = Query(False),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[GeneralSkillStoreItem]:
    ensure_tenant(db, tenant_id)
    rows = db.exec(
        select(GeneralSkill).where(
            GeneralSkill.tenant_id == tenant_id,
            GeneralSkill.status == "published",
        )
    ).all()
    cats = _category_map(db, tenant_id)
    lib = _library_ids(db, tenant_id, current_user.id)
    query = (q or "").strip().lower()
    source_filter = (source or "").strip().lower()
    items: list[GeneralSkill] = []
    for row in rows:
        if featured and not bool(getattr(row, "is_highlighted", False)):
            continue
        if category_id and getattr(row, "category_id", None) != category_id:
            continue
        row_source = (getattr(row, "source", None) or "local").lower()
        if source_filter and source_filter not in {"all", ""} and row_source != source_filter:
            continue
        if query:
            blob = f"{row.name} {row.slug} {row.description or ''}".lower()
            if query not in blob:
                continue
        items.append(row)

    sort_key = (sort or "latest").strip().lower()
    if sort_key == "downloads":
        items.sort(key=lambda r: int(getattr(r, "download_count", 0) or 0), reverse=True)
    elif sort_key == "stars":
        items.sort(key=lambda r: int(getattr(r, "star_count", 0) or 0), reverse=True)
    else:
        items.sort(key=lambda r: r.updated_at, reverse=True)

    author_ids = {
        getattr(row, "author_user_id", None)
        for row in items
        if getattr(row, "author_user_id", None)
    }
    authors: dict[str, User] = {}
    if author_ids:
        for user in db.exec(select(User).where(User.id.in_(list(author_ids)))).all():  # type: ignore[attr-defined]
            authors[user.id] = user

    return [
        _to_store_item(
            row,
            category_name=cats.get(getattr(row, "category_id", None) or ""),
            in_library=row.id in lib,
            author=authors.get(getattr(row, "author_user_id", None) or ""),
            current_user_id=current_user.id,
        )
        for row in items
    ]


@router.get("/leaderboard", response_model=GeneralSkillLeaderboardResponse)
def list_skill_leaderboard(
    tenant_id: str = Query(...),
    metric: str = Query("downloads"),
    category_id: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GeneralSkillLeaderboardResponse:
    ensure_tenant(db, tenant_id)
    key = (metric or "downloads").strip().lower()
    rows = db.exec(
        select(GeneralSkill).where(
            GeneralSkill.tenant_id == tenant_id,
            GeneralSkill.status == "published",
        )
    ).all()
    if category_id:
        rows = [row for row in rows if getattr(row, "category_id", None) == category_id]

    if key in {"author", "authors", "uploaders", "uploads"}:
        counts: dict[str, int] = {}
        for row in rows:
            author_id = getattr(row, "author_user_id", None)
            if not author_id:
                continue
            counts[author_id] = counts.get(author_id, 0) + 1
        ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[:limit]
        authors_map: dict[str, User] = {}
        if ranked:
            for user in db.exec(select(User).where(User.id.in_([uid for uid, _ in ranked]))).all():
                authors_map[user.id] = user
        author_items: list[GeneralSkillAuthorLeaderboardItem] = []
        for index, (author_id, skill_count) in enumerate(ranked, start=1):
            author = authors_map.get(author_id)
            label = _author_label(author) or author_id
            author_items.append(
                GeneralSkillAuthorLeaderboardItem(
                    rank=index,
                    author_user_id=author_id,
                    author_display_name=label,
                    skill_count=skill_count,
                    is_mine=author_id == current_user.id,
                )
            )
        return GeneralSkillLeaderboardResponse(
            metric="authors",
            kind="authors",
            items=[],
            authors=author_items,
        )

    if key in {"download", "downloads"}:
        key = "downloads"
        value_attr = "download_count"
    elif key in {"invoke", "invokes", "calls"}:
        key = "invokes"
        value_attr = "invoke_count"
    elif key in {"star", "stars"}:
        key = "stars"
        value_attr = "star_count"
    else:
        raise HTTPException(
            status_code=400,
            detail="metric must be one of: downloads, invokes, stars, authors",
        )

    rows.sort(
        key=lambda r: (
            int(getattr(r, value_attr, 0) or 0),
            r.updated_at.timestamp() if r.updated_at else 0,
        ),
        reverse=True,
    )
    rows = rows[:limit]

    cats = _category_map(db, tenant_id)
    lib = _library_ids(db, tenant_id, current_user.id)
    author_ids = {
        getattr(row, "author_user_id", None)
        for row in rows
        if getattr(row, "author_user_id", None)
    }
    authors: dict[str, User] = {}
    if author_ids:
        for user in db.exec(select(User).where(User.id.in_(list(author_ids)))).all():
            authors[user.id] = user

    items: list[GeneralSkillLeaderboardItem] = []
    for index, row in enumerate(rows, start=1):
        base = _to_store_item(
            row,
            category_name=cats.get(getattr(row, "category_id", None) or ""),
            in_library=row.id in lib,
            author=authors.get(getattr(row, "author_user_id", None) or ""),
            current_user_id=current_user.id,
        )
        metric_value = int(getattr(row, value_attr, 0) or 0)
        items.append(
            GeneralSkillLeaderboardItem(
                **base.model_dump(),
                rank=index,
                metric_value=metric_value,
            )
        )
    return GeneralSkillLeaderboardResponse(metric=key, kind="skills", items=items, authors=[])


@router.get("/library/me", response_model=list[UserSkillLibraryItem])
def list_my_skill_library(
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[UserSkillLibraryItem]:
    ensure_tenant(db, tenant_id)
    links = db.exec(
        select(UserSkillLibrary)
        .where(
            UserSkillLibrary.tenant_id == tenant_id,
            UserSkillLibrary.user_id == current_user.id,
        )
        .order_by(UserSkillLibrary.added_at.desc())
    ).all()
    if not links:
        return []
    skills = {
        row.id: row
        for row in db.exec(
            select(GeneralSkill).where(
                GeneralSkill.tenant_id == tenant_id,
                GeneralSkill.id.in_([link.skill_id for link in links]),
            )
        ).all()
    }
    result: list[UserSkillLibraryItem] = []
    for link in links:
        skill = skills.get(link.skill_id)
        if not skill:
            continue
        result.append(
            UserSkillLibraryItem(
                skill_id=skill.id,
                slug=skill.slug,
                name=skill.name,
                description=skill.description,
                version=getattr(skill, "version", None) or "0.1.0",
                access_level=normalize_access_level(getattr(skill, "access_level", None)),
                added_at=link.added_at.isoformat(),
            )
        )
    return result


@router.post("/{slug}/library", response_model=UserSkillLibraryItem)
def add_skill_to_library(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserSkillLibraryItem:
    skill = _get_skill(db, tenant_id, slug)
    if skill.status != "published":
        raise HTTPException(status_code=400, detail="Only published skills can be added")
    existing = db.exec(
        select(UserSkillLibrary).where(
            UserSkillLibrary.tenant_id == tenant_id,
            UserSkillLibrary.user_id == current_user.id,
            UserSkillLibrary.skill_id == skill.id,
        )
    ).first()
    if not existing:
        existing = UserSkillLibrary(
            tenant_id=tenant_id,
            user_id=current_user.id,
            skill_id=skill.id,
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)
    return UserSkillLibraryItem(
        skill_id=skill.id,
        slug=skill.slug,
        name=skill.name,
        description=skill.description,
        version=getattr(skill, "version", None) or "0.1.0",
        access_level=normalize_access_level(getattr(skill, "access_level", None)),
        added_at=existing.added_at.isoformat(),
    )


@router.delete("/{slug}/library")
def remove_skill_from_library(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    skill = _get_skill(db, tenant_id, slug)
    existing = db.exec(
        select(UserSkillLibrary).where(
            UserSkillLibrary.tenant_id == tenant_id,
            UserSkillLibrary.user_id == current_user.id,
            UserSkillLibrary.skill_id == skill.id,
        )
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "removed", "slug": slug}


@router.get("/{slug}/revisions", response_model=list[GeneralSkillRevisionRead])
def list_skill_revisions(
    slug: str,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
) -> list[GeneralSkillRevisionRead]:
    skill = _get_skill(db, tenant_id, slug)
    rows = db.exec(
        select(GeneralSkillRevision)
        .where(
            GeneralSkillRevision.tenant_id == tenant_id,
            GeneralSkillRevision.skill_id == skill.id,
        )
        .order_by(GeneralSkillRevision.created_at.desc())
    ).all()
    if not rows:
        # synthetic current snapshot
        return [
            GeneralSkillRevisionRead(
                id=f"current-{skill.id}",
                version=getattr(skill, "version", None) or "0.1.0",
                changelog="当前版本",
                package_digest=getattr(skill, "package_digest", None)
                or compute_package_digest(skill),
                file_size=len((skill.skill_markdown or "").encode("utf-8")),
                created_by=getattr(skill, "author_user_id", None),
                created_at=skill.updated_at.isoformat(),
            )
        ]
    return [
        GeneralSkillRevisionRead(
            id=row.id,
            version=row.version,
            changelog=row.changelog,
            package_digest=row.package_digest,
            file_size=row.file_size,
            created_by=row.created_by,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.post("/{slug}/revisions", response_model=GeneralSkillRevisionRead)
def create_skill_revision(
    slug: str,
    body: GeneralSkillRevisionCreate,
    tenant_id: str = Query(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GeneralSkillRevisionRead:
    skill = _get_skill(db, tenant_id, slug)
    version = body.version.strip()
    if not version:
        raise HTTPException(status_code=400, detail="version is required")
    existing = db.exec(
        select(GeneralSkillRevision).where(
            GeneralSkillRevision.tenant_id == tenant_id,
            GeneralSkillRevision.skill_id == skill.id,
            GeneralSkillRevision.version == version,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="version already exists")

    markdown = (body.markdown if body.markdown is not None else skill.skill_markdown) or ""
    if not markdown.strip():
        raise HTTPException(status_code=400, detail="SKILL.md content cannot be empty")

    skill.skill_markdown = markdown
    skill.version = version
    skill.package_digest = None
    skill.package_digest = compute_package_digest(skill)
    skill.updated_at = utc_now()
    if not getattr(skill, "author_user_id", None):
        skill.author_user_id = current_user.id
    db.add(skill)

    revision = GeneralSkillRevision(
        tenant_id=tenant_id,
        skill_id=skill.id,
        version=version,
        changelog=body.changelog.strip(),
        skill_markdown=markdown,
        skill_files_json=list(skill.skill_files_json or []),
        package_digest=skill.package_digest,
        file_size=len(markdown.encode("utf-8")),
        created_by=current_user.id,
    )
    db.add(revision)
    db.commit()
    db.refresh(revision)
    return GeneralSkillRevisionRead(
        id=revision.id,
        version=revision.version,
        changelog=revision.changelog,
        package_digest=revision.package_digest,
        file_size=revision.file_size,
        created_by=revision.created_by,
        created_at=revision.created_at.isoformat(),
    )
