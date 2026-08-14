"""Measure one local expert A2A turn latency."""
from __future__ import annotations

import json
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://127.0.0.1:52020"
# Prefer H618 (has MCP); fall back to QCM4490 if needed
CANDIDATES = [
    ("H618", "agent_3f388e6d334b4cf1"),
    ("QCM4490", "agent_1979aamp22264971"),
]
MESSAGE = "简单介绍一下你自己，一句话即可"


def login() -> str:
    t0 = time.perf_counter()
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"tenant_id": "tenant_demo", "username": "admin", "password": "admin"},
        timeout=30,
    )
    r.raise_for_status()
    token = r.json()["token"]
    print(f"login: {(time.perf_counter() - t0) * 1000:.0f} ms")
    return token


def measure(agent_name: str, agent_id: str, token: str) -> None:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {
        "message": {"role": "user", "parts": [{"text": MESSAGE}]},
        "metadata": {},
    }
    url = f"{BASE}/a2a/agents/{agent_id}/tasks?tenant_id=tenant_demo"
    print(f"\n=== {agent_name} ({agent_id}) ===")
    print(f"message: {MESSAGE}")

    t_start = time.perf_counter()
    t_first = None
    t_complete = None
    reply = ""
    events = 0

    with requests.post(url, headers=headers, json=body, stream=True, timeout=600) as res:
        print(f"http status: {res.status_code}  ttfb: {(time.perf_counter() - t_start) * 1000:.0f} ms")
        res.raise_for_status()
        for raw in res.iter_lines(decode_unicode=True):
            line = (raw or "").strip()
            if not line:
                continue
            if t_first is None:
                t_first = time.perf_counter()
                print(f"first SSE byte: {(t_first - t_start) * 1000:.0f} ms")
            if not line.startswith("data: "):
                continue
            events += 1
            try:
                payload = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            data = payload.get("data", payload)
            kind = data.get("kind") or payload.get("type")
            if kind == "stream_delta" and data.get("content"):
                reply += data["content"]
            elif kind == "complete":
                if data.get("reply"):
                    reply = data["reply"]
                t_complete = time.perf_counter()
                break
            elif payload.get("type") == "final":
                if t_complete is None:
                    t_complete = time.perf_counter()
                break

    t_end = time.perf_counter()
    total_ms = (t_end - t_start) * 1000
    first_ms = ((t_first - t_start) * 1000) if t_first else None
    complete_ms = ((t_complete - t_start) * 1000) if t_complete else total_ms

    print(f"SSE events parsed: {events}")
    print(f"time to first SSE: {first_ms:.0f} ms" if first_ms is not None else "time to first SSE: n/a")
    print(f"time to complete:  {complete_ms:.0f} ms")
    print(f"total wall time:   {total_ms:.0f} ms ({total_ms / 1000:.1f} s)")
    preview = (reply or "").replace("\n", " ")[:200]
    print(f"reply preview: {preview or '(empty)'}")


def main() -> int:
    try:
        token = login()
    except Exception as exc:
        print(f"FAIL login: {exc}")
        return 1

    # simple ping health
    try:
        h = requests.get(f"{BASE}/api/health", timeout=5)
        print(f"health: {h.status_code} {h.text[:80]}")
    except Exception as exc:
        print(f"health fail: {exc}")
        return 1

    # Use first candidate; if 404 try next
    for name, agent_id in CANDIDATES:
        try:
            measure(name, agent_id, token)
            return 0
        except requests.HTTPError as exc:
            print(f"{name} failed: {exc}")
            continue
        except Exception as exc:
            print(f"{name} error: {exc}")
            return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
