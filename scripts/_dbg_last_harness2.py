import sqlite3, json, sys
sys.stdout.reconfigure(encoding="utf-8")
con=sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory=sqlite3.Row
print("harness_runs cols", [c[1] for c in con.execute("pragma table_info(harness_runs)")])
print("inv cols", [c[1] for c in con.execute("pragma table_info(harness_invocations)")])
print("events sample types")
print([r[0] for r in con.execute("select distinct event_type from agent_events order by 1").fetchall()][:40])

print("\n=== recent runs ===")
for r in con.execute("select * from harness_runs order by rowid desc limit 3"):
    print({k:r[k] for k in r.keys() if k!='payload_json'})

run=con.execute("select * from harness_runs order by rowid desc limit 1").fetchone()
sid=run["session_id"]
print("\nfocus session", sid)

print("\n=== invocations last 20 for session ===")
# discover session column
cols=[c[1] for c in con.execute("pragma table_info(harness_invocations)")]
q="select * from harness_invocations order by rowid desc limit 20"
for r in con.execute(q):
    d={k:r[k] for k in r.keys()}
    if d.get("session_id") and d.get("session_id")!=sid:
        # still print recent
        pass
    print({k: (str(d[k])[:180] if d[k] is not None else None) for k in ("id","session_id","tool_name","status","arguments_json","result_json","created_at","started_at","finished_at") if k in d})

print("\n=== agent_events last related ===")
for e in con.execute("select event_type, created_at, substr(payload_json,1,400) p from agent_events where session_id=? order by rowid desc limit 30", (sid,)):
    print(e["created_at"], e["event_type"], e["p"])
