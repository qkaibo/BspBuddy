import sys, json
sys.path.insert(0, r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")
from app.core.harness_agent import _bounded_capability_result
prod = {"success": True, "result": {"response": "Results for: **PDO**\n**#1** `amss/.../battmngrconfig_props.c` (L306-L327)"}}
b = _bounded_capability_result("search_aosp", prod)
assert b["data"] is not None, b
assert "battmngrconfig_props" in json.dumps(b["data"], ensure_ascii=False)
print("bounded_ok", json.dumps(b, ensure_ascii=False)[:200])
