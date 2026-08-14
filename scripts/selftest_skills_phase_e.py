"""Phase E selftest: lightweight skill leaderboard."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine, init_db
from app.db.models import User
from app.db.seed import seed_demo_data
from app.main import app
from app.security.auth import create_access_token


def main() -> None:
    init_db()
    with Session(engine) as db:
        seed_demo_data(db)
        admin = db.exec(select(User).where(User.username == "admin")).first()
        assert admin is not None
        token = create_access_token(admin)

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}
    params = {"tenant_id": "tenant_demo"}

    for metric in ("downloads", "invokes", "stars"):
        res = client.get(
            "/api/enterprise/general-skills/leaderboard",
            params={**params, "metric": metric, "limit": 10},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body.get("metric") == metric
        assert body.get("kind") == "skills"
        items = body.get("items") or []
        assert len(items) >= 3, f"{metric}: expected >=3, got {len(items)}"
        ranks = [row["rank"] for row in items]
        assert ranks == list(range(1, len(items) + 1)), ranks
        values = [int(row["metric_value"]) for row in items]
        assert values == sorted(values, reverse=True), values
        assert all("slug" in row and "name" in row for row in items)
        print(f"ok metric={metric} top={items[0]['slug']} value={items[0]['metric_value']}")

    authors_res = client.get(
        "/api/enterprise/general-skills/leaderboard",
        params={**params, "metric": "authors", "limit": 10},
        headers=headers,
    )
    assert authors_res.status_code == 200, authors_res.text
    authors_body = authors_res.json()
    assert authors_body.get("metric") == "authors"
    assert authors_body.get("kind") == "authors"
    authors = authors_body.get("authors") or []
    assert len(authors) >= 2, f"authors: expected >=2, got {len(authors)}"
    assert authors[0]["rank"] == 1
    counts = [int(row["skill_count"]) for row in authors]
    assert counts == sorted(counts, reverse=True), counts
    assert all(row.get("author_display_name") for row in authors)
    print(f"ok metric=authors top={authors[0]['author_display_name']} count={authors[0]['skill_count']}")

    bad = client.get(
        "/api/enterprise/general-skills/leaderboard",
        params={**params, "metric": "coins"},
        headers=headers,
    )
    assert bad.status_code == 400, bad.text
    print("ok invalid metric rejected")
    print("phase_e_ok")


if __name__ == "__main__":
    main()
