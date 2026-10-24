import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
st = json.load(open(sys.argv[1])); out = sys.argv[2]; n = int(sys.argv[3]); extra = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
tplx = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
c = tune.config(st, 1); tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"]); tpl.update(tplx)
sets = dict(c["set"], **extra)
pairs = [("Boarder", f, [2, 3, 4, 5, 6]) for f in ("Gunline", "Skirmisher", "Bombardier", "Rammer", "Firebrand", "Boarder")]
pairs += [(m, "Boarder", [2, 3, 4, 5, 6]) for m in ("Gunline", "Skirmisher", "Rammer", "Firebrand", "Bombardier")]
pairs += [("Bombardier", f, [1, 2, 3]) for f in ("Gunline", "Firebrand", "Skirmisher", "Rammer")]
pairs += [("Firebrand", f, [2, 3, 4, 5]) for f in ("Rammer", "Gunline")]
scenes = ["open/breeze", "reef", "fog"]
jobs = [{"me": a, "foe": b, "scene": s, "set": sets, "templates": tpl, "n": n, "ks": ks} for a, b, ks in pairs for s in scenes]
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
print("Orders clearly best:", {k: len(v) for k, v in orders.items()})
for k in ("charge", "volley", "repel", "mortar", "hotShot", "firePots"): print(k, orders.get(k, [])[:5])
