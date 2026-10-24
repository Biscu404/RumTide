import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
st = json.load(open(sys.argv[1])); out = sys.argv[2]; n = int(sys.argv[3])
c = tune.config(st, 1); tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"])
styles = ["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand"]
pairs = [("Bombardier", f, [1, 2, 3]) for f in styles if f != "Bombardier"] + [("Firebrand", f, [1, 2, 3, 4]) for f in styles if f != "Firebrand"]
jobs = [{"me": a, "foe": b, "scene": s, "set": c["set"], "templates": tpl, "n": n, "ks": ks} for a, b, ks in pairs for s in ["open/breeze", "rocky"]]
def run(j):
    p = subprocess.run(["node", "tools/proto/situations.ts", json.dumps(j)], capture_output=True, text=True, env=dict(os.environ, LADDER="6"))
    if p.returncode: return {"error": p.stderr[-500:], "me": j["me"], "foe": j["foe"]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res = list(ex.map(run, jobs))
json.dump(res, open(out, "w"))
orders, helms = {}, {}
for r in res:
    if "error" in r: print("ERR", r); continue
    for row in r["rows"]:
        if not row.get("matters"): continue
        if row["clearOrder"]: orders.setdefault(row["clearOrder"], []).append(f'{r["me"]}/{r["foe"]}/{r["scene"]}/r{row["k"]}')
        if row["clearHelm"]: helms.setdefault(row["clearHelm"], []).append(1)
print("orders:", {k: len(v) for k, v in orders.items()}, "helms:", {k: len(v) for k, v in helms.items()})
for k in ("mortar", "hotShot"): print(k, orders.get(k, []))
