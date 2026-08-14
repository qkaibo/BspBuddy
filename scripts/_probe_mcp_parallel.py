import os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")
from sqlmodel import Session, create_engine
from app.db.models import MCPServer
from app.tools.mcp_client import execute_mcp_tool

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as s:
    row = s.get(MCPServer, "mcpsrv_08c3f70fb47748ee")
    config = {"transport": row.transport, "url": row.url, "headers": dict(row.headers_json or {})}

queries = [
    "float voltage FV",
    "StepChgFltVmV 4450",
    "qcom,float-voltage",
    "POWER_SUPPLY_PROP_VOLTAGE_MAX",
]

def one(q):
    t0=time.perf_counter()
    try:
        r = execute_mcp_tool(config, {"query": q, "path": "qcm4490"}, timeout_seconds=30, tool_name="search_aosp")
        return q, "ok", int((time.perf_counter()-t0)*1000), str(r)[:80]
    except Exception as e:
        return q, "fail", int((time.perf_counter()-t0)*1000), f"{type(e).__name__}: {e}"

print("=== serial ===")
for q in queries:
    print(one(q))

print("=== parallel 4 ===")
t0=time.perf_counter()
with ThreadPoolExecutor(4) as pool:
    futs=[pool.submit(one,q) for q in queries]
    for f in as_completed(futs):
        print(f.result())
print("wall", int((time.perf_counter()-t0)*1000))
