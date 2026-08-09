import sqlite3

db = sqlite3.connect(r"D:\work\BspBuddy\backend\bspbuddy.db")
db.row_factory = sqlite3.Row

print("=== model_configs columns ===")
print([r[1] for r in db.execute("PRAGMA table_info(model_configs)")])
print()
print("=== model_configs ===")
cols = [r[1] for r in db.execute("PRAGMA table_info(model_configs)")]
for r in db.execute("SELECT * FROM model_configs"):
    d = dict(r)
    if "api_key_encrypted" in d and d["api_key_encrypted"]:
        d["api_key_encrypted"] = str(d["api_key_encrypted"])[:20] + "..."
    print(d)

print()
print("=== expert_model_catalogs api_key ===")
for r in db.execute("SELECT id, name, api_key_encrypted FROM expert_model_catalogs"):
    d = dict(r)
    d["api_key_encrypted"] = (d["api_key_encrypted"] or "")
    print({**d, "len": len(d["api_key_encrypted"]), "prefix": d["api_key_encrypted"][:12]})
