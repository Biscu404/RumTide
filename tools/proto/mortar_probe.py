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
    jobs = [{"me": "Bombardier", "foe": f, "scene": sc, "set": c["set"], "templates": tpl, "n": 100, "ks": [1, 2, 3]} for f in ("Bombardier", "Gunline", "Firebrand", "Boarder") for sc in ("open/breeze", "rocky")]
    with ThreadPoolExecutor(2) as ex: res = list(ex.map(sit, jobs))
    clear = [f'{r["foe"]}/{r["scene"]}/r{row["k"]}' for r in res for row in r["rows"] if row.get("matters") and row["clearOrder"] == "mortar"]
    w = tune.run(tune.config(s2, 80)); m = w["matrix"]
    bad = []
    for a, bs in wheel.BEATS.items():
        for b in bs:
            s = 100*m[a][b]['win']/(m[a][b]['win']+m[a][b]['loss'])
            if not 55 <= s <= 80: bad.append(f"{a[:4]}>{b[:4]} {s:.0f}")
    for a, b in wheel.EVEN:
        s = 100*m[a][b]['win']/(m[a][b]['win']+m[a][b]['loss'])
        if not 35 <= s <= 65: bad.append(f"{a[:4]}={b[:4]} {s:.0f}")
    print(name, "mortar clear:", clear, "| loss", round(tune.loss(w), 3), "out:", bad, "field", " ".join(f"{s[:4]}{w['field'][s]:.0f}" for s in wheel.FIGHT), flush=True)
