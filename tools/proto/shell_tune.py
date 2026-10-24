"""SCRATCH ONLY. Tunes Old Shellback against the six style templates.
Usage: python3 tools/proto/shell_tune.py style_state.json shell_state.json [sweeps] [n]"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
import tune  # noqa: E402
from wheel import FIGHT  # noqa: E402

BOARDER = [tune.rule([tune.G, tune.their_guns("repel")], tune.fight("hold", "volley")), tune.rule([tune.G], tune.fight("hold", "charge")),
           tune.rule([tune.rng("atMost", "short")], tune.fight("closeIn", "board")), tune.rule([], tune.fight("closeIn", "roundShot"))]

SPACE = {
    "hull": [{"shellback.hull": v} for v in (200, 250, 300, 350, 400)],
    "claws": [{"shellback.clawHands": v} for v in (20, 25, 30, 35, 40)],
    "cannons": [{"shellback.cannons": v} for v in (6, 8, 10, 12)],
    "helm": [{"shellback.helm": v} for v in (6, 8, 10, 12, 14)],
    "rearUp": [{"shellback.rearUpRoundShot": v} for v in (1.5, 2, 3)],
    "grapple": [{"shellback.grappleFromRound": v} for v in (3, 4)],
}


def boss(style, sets, tpl, n):
    env = dict(os.environ, LADDER="6", PROTO_STYLE=style)
    p = subprocess.run(["node", "tools/proto/boss2.ts", json.dumps({"rules": tpl[style], "set": sets, "n": n})], capture_output=True, text=True, env=env)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-600:])
    return json.loads(p.stdout.strip().splitlines()[-1])["beatenPct"] / 100


def evaluate(style_state, shell, n):
    cfg = tune.config(style_state, 1)
    tpl = dict({"Boarder": BOARDER}, **cfg["templates"])
    sets = dict(cfg["set"], **shell)
    with ThreadPoolExecutor(2) as ex:
        rates = list(ex.map(lambda s: boss(s, sets, tpl, n), FIGHT))
    L = 0.0
    for b in rates:
        if b < 0.3: L += 10 * (0.3 - b) ** 2
        if b > 0.75: L += 5 * (b - 0.75) ** 2
    mean = sum(rates) / len(rates)
    if mean < 0.4: L += 10 * (0.4 - mean) ** 2
    if mean > 0.6: L += 10 * (mean - 0.6) ** 2
    return L, dict(zip(FIGHT, rates))


if __name__ == "__main__":
    style_state = json.load(open(sys.argv[1]))
    path = sys.argv[2]
    sweeps = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 60
    shell = json.load(open(path)) if os.path.exists(path) else {"shellback.hull": 300, "shellback.clawHands": 40, "shellback.cannons": 10,
                                                                  "shellback.helm": 10, "shellback.rearUpRoundShot": 2, "shellback.grappleFromRound": 4}
    best, rates = evaluate(style_state, shell, n)
    print("start", round(best, 4), rates, flush=True)
    for sweep in range(sweeps):
        improved = False
        for name, cands in SPACE.items():
            for c in cands:
                trial = dict(shell, **c)
                if trial == shell: continue
                L, r = evaluate(style_state, trial, n)
                if L < best - 1e-9:
                    best, shell, rates, improved = L, trial, r, True
                    print(f"sweep {sweep} {name} -> {c} loss {best:.4f} {r}", flush=True)
            json.dump(shell, open(path, "w"), indent=1)
        if not improved:
            break
    print("final", round(best, 4), rates)
    print(json.dumps(shell))
