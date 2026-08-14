import sqlite3, json, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")
con=sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory=sqlite3.Row

print("=== recent harness_runs ===")
for r in con.execute("select id, session_id, status, started_at, finished_at, error_json from harness_runs order by rowid desc limit 5"):
    print(dict(r))

run=con.execute("select * from harness_runs order by rowid desc limit 1").fetchone()
sid=run["session_id"]
print("\nsession", sid, "run", run["id"])

print("\n=== harness_invocations ===")
for r in con.execute("select tool_name, status, substr(arguments_json,1,120) a, substr(coalesce(result_json,''),1,160) res, created_at from harness_invocations where run_id=? or session_id=? order by rowid", (run["id"], sid)):
    try:
        print(dict(r))
    except Exception:
        print(r["tool_name"], r["status"], r["a"])

# try without run_id column
cols=[c[1] for c in con.execute("pragma table_info(harness_invocations)")]
print("inv cols", cols)
