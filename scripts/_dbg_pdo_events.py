import sqlite3, json, sys
sys.stdout.reconfigure(encoding="utf-8")
con=sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory=sqlite3.Row

# find sessions mentioning PDO
rows=con.execute("""
select session_id, event_type, created_at, substr(payload_json,1,300) p
from agent_events
where payload_json like '%PDO%' or payload_json like '%HARNESS_ACTION%' or event_type like '%harness_action%'
order by rowid desc limit 40
""").fetchall()
print("matches", len(rows))
for r in rows:
    print(r["created_at"], r["session_id"], r["event_type"], r["p"].replace("\n"," ")[:280])
    print("---")
