import sqlite3, json, os

db = sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")

# 1. agent_resource_bindings for H618
h618_id = 'agent_3f388e6d334b4cf1'
bindings = db.execute(
    "SELECT resource_type, resource_id, status FROM agent_resource_bindings WHERE agent_id = ?", 
    (h618_id,)
).fetchall()
print("=== H618 agent_resource_bindings ===")
if bindings:
    for b in bindings:
        print(f"  {b[0]} -> {b[1]} ({b[2]})")
else:
    print("  (empty)")

# 2. All MCP servers
mcps = db.execute("SELECT id, name, url, enabled, discovered_tools_json FROM mcp_servers").fetchall()
print(f"\n=== mcp_servers ({len(mcps)} rows) ===")
for m in mcps:
    tools = json.loads(m[4]) if m[4] else []
    print(f"  id={m[0]} name={m[1]} url={m[3]} enabled={m[3]} tools_count={len(tools)}")

# 3. Find binding-overrides.json
user_data = os.path.expandvars(r"%APPDATA%\bspbuddy\experts\binding-overrides.json")
if os.path.exists(user_data):
    with open(user_data, 'r', encoding='utf-8') as f:
        overrides = json.load(f)
    print(f"\n=== binding-overrides.json ===")
    for aid, b in overrides.items():
        mcp = b.get("mcpServers", [])
        if mcp:
            print(f"  {aid}: mcpServers={mcp}")
else:
    print(f"\nbinding-overrides.json NOT FOUND at: {user_data}")
    # Try other locations
    alt = os.path.expandvars(r"%LOCALAPPDATA%\bspbuddy\experts\binding-overrides.json")
    if os.path.exists(alt):
        print(f"Found at: {alt}")
        with open(alt, 'r', encoding='utf-8') as f:
            overrides = json.load(f)
        for aid, b in overrides.items():
            mcp = b.get("mcpServers", [])
            if mcp:
                print(f"  {aid}: mcpServers={mcp}")

db.close()
