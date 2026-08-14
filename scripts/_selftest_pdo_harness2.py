import os, sys, time, json, re
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")

from sqlmodel import Session, create_engine
from app.agents.branching import model_for_agent
from app.core.harness_agent import HarnessTaskAgent
from app.core.task_request_compiler import (
    TaskRequirement, CapabilityManifest, CapabilityDescriptor, CapabilityCatalogEntry,
)
from app.db.models import MCPServer
from app.tools.mcp_client import execute_mcp_tool

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as session:
    m = model_for_agent(session, "tenant_demo", "agent_1979a69222264971")

QUESTION = "PD 的电压电流请求（PDO）在哪里配置？想要 9V / 12V 档要改什么？"
req = TaskRequirement(
    task_frame_id="selftest_pdo2",
    kind="conversation",
    goal=QUESTION,
    source_user_message=QUESTION,
    requirements=["Locate PDO config", "9V/12V change"],
    completion_criteria=["code evidence"],
    capability_manifest=CapabilityManifest(
        available=[
            CapabilityDescriptor(
                capability_id="mcp_search_aosp", name="search_aosp", kind="tool",
                description="Search AOSP charging/PD source",
                input_schema={"type":"object","properties":{"query":{"type":"string"},"project":{"type":"string"},"top_k":{"type":"integer"}},"required":["query"]},
                metadata={"provider":"mcp","mcp_server_id":"mcpsrv_08c3f70fb47748ee"},
            ),
            CapabilityDescriptor(
                capability_id="gs1", name="general_skill.mcp-reply-citation", kind="general_skill",
                description="citation", input_schema={"type":"object","properties":{"operation":{"type":"string"}}},
            ),
            CapabilityDescriptor(
                capability_id="cap_s", name="capability_search", kind="internal",
                description="search caps", input_schema={"type":"object","properties":{"query":{"type":"string"}}},
            ),
            CapabilityDescriptor(
                capability_id="cap_d", name="capability_describe", kind="internal",
                description="describe caps",
                input_schema={"type":"object","properties":{"names":{"type":"array","items":{"type":"string"}}}},
            ),
        ],
        catalog=[CapabilityCatalogEntry(capability_id="mcp_search_aosp", name="search_aosp", kind="tool", description="search")],
        catalog_total=1,
        snapshot_revision="selftest2",
    ),
)

invoked=[]
def invoke_tool(name, args):
    invoked.append(name)
    if name == "search_aosp":
        with Session(engine) as s:
            row = s.get(MCPServer, "mcpsrv_08c3f70fb47748ee")
            config={"transport":row.transport,"url":row.url,"headers":dict(row.headers_json or {})}
        raw = execute_mcp_tool(config, args, timeout_seconds=30, tool_name="search_aosp")
        text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
        # Match production-ish shape used by bounded results / model
        return {"success": True, "data": {"response": text[:8000]}, "result": {"response": text[:8000]}}
    if name == "capability_describe":
        activated=[d.model_dump(mode="json") for d in req.capability_manifest.available if d.name.startswith("general_skill.")]
        return {"success": True, "data": {"snapshot_revision":"selftest2", "activated_capabilities": activated}}
    if name == "capability_search":
        return {"success": True, "data": {"matches":["search_aosp","general_skill.mcp-reply-citation"]}}
    if name.startswith("general_skill."):
        return {"success": True, "data": {"operation":"read","reply":"ok"}}
    return {"success": True, "data": {}}

t0=time.perf_counter()
r=HarnessTaskAgent().run(req, m, invoke_tool, max_actions=5)
ms=int((time.perf_counter()-t0)*1000)
print(json.dumps({
  "elapsed_ms": ms,
  "status": r.status,
  "action_count": r.action_count,
  "error": r.error,
  "invoked": invoked,
  "reply_chars": len(r.reply_fragment or ""),
  "reply_preview": (r.reply_fragment or "")[:500],
  "no_HARNESS_ACTION_INVALID": (r.error or {}).get("code") != "HARNESS_ACTION_INVALID" if r.error else True,
}, ensure_ascii=False, indent=2))
