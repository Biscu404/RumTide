import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
st = json.load(open(sys.argv[1])); out = sys.argv[2]; n = int(sys.argv[3])
c = tune.config(st, 1); tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"])
styles = ["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand"]
pairs = [(a, b) for a in styles for b in styles if a == "Boarder" or b == "Boarder" or a == "Firebrand" or b == "Firebrand"]
jobs = [{"me": a, "foe": b, "scene": s, "set": c["set"], "templates": tpl, "n": n, "ks": [3, 4, 5, 6, 7], "grappledOnly": True} for a, b in pairs for s in ["open/breeze", "reef"]]
def run(j):
    p = subprocess.run(["node", "tools/proto/situations.ts", json.dumps(j)], capture_output=True, text=True, env=dict(os.environ, LADDER="6"))
    if p.returncode: return {"error": p.stderr[-500:], "me": j["me"], "foe": j["foe"]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res = list(ex.map(run, jobs))
json.dump(res, open(out, "w"))
orders = {}
for r in res:
    if "error" in r: print("ERR", r); continue
    for row in r["rows"]:
        if row.get("matters") and row["clearOrder"]: orders.setdefault(row["clearOrder"], []).append(f'{r["me"]}/{r["foe"]}/{r["scene"]}/r{row["k"]}')
print("Grappled situations, orders clearly best:", {k: len(v) for k, v in orders.items()})
for k in ("charge", "volley", "repel", "firePots"): print(k, orders.get(k, [])[:6])
