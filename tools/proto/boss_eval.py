"""SCRATCH ONLY. Best doctrine per style against Old Shellback for one set of numbers."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import tune, shell_tune
from wheel import FIGHT

def one(style, sets, tpl, opts):
    env = dict(os.environ, LADDER="6", PROTO_STYLE=style)
    p = subprocess.run(["node", "tools/proto/bosssearch.ts", json.dumps(dict(opts, rules=tpl[style], set=sets))], capture_output=True, text=True, env=env)
    if p.returncode != 0: raise RuntimeError(p.stderr[-800:])
    return json.loads(p.stdout.strip().splitlines()[-1])

def evaluate(style_state, shell, opts=None):
    opts = opts or {"pop": 30, "gens": 3, "seeds": 60, "confirm": 300}
    cfg = tune.config(style_state, 1)
    tpl = dict({"Boarder": shell_tune.BOARDER}, **cfg["templates"])
    sets = dict(cfg["set"], **shell)
    allt = [tpl[s] for s in FIGHT]
    with ThreadPoolExecutor(2) as ex:
        res = list(ex.map(lambda s: one(s, sets, tpl, dict(opts, others=[t for k, t in zip(FIGHT, allt) if k != s])), FIGHT))
    best = {r["style"]: r["best"] for r in res}
    templ = {r["style"]: r["template"] for r in res}
    L = 0.0
    for b in best.values():
        if b < 0.35: L += 10 * (0.35 - b) ** 2
        if b > 0.7: L += 10 * (b - 0.7) ** 2
    top = max(best.values())
    return L, best, templ, res

if __name__ == "__main__":
    st = json.load(open(sys.argv[1]))
    shell = json.loads(sys.argv[2])
    L, best, templ, res = evaluate(st, shell)
    print(round(L, 4), "best", best, "templates", templ)
