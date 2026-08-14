import os, sys, time, json
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")
from sqlmodel import Session, create_engine, select
from app.db.models import MCPServer
from app.tools.mcp_client import execute_mcp_tool, list_mcp_tools

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as s:
    row = s.get(MCPServer, "mcpsrv_08c3f70fb47748ee")
    print("name", row.name, "url", row.url, "transport", row.transport)
    config = {
        "transport": row.transport,
        "url": row.url,
        "command": getattr(row, "command", None),
        "args": getattr(row, "args_json", None) or [],
        "env": getattr(row, "env_json", None) or {},
        "headers": getattr(row, "headers_json", None) or {},
    }
    # peek how execute_mcp_tool expects config
print("probing list_tools...")
t0=time.perf_counter()
try:
    tools = list_mcp_tools(config, timeout_seconds=15)
    print("list_ok", int((time.perf_counter()-t0)*1000), "ms", [getattr(t,"name",t) if not isinstance(t,dict) else t.get("name") for t in tools[:10]])
except Exception as e:
    print("list_fail", int((time.perf_counter()-t0)*1000), "ms", type(e).__name__, e)

print("probing search_aosp timeout=60...")
t0=time.perf_counter()
try:
    # inspect signature
    import inspect
    from app.tools import mcp_client as mc
    print("sig", inspect.signature(mc.execute_mcp_tool))
    r = execute_mcp_tool(config, {"query": "float voltage FV StepChgFltVmV", "path": "qcm4490"}, timeout_seconds=60, tool_name="search_aosp")
    print("call_ok", int((time.perf_counter()-t0)*1000), "ms")
    preview = json.dumps(r, ensure_ascii=False, default=str)[:500]
    print(preview)
except Exception as e:
    print("call_fail", int((time.perf_counter()-t0)*1000), "ms", type(e).__name__, e)
