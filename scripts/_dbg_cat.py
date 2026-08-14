import os, sys, json
sys.path.insert(0, r"D:\work\BspBuddy\backend")
os.chdir(r"D:\work\BspBuddy\backend")
sys.stdout.reconfigure(encoding="utf-8")
from sqlmodel import Session, create_engine, select
from app.db.models import ExpertModelCatalog
engine = create_engine("sqlite:///./bspbuddy.db")
with Session(engine) as s:
    r = s.exec(select(ExpertModelCatalog)).first()
    print({k: getattr(r,k) for k in ["id","model","base_url","max_output_tokens","is_default","tenant_id","api_protocol"]})
