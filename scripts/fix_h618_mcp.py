"""Deep debug: check router_decision + capability manifest in A2A response"""
import requests, json

BASE = "http://127.0.0.1:52020"
AGENT_ID = "agent_3f388e6d334b4cf1"

r = requests.post(f"{BASE}/api/auth/login", json={"tenant_id": "tenant_demo", "username": "admin", "password": "admin"})
token = r.json()["token"]
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

body = {"message": {"role": "user", "parts": [{"text": "用 search_aosp 查 H618 充电配置"}]}, "metadata": {}}
r2 = requests.post(f"{BASE}/a2a/agents/{AGENT_ID}/tasks?tenant_id=tenant_demo", headers=h, json=body, stream=True, timeout=120)

for line in r2.iter_lines(decode_unicode=True):
    line = line.strip()
    if not line or not line.startswith("data: "):
        continue
    try:
        d = json.loads(line[6:])
        dd = d.get("data", d)

        if dd.get("kind") == "complete":
            rd = dd.get("router_decision", {})
            print("=== ROUTER DECISION ===")
            print(json.dumps(rd, ensure_ascii=False, indent=2)[:1500])
            print()

            sr = dd.get("step_result", {})
            print("=== STEP RESULT ===")
            print(json.dumps(sr, ensure_ascii=False, indent=2)[:1500])
        elif dd.get("kind") == "stream_delta":
            print(dd.get("content", ""), end="", flush=True)
    except:
        pass
print()
