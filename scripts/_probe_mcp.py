import sqlite3, json, sys, socket
from urllib.parse import urlparse
sys.stdout.reconfigure(encoding="utf-8")
con=sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory=sqlite3.Row
print("=== mcp_servers ===")
for m in con.execute("select id, name, url, transport, enabled, discovered_tools_json from mcp_servers").fetchall():
    tools=json.loads(m["discovered_tools_json"] or "[]")
    print(f"{m['id']} | {m['name']} | enabled={m['enabled']} | transport={m['transport']} | url={m['url']} | tools={len(tools)}")
    if tools[:3]:
        print("  sample tools:", [t.get("name") if isinstance(t,dict) else t for t in tools[:5]])
print("\n=== QCM4490 bindings ===")
aid="agent_1979a69222264971"
for b in con.execute("select resource_type, resource_id, status from agent_resource_bindings where agent_id=?", (aid,)).fetchall():
    print(dict(b))
print("\n=== TCP probe ===")
for m in con.execute("select name, url from mcp_servers where enabled=1").fetchall():
    u=urlparse(m["url"] or "")
    host=u.hostname; port=u.port or (443 if u.scheme=="https" else 80)
    if not host:
        print(m["name"], "bad url"); continue
    try:
        with socket.create_connection((host, int(port)), timeout=2.0):
            print(m["name"], f"{host}:{port}", "TCP OK")
    except Exception as e:
        print(m["name"], f"{host}:{port}", "TCP FAIL", type(e).__name__, e)
