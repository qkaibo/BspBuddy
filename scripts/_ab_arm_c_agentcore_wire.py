import os, sys, time, json, sqlite3
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")

from sqlmodel import Session, create_engine
from app.agents.branching import model_for_agent
from app.security.encryption import decrypt_secret
from openai import OpenAI

engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as session:
    m = model_for_agent(session, "tenant_demo", "agent_1979a69222264971")

assert m is not None, "no model resolved"
key = decrypt_secret(m.api_key_encrypted)
base = (m.base_url or "https://api.deepseek.com").rstrip("/")
model = m.model
max_tokens = m.max_output_tokens or 8192

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
args = json.loads(inv["arguments_json"] or "{}")
result = inv["result_json"] or ""
if len(result) > 3500:
    result = result[:3500] + "\n…(truncated)"

tools = [{
    "type": "function",
    "function": {
        "name": "search_aosp",
        "description": "Search AOSP / Qualcomm charging related source",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "path": {"type": "string"},
            },
            "required": ["query"],
        },
    },
}]

system = (
    "You are an Android charging expert. Use tools to find code evidence. "
    "You may call multiple tools in parallel. Prefer search_aosp."
)
user = (
    f"User question: {QUESTION}\n\n"
    f"You already called search_aosp with args={json.dumps(args, ensure_ascii=False)}\n"
    f"Tool result:\n{result}\n\n"
    "Decide the next step: call more tools or answer. Prefer tools if evidence is incomplete."
)

client = OpenAI(api_key=key, base_url=base)
t0 = time.perf_counter()
# AgentCore wire (openai_compatible.py): tools + stream + include_usage; thinking omitted
stream = client.chat.completions.create(
    model=model,
    messages=[
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
    tools=tools,
    tool_choice="auto",
    stream=True,
    stream_options={"include_usage": True},
    max_tokens=max_tokens,
    temperature=0.7,
)

content_parts = []
reasoning_parts = []
tool_acc = {}
usage = None
finish = None
for chunk in stream:
    if getattr(chunk, "usage", None):
        usage = chunk.usage
    if not chunk.choices:
        continue
    ch = chunk.choices[0]
    if ch.finish_reason:
        finish = ch.finish_reason
    delta = ch.delta
    if getattr(delta, "content", None):
        content_parts.append(delta.content)
    rc = getattr(delta, "reasoning_content", None)
    if rc:
        reasoning_parts.append(rc)
    if getattr(delta, "tool_calls", None):
        for tc in delta.tool_calls:
            idx = tc.index
            slot = tool_acc.setdefault(idx, {"id": "", "name": "", "arguments": ""})
            if tc.id:
                slot["id"] = tc.id
            if tc.function and tc.function.name:
                slot["name"] = tc.function.name
            if tc.function and tc.function.arguments:
                slot["arguments"] += tc.function.arguments

elapsed_ms = int((time.perf_counter() - t0) * 1000)
tool_calls = [tool_acc[i] for i in sorted(tool_acc)]
reasoning_text = "".join(reasoning_parts)
content_text = "".join(content_parts)

pt = getattr(usage, "prompt_tokens", None) if usage else None
ct = getattr(usage, "completion_tokens", None) if usage else None
rt = None
if usage:
    details = getattr(usage, "completion_tokens_details", None)
    if details is not None:
        rt = getattr(details, "reasoning_tokens", None)
    if rt is None:
        rt = getattr(usage, "reasoning_tokens", None)

print(json.dumps({
    "arm": "C_agentcore_wire",
    "note": "AgentCore openai_compatible wire: tools=+stream+include_usage, thinking omitted (DeepSeek default ON)",
    "model": model,
    "duration_ms": elapsed_ms,
    "finish_reason": finish,
    "prompt_tokens": pt,
    "completion_tokens": ct,
    "reasoning_tokens": rt,
    "reasoning_chars": len(reasoning_text),
    "content_chars": len(content_text),
    "n_tool_calls": len(tool_calls),
    "tool_names": [t["name"] for t in tool_calls],
    "tool_args_preview": [
        {"name": t["name"], "arguments": t["arguments"][:180]} for t in tool_calls
    ],
}, ensure_ascii=False, indent=2))
