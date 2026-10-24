"""SCRATCH ONLY. Coordinate search over the Fighting Style numbers and template choices, scored by the wheel.
Usage: python3 tools/proto/tune.py state.json [sweeps] [n]"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from wheel import BEATS, EVEN, FIGHT  # noqa: E402

BASE = {
    "combat.range.round.grappled": 0, "combat.range.grape.grappled": 0,
    "proto.deck": 1, "proto.firstOver": 1, "proto.lashed": 1, "proto.closeFire": 1,
    "proto.hit.firePots": 1.4, "proto.dash": 1, "proto.slippery": 1.25,
    "proto.styleGrapnels": 1, "proto.grapnelLines": 1, "proto.overtime": 2, "proto.quietCutFree": 1,
}


def fight(helm, guns): return {"kind": "fight", "helm": helm, "guns": guns}
def rule(c, then): return {"if": c, "then": then}
def rng(op, r): return {"kind": "range", "op": op, "range": r}
G = rng("is", "grappled")
def their_helm(m): return {"kind": "theirLastHelm", "move": m}
def their_guns(o): return {"kind": "theirLastGuns", "order": o}


TPL = {
    "Skirmisher": {
        "react": [rule([G], fight("openRange", "repel")), rule([their_helm("closeIn")], fight("crossTheirBow", "roundShot")),
                  rule([rng("atLeast", "medium")], fight("closeIn", "chainShot")), rule([], fight("crossTheirBow", "roundShot"))],
        "kite": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "close")], fight("openRange", "roundShot")),
                 rule([rng("atLeast", "medium")], fight("closeIn", "chainShot")), rule([], fight("crossTheirBow", "roundShot"))],
        "reactRound": [rule([G], fight("openRange", "repel")), rule([their_helm("closeIn")], fight("crossTheirBow", "roundShot")),
                       rule([rng("atLeast", "medium")], fight("closeIn", "roundShot")), rule([], fight("crossTheirBow", "roundShot"))],
        "reactChain": [rule([G], fight("openRange", "repel")), rule([their_helm("closeIn")], fight("crossTheirBow", "chainShot")),
                       rule([rng("atLeast", "medium")], fight("closeIn", "chainShot")), rule([], fight("crossTheirBow", "roundShot"))],
    },
    "Rammer": {
        "plain": [rule([G], fight("openRange", "repel")), rule([], fight("closeIn", "roundShot"))],
        "counter": [rule([G], fight("openRange", "repel")), rule([their_helm("crossTheirBow")], fight("openRange", "roundShot")),
                    rule([], fight("closeIn", "roundShot"))],
        "holdCounter": [rule([G], fight("openRange", "repel")), rule([their_helm("crossTheirBow")], fight("hold", "roundShot")),
                        rule([], fight("closeIn", "roundShot"))],
    },
    "Gunline": {
        "crossCharge": [rule([G], fight("openRange", "repel")), rule([their_helm("closeIn"), rng("atMost", "short")], fight("crossTheirBow", "grapeshot")),
                        rule([rng("atLeast", "long")], fight("closeIn", "roundShot")), rule([], fight("hold", "roundShot"))],
        "holdLong": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "close")], fight("hold", "grapeshot")),
                     rule([rng("is", "far")], fight("closeIn", "roundShot")), rule([], fight("hold", "roundShot"))],
        "grapeShort": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "short")], fight("hold", "grapeshot")),
                       rule([rng("atLeast", "long")], fight("closeIn", "roundShot")), rule([], fight("hold", "roundShot"))],
        "grapeClose": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "close")], fight("hold", "grapeshot")),
                       rule([rng("atLeast", "long")], fight("closeIn", "roundShot")), rule([], fight("hold", "roundShot"))],
        "repelDeck": [rule([G], fight("hold", "repel")), rule([rng("atMost", "short")], fight("hold", "grapeshot")),
                      rule([rng("atLeast", "long")], fight("closeIn", "roundShot")), rule([], fight("hold", "roundShot"))],
    },
    "Firebrand": {
        "counterRange": [rule([G], fight("hold", "firePots")), rule([their_helm("crossTheirBow")], fight("openRange", "hotShot")),
                         rule([rng("atLeast", "medium")], fight("closeIn", "roundShot")), rule([], fight("closeIn", "hotShot"))],
        "counter": [rule([G], fight("hold", "firePots")), rule([their_helm("crossTheirBow")], fight("openRange", "hotShot")),
                    rule([], fight("closeIn", "hotShot"))],
        "plain": [rule([G], fight("hold", "firePots")), rule([], fight("closeIn", "hotShot"))],
        "holdShort": [rule([G], fight("hold", "firePots")), rule([rng("atMost", "short")], fight("hold", "hotShot")),
                      rule([], fight("closeIn", "hotShot"))],
    },
    "Bombardier": {
        "crossShort": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "short")], fight("crossTheirBow", "roundShot")),
                       rule([rng("is", "medium")], fight("openRange", "mortar")), rule([], fight("hold", "mortar"))],
        "plain": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "short")], fight("openRange", "roundShot")),
                  rule([rng("is", "medium")], fight("openRange", "mortar")), rule([], fight("hold", "mortar"))],
        "holdMedium": [rule([G], fight("openRange", "repel")), rule([rng("atMost", "short")], fight("openRange", "roundShot")),
                       rule([], fight("hold", "mortar"))],
    },
}

# name -> list of candidate values; a value is a dict of paths (or "tpl.<Style>" -> variant)
def p(path, values): return [{path: v} for v in values]
SPACE = {
    "ramHull": p("proto.ramHull", [18, 22, 26, 30, 34]),
    "ramGivesGrapple": p("proto.ramGivesGrapple", [0, 1]),
    "ramSelf": p("proto.ramSelf", [4, 8, 12]),
    "ramStagger": p("proto.ramStagger", [0.6, 0.8, 1.0]),
    "ramFireRounds": p("proto.ramFireRounds", [2, 3, 4, 5]),
    "ramVsFire": p("proto.ramVsFire", [0.4, 0.7, 1.0]),
    "fireHull": p("proto.fireHull", [6, 8, 10, 12, 14]),
    "firebrandPots": p("proto.firebrandPots", [2, 4, 6]),
    "fireRounds": p("proto.fireRounds", [1, 2, 3]),
    "firebrandExtra": p("proto.firebrandExtra", [0, 1, 2]),
    "hotShotFire": p("proto.hotShotFire", [0.3, 0.5, 0.7]),
    "fireSpread": p("proto.fireSpread", [0.1, 0.2, 0.4, 0.6]),
    "fireGuns": p("proto.fireGuns", [0.7, 0.85, 1.0]),
    "hotNear": [{"combat.range.hot.short": v, "combat.range.hot.close": v} for v in (0.6, 0.8, 1.0, 1.2)],
    "hotMedium": p("combat.range.hot.medium", [0.3, 0.6, 0.9]),
    "mortarFar": [{"combat.range.mortar.far": v, "combat.range.mortar.long": v} for v in (1.0, 1.2, 1.4, 1.6, 1.8, 2.0)],
    "mortarMedium": p("combat.range.mortar.medium", [0.6, 0.9, 1.2, 1.5]),
    "mortarShort": p("combat.range.mortar.short", [0, 0.3, 0.6]),
    "mortarFire": p("proto.mortarFire", [0, 0.2, 0.4]),
    "zeroStep": p("proto.zeroStep", [0.1, 0.25, 0.4]),
    "bombStartFar": p("proto.bombStartFar", [0, 1]),
    "bracedRake": p("proto.bracedRake", [1.0, 1.15, 1.25, 1.3, 1.35, 1.4, 1.5]),
    "steady": p("proto.steady", [1.0, 1.1, 1.2, 1.3, 1.4]),
    "kite": p("proto.kite", [0, 1]),
    "pairWin": p("proto.pairWin", [1.4, 1.6, 1.8]),
    "pairLose": p("proto.pairLose", [0.5, 0.6, 0.75]),
    "firstOverBonus": p("proto.firstOverBonus", [1.25, 1.5, 2.0]),
    "lashedFactor": p("proto.lashedFactor", [1.0, 1.5, 2.0]),
    "grapeShort": p("combat.range.grape.short", [0.5, 0.85, 1.0]),
    "bombHands": p("proto.bombHands", [0.6, 0.75, 0.9, 1.0]),
    "tinder": p("proto.tinder", [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0]),
    "bracedRam": p("proto.bracedRam", [0.4, 0.55, 0.7, 0.85, 1.0]),
    "grapnelBonus": p("proto.grapnelBonus", [1.0, 1.5, 2.0, 3.0]),
    "ramContest": p("proto.ramContest", [0, 1]),
    "ramHoldEase": p("proto.ramHoldEase", [0.3, 0.5, 0.7, 1.0]),
    "dashSpoilContest": p("proto.dashSpoilContest", [0, 1]),
    "spoiledRake": p("proto.spoiledRake", [1.0, 1.25, 1.5]),
    "mortarHit": p("proto.mortarHit", [0.5, 0.65, 0.8, 1.0]),
    "zeroHit": p("proto.zeroHit", [0, 0.1, 0.2]),
    "bombOpenHelm": p("proto.bombOpenHelm", [1.0, 1.15, 1.3, 1.5]),
    "longNines": p("proto.longNines", [0.6, 0.8, 1.0]),
    "bombRamArmor": p("proto.bombRamArmor", [0.4, 0.6, 0.8, 1.0]),
    "boarderStrength": p("proto.boarderStrength", [1.0, 1.1, 1.2, 1.35]),
    "victoryMargin": p("combat.victoryMargin", [0.05, 0.075, 0.1]),
    "fireDeck": p("proto.fireDeck", [0.6, 0.75, 0.9, 1.0]),
    "hotPowder": p("proto.hotPowder", [1, 2]),
    "gunlineFire": p("proto.gunlineFire", [0.4, 0.6, 0.8, 1.0]),
    "mortarFireRounds": p("proto.mortarFireRounds", [1, 2]),
    "boarderChase": p("proto.boarderChase", [1.0, 1.15, 1.3, 1.5]),
    "firebrandBurns": p("proto.firebrandBurns", [1.0, 1.5, 2.0]),
    "hotNear2": [{"combat.range.hot.short": v, "combat.range.hot.close": v} for v in (0.9, 1.0)],
    "tplSkirmisher": p("tpl.Skirmisher", ["react", "kite", "reactChain", "reactRound"]),
    "tplRammer": p("tpl.Rammer", ["plain", "counter", "holdCounter"]),
    "tplGunline": p("tpl.Gunline", ["grapeShort", "grapeClose", "repelDeck", "crossCharge", "holdLong"]),
    "tplFirebrand": p("tpl.Firebrand", ["plain", "holdShort", "counter", "counterRange"]),
    "tplBombardier": p("tpl.Bombardier", ["plain", "holdMedium", "crossShort"]),
}


def config(state, n, drill=0, label="tune", only=None):
    s = dict(BASE)
    tpl = {}
    for k, v in state.items():
        if k.startswith("tpl."):
            tpl[k[4:]] = TPL[k[4:]][v]
        else:
            s[k] = v
    return {"label": label, "drill": drill, "n": n, "set": s, "templates": tpl, "only": only or FIGHT}


def run(cfg):
    env = dict(os.environ, LADDER="6")
    pr = subprocess.run(["node", "tools/proto/styles.ts", json.dumps(cfg)], capture_output=True, text=True, env=env)
    if pr.returncode != 0:
        raise RuntimeError(pr.stderr[-800:])
    return json.loads(pr.stdout.strip().splitlines()[-1])


def loss(r):
    m = r["matrix"]
    L = 0.0
    for a, bs in BEATS.items():
        for b in bs:
            w, l = m[a][b]["win"], m[a][b]["loss"]
            dec = w + l
            s = w / dec if dec > 0 else 0.5
            if s < 0.6: L += 10 * (0.6 - s) ** 2
            if s > 0.78: L += 15 * (s - 0.78) ** 2
            L += 1.5 * (1 - dec / 100) ** 2
    for a, b in EVEN:
        w, l = m[a][b]["win"], m[a][b]["loss"]
        dec = w + l
        s = w / dec if dec > 0 else 0.5
        if abs(s - 0.5) > 0.1: L += 10 * (abs(s - 0.5) - 0.1) ** 2
        L += 0.5 * (1 - dec / 100) ** 2
    for st in FIGHT:
        f = r["field"][st]
        if f > 50: L += 10 * ((f - 50) / 100) ** 2
        if f < 20: L += 10 * ((20 - f) / 100) ** 2
    return L


def evaluate(state, n):
    r = run(config(state, n))
    return loss(r), r


if __name__ == "__main__":
    path = sys.argv[1]
    sweeps = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    state = json.load(open(path)) if os.path.exists(path) else {}
    # defaults for anything not in the state yet: the first candidate's middle value
    for name, cands in SPACE.items():
        for k in cands[0]:
            if k not in state:
                state.update(cands[len(cands) // 2])
    best, _ = evaluate(state, n)
    print(f"start loss {best:.4f}", flush=True)
    only = os.environ.get("ONLY")
    space = {k: v for k, v in SPACE.items() if not only or k in only.split(",")}
    for sweep in range(sweeps):
        improved = False
        for name, cands in space.items():
            trials = [dict(state, **c) for c in cands]
            with ThreadPoolExecutor(2) as ex:
                scores = list(ex.map(lambda st: evaluate(st, n)[0], trials))
            i = min(range(len(trials)), key=lambda j: scores[j])
            if scores[i] < best - 1e-9:
                best = scores[i]
                state = trials[i]
                improved = True
                print(f"sweep {sweep} {name} -> {cands[i]}  loss {best:.4f}", flush=True)
            json.dump(state, open(path, "w"), indent=1)
        if not improved:
            break
    print("final loss", round(best, 4))
    print(json.dumps(state))
