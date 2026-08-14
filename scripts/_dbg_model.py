import os, sys, json
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")
from sqlmodel import Session, create_engine, select
from app.db.models import ExpertModelCatalog
from app.agents.branching import model_for_agent
import inspect
print("sig", inspect.signature(model_for_agent))
engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as s:
    rows = s.exec(select(ExpertModelCatalog)).all()
    print("catalog", len(rows))
    for r in rows[:5]:
        print(getattr(r,"id",None), getattr(r,"model_id",None), getattr(r,"base_url",None), getattr(r,"is_default",None), getattr(r,"tenant_id",None))
    m = model_for_agent(s, "agent_1979a69222264971", "tenant_demo")
    print("model_for_agent", m)
