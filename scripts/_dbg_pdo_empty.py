import sqlite3, json, sys
sys.stdout.reconfigure(encoding="utf-8")
con=sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory=sqlite3.Row

# latest PDO-ish session
rows=con.execute("""
select session_id, created_at, substr(payload_json,1,200) p
from agent_events
where event_type='user_message_received' and payload_json like '%PDO%'
order by rowid desc limit 5
""").fetchall()
print("=== recent PDO user msgs ===")
for r in rows:
    print(r["created_at"], r["session_id"], r["p"])

sid = rows[0]["session_id"] if rows else None
print("\nfocus", sid)

print("\n=== search_aosp invocations ===")
for r in con.execute("""
select id, status, arguments_json, length(result_json) L, substr(result_json,1,500) preview, created_at
from harness_invocations
where session_id=? and tool_name='search_aosp'
order by rowid
""", (sid,)):
    print("---", r["created_at"], r["status"], "len", r["L"])
    print("args", r["arguments_json"][:200])
    print("preview", r["preview"])

print("\n=== harness_action_failed / finish ===")
for e in con.execute("""
select event_type, created_at, substr(payload_json,1,350) p
from agent_events where session_id=? and event_type in ('harness_action_failed','harness_tool_completed','harness_action_created','task_frame_finished')
order by rowid desc limit 25
""", (sid,)):
    print(e["created_at"], e["event_type"], e["p"].replace("\n"," ")[:300])
    print("---")
