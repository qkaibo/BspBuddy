import os, sys, time, json, re
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")

from sqlmodel import Session, create_engine
from app.agents.branching import model_for_agent
from app.core.harness_agent import (
    HarnessTaskAgent, HARNESS_FINISH_TOOL, _openai_tools_for_allowed, _to_openai_function_name,
)
from app.core.task_request_compiler import (
    TaskRequirement, CapabilityManifest, CapabilityDescriptor, CapabilityCatalogEntry,
)

# 1) sanitize unit
used=set()
n=_to_openai_function_name("general_skill.mcp-reply-citation", used)
assert re.fullmatch(r"^[a-zA-Z0-9_-]+$", n), n
print("sanitize_ok", n)

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as session:
    m = model_for_agent(session, "tenant_demo", "agent_1979a69222264971")
assert m is not None

QUESTION = "PD 的电压电流请求（PDO）在哪里配置？想要 9V / 12V 档要改什么？"

# Include dotted skill names that previously broke DeepSeek tools=
req = TaskRequirement(
    task_frame_id="selftest_pdo",
    kind="conversation",
    goal=QUESTION,
    source_user_message=QUESTION,
    requirements=["Locate PDO config with code evidence", "Explain 9V/12V change"],
    completion_criteria=["File paths + how to change 9V/12V"],
    capability_manifest=CapabilityManifest(
        available=[
            CapabilityDescriptor(
                capability_id="mcp_search_aosp",
                name="search_aosp",
                kind="tool",
                description="Search AOSP / Qualcomm charging related source",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "path": {"type": "string"},
                        "project": {"type": "string"},
                        "top_k": {"type": "integer"},
                    },
                    "required": ["query"],
                },
                metadata={"provider": "mcp", "mcp_server_id": "mcpsrv_08c3f70fb47748ee"},
            ),
            CapabilityDescriptor(
                capability_id="gs1",
                name="general_skill.mcp-reply-citation",
                kind="general_skill",
                description="citation skill",
                input_schema={"type":"object","properties":{"operation":{"type":"string"}}},
            ),
            CapabilityDescriptor(
                capability_id="gs2",
                name="general_skill.bill-field-extract",
                kind="general_skill",
                description="bill skill",
                input_schema={"type":"object","properties":{"operation":{"type":"string"}}},
            ),
            CapabilityDescriptor(
                capability_id="internal_search",
                name="capability_search",
                kind="internal",
                description="Search capability catalog",
                input_schema={"type":"object","properties":{"query":{"type":"string"}}},
            ),
            CapabilityDescriptor(
                capability_id="internal_describe",
                name="capability_describe",
                kind="internal",
                description="Describe and activate a capability",
                input_schema={"type":"object","properties":{"names":{"type":"array","items":{"type":"string"}}}},
            ),
            CapabilityDescriptor(
                capability_id="exec",
                name="exec_command",
                kind="file",
                description="exec",
                input_schema={"type":"object","properties":{"command":{"type":"string"}}},
            ),
        ],
        catalog=[
            CapabilityCatalogEntry(capability_id="mcp_search_aosp", name="search_aosp", kind="tool", description="search"),
            CapabilityCatalogEntry(capability_id="gs1", name="general_skill.mcp-reply-citation", kind="general_skill", description="cite"),
        ],
        catalog_total=2,
        snapshot_revision="selftest",
    ),
)

tools, mapping = _openai_tools_for_allowed(req, req.capability_manifest.allowed_names())
bad=[t["function"]["name"] for t in tools if not re.fullmatch(r"^[a-zA-Z0-9_-]+$", t["function"]["name"])]
print("tools_wire", [t["function"]["name"] for t in tools])
print("tools_valid", not bad, "bad", bad)

# Real MCP invoke for search_aosp; stub others
from app.db.models import MCPServer
from app.tools.mcp_client import execute_mcp_tool
invoked=[]

def invoke_tool(name, args):
    invoked.append({"name": name, "arguments": args})
    if name == "search_aosp":
        with Session(engine) as s:
            row = s.get(MCPServer, "mcpsrv_08c3f70fb47748ee")
            config = {"transport": row.transport, "url": row.url, "headers": dict(row.headers_json or {})}
        raw = execute_mcp_tool(config, args, timeout_seconds=30, tool_name="search_aosp")
        return {"success": True, "result": {"response": raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)}}
    if name == "capability_describe":
        # Activate dotted skills — this previously poisoned tools= list
        activated = []
        for d in req.capability_manifest.available:
            if d.name.startswith("general_skill."):
                activated.append(d.model_dump(mode="json"))
        return {
            "success": True,
            "data": {
                "snapshot_revision": "selftest",
                "activated_capabilities": activated,
            },
        }
    if name == "capability_search":
        return {"success": True, "data": {"matches": ["search_aosp", "general_skill.mcp-reply-citation"]}}
    if name == "exec_command":
        return {"success": False, "error": {"code": "SANDBOX_UNAVAILABLE", "message": "no bubblewrap"}}
    if name.startswith("general_skill."):
        return {"success": True, "data": {"operation": "read", "reply": "skill stub"}}
    return {"success": True, "data": {}}

t0 = time.perf_counter()
result = HarnessTaskAgent().run(req, m, invoke_tool, max_actions=6)
ms = int((time.perf_counter() - t0) * 1000)
print(json.dumps({
    "elapsed_ms": ms,
    "status": result.status,
    "action_count": result.action_count,
    "error": result.error,
    "invoked_names": [x["name"] for x in invoked],
    "reply_chars": len(result.reply_fragment or ""),
    "reply_preview": (result.reply_fragment or "")[:400],
    "has_finish_or_completed": result.status in {"completed", "awaiting_user", "handoff"},
    "no_invalid_action": (result.error or {}).get("code") != "HARNESS_ACTION_INVALID" if result.error else True,
}, ensure_ascii=False, indent=2))
