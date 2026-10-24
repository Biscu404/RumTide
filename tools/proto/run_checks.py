import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
def cfg_for(st, mode, n, extra=None):
    c = tune.config(st, 1)
    tpl = dict({"Boarder": shell_tune.BOARDER}, **c["templates"])
    return {"mode": mode, "n": n, "set": dict(c["set"], **(extra or {})), "templates": tpl}
def run(c):
    p = subprocess.run(["node", "tools/proto/checks.ts", json.dumps(c)], capture_output=True, text=True, env=dict(os.environ, LADDER="6"))
    if p.returncode: raise RuntimeError(p.stderr[-800:])
    return json.loads(p.stdout.strip().splitlines()[-1])
if __name__ == "__main__":
    st = json.load(open(sys.argv[1])); extra = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    with ThreadPoolExecutor(2) as ex:
        seat, power = list(ex.map(run, [cfg_for(st, "seat", 40, extra), cfg_for(st, "power", 150, extra)]))
    bad = [r for r in seat["rows"] if r["hunter"] is not None and r["decided"] >= 20 and abs(r["hunter"] - 50) > 5]
    print("check 3 overall hunter share", seat["overall"], "rows outside 45 to 55:", len(bad))
    for r in bad[:20]: print("  ", r)
    print("check 4:", power["rows"])
