import sqlite3

db = sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
db.row_factory = sqlite3.Row

print("=== H618 agent ===")
for r in db.execute("SELECT id, name, status FROM agent_profiles WHERE name LIKE '%H618%'"):
    print(dict(r))

print("\n=== AgentResourceBindings for H618 ===")
for r in db.execute("SELECT * FROM agent_resource_bindings WHERE agent_id LIKE '%3f388e6d334b4cf1%'"):
    print(dict(r))

print("\n=== MCP Servers ===")
for r in db.execute("SELECT id, name, url, transport, enabled FROM mcp_servers"):
    print(dict(r))

print("\n=== All resource bindings (with agent names) ===")
rows = db.execute("""
    SELECT arb.agent_id, ap.name as agent_name, arb.resource_type, arb.resource_id, arb.status
    FROM agent_resource_bindings arb
    JOIN agent_profiles ap ON ap.id = arb.agent_id
    ORDER BY ap.name
""").fetchall()
for r in rows:
    print(dict(r))
