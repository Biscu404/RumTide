import json, sys, os, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune, wheel
from concurrent.futures import ThreadPoolExecutor
st = json.load(open(sys.argv[1])); variants = json.loads(sys.argv[2])
def sit(j):
    p = subprocess.run(["node", "tools/proto/situations.ts", json.dumps(j)], capture_output=True, text=True, env=dict(os.environ, LADDER="6"))
    return json.loads(p.stdout.strip().splitlines()[-1])
for name, v in variants.items():
    s2 = dict(st, **v)
    c = tune.config(s2, 1); tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"])
    jobs = [{"me": "Firebrand", "foe": f, "scene": sc, "set": c["set"], "templates": tpl, "n": 100, "ks": [1, 2, 3, 4]} for f in ("Firebrand", "Rammer", "Gunline", "Boarder") for sc in ("open/breeze", "rocky")]
    with ThreadPoolExecutor(2) as ex: res = list(ex.map(sit, jobs))
    clear = [f'{r["foe"]}/{r["scene"]}/r{row["k"]}' for r in res for row in r["rows"] if row.get("matters") and row["clearOrder"] == "hotShot"]
    top = [f'{r["foe"]}/{r["scene"]}/r{row["k"]}' for r in res for row in r["rows"] if row.get("matters") and row["top"]["guns"] == "hotShot"]
    w = tune.run(tune.config(s2, 60))
    m = w["matrix"]
    print(name, "hot clear:", clear, "hot top:", len(top), "| wheel loss", round(tune.loss(w), 3), "Fire field", w["field"]["Firebrand"],
          {f"{a[:4]}>{b[:4]}": round(100*m[a][b]['win']/(m[a][b]['win']+m[a][b]['loss'])) for a, bs in wheel.BEATS.items() for b in bs if "Fire" in a + b}, "G=F", round(100*m["Gunline"]["Firebrand"]["win"]/(m["Gunline"]["Firebrand"]["win"]+m["Gunline"]["Firebrand"]["loss"])), flush=True)
