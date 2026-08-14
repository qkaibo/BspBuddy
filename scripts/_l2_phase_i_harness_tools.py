import os, sys, time, json, sqlite3
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")

from sqlmodel import Session, create_engine
from app.agents.branching import model_for_agent
from app.core.harness_agent import HarnessTaskAgent, HARNESS_FINISH_TOOL
from app.core.task_request_compiler import (
    TaskRequirement, CapabilityManifest, CapabilityDescriptor, CapabilityCatalogEntry,
)

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as session:
    m = model_for_agent(session, "tenant_demo", "agent_1979a69222264971")
assert m is not None

QUESTION = (
    "充电截止电压（float voltage，FV）在哪里配置？"
    "整机默认是多少，怎么改成 4.1V / 4.45V？请给出具体代码文件和代码片段"
)

con = sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
con.row_factory = sqlite3.Row
inv = con.execute(
    """
    select arguments_json, result_json from harness_invocations
    where tool_name='search_aosp' and status='completed'
    order by rowid desc limit 1
    """
).fetchone()
prior_args = json.loads(inv["arguments_json"] or "{}")
prior_result = inv["result_json"] or ""
if len(prior_result) > 3500:
    prior_result = prior_result[:3500] + "\n…(truncated)"

req = TaskRequirement(
    task_frame_id="l2_phase_i",
    kind="conversation",
    goal=QUESTION,
    source_user_message=QUESTION,
    requirements=["Locate FV config with code evidence"],
    completion_criteria=["Provide file path and how to change to 4.1V/4.45V"],
    prior_task_results=[{
        "tool_name": "search_aosp",
        "arguments": prior_args,
        "result_preview": prior_result,
    }],
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
                    },
                    "required": ["query"],
                },
                metadata={"provider": "mcp"},
            ),
            CapabilityDescriptor(
                capability_id="internal_search",
                name="capability_search",
                kind="internal",
                description="Search capability catalog",
                input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
            ),
            CapabilityDescriptor(
                capability_id="internal_describe",
                name="capability_describe",
                kind="internal",
                description="Describe and activate a capability",
                input_schema={"type": "object", "properties": {"name": {"type": "string"}}},
            ),
        ],
        catalog=[
            CapabilityCatalogEntry(
                capability_id="mcp_search_aosp",
                name="search_aosp",
                kind="tool",
                description="Search AOSP charging source",
            )
        ],
        catalog_total=1,
        snapshot_revision="l2",
    ),
)

invoked = []

def invoke_tool(name, args):
    invoked.append({"name": name, "arguments": args})
    if name == "search_aosp":
        return {
            "success": True,
            "data": {
                "hits": [
                    {
                        "path": "drivers/power/supply/qcom/step_chg_jeita.c",
                        "snippet": (
                            "static int step_chg_jeita_flt_uv[] = "
                            "{ 4200000, 4300000, 4400000, 4450000 }; "
                            "default float voltage 4.45V (4450mV); "
                            "change table entry for 4.1V / 4.45V"
                        ),
                    }
                ],
                "note": "Enough evidence to answer FV location and defaults.",
            },
        }
    return {"success": True, "data": {}}

agent = HarnessTaskAgent()
t0 = time.perf_counter()
result = agent.run(req, m, invoke_tool, max_actions=4)
elapsed_ms = int((time.perf_counter() - t0) * 1000)

print(json.dumps({
    "elapsed_ms": elapsed_ms,
    "status": result.status,
    "action_count": result.action_count,
    "reply_chars": len(result.reply_fragment or ""),
    "reply_preview": (result.reply_fragment or "")[:240],
    "invoked_count": len(invoked),
    "invoked_names": [x["name"] for x in invoked],
    "parallel_search_aosp": sum(1 for x in invoked if x["name"] == "search_aosp"),
    "used_finish_tool_path": result.status in {"completed", "awaiting_user", "handoff", "failed", "action_budget"},
    "error": result.error,
}, ensure_ascii=False, indent=2))
