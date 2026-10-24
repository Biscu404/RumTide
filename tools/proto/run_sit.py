import json, os, subprocess, sys, itertools
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
from wheel import FIGHT
st = json.load(open(sys.argv[1])); out = sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 40
scenes = ["open/breeze", "reef", "fog"]
c = tune.config(st, 1); tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"])
jobs = [{"me": a, "foe": b, "scene": s, "set": c["set"], "templates": tpl, "n": n} for a in FIGHT for b in FIGHT for s in scenes]
def run(j):
    p = subprocess.run(["node", "tools/proto/situations.ts", json.dumps(j)], capture_output=True, text=True, env=dict(os.environ, LADDER="6"))
    if p.returncode: return {"error": p.stderr[-500:], "me": j["me"], "foe": j["foe"]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res = list(ex.map(run, jobs))
json.dump(res, open(out, "w"))
helm, orders = {}, {}
for r in res:
    if "error" in r: print("ERR", r); continue
    for row in r["rows"]:
        if not row.get("matters"): continue
        if row["clearHelm"]: helm.setdefault(row["clearHelm"], []).append(f'{r["me"]}/{r["foe"]}/{r["scene"]}/r{row["k"]}')
        if row["clearOrder"]: orders.setdefault(row["clearOrder"], []).append(f'{r["me"]}/{r["foe"]}/{r["scene"]}/r{row["k"]}')
print("Helm moves clearly best:", {k: len(v) for k, v in helm.items()})
print("Orders clearly best:", {k: len(v) for k, v in orders.items()})
for name in ["closeIn", "hold", "openRange", "crossTheirBow"]:
    if name not in helm: print("MISSING helm", name)
for name in ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "charge", "volley", "mortar", "hotShot", "firePots"]:
    if name not in orders: print("MISSING order", name)
for k in ("repel", "charge", "volley", "mortar", "hotShot", "firePots", "holdFire", "board"):
    print(k, orders.get(k, [])[:4])
