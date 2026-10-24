import json, os, sys, itertools
sys.path.insert(0, os.path.dirname(__file__))
import boss_eval
st = json.load(open(sys.argv[1]))
base = {"proto.bossRetreat": 1, "proto.bossNoPoints": 1, "proto.bossMoods": 1, "proto.bossSnatch": 1, "shellback.hull": 300, "shellback.cannons": 10, "shellback.helm": 10, "shellback.rearUpRoundShot": 2}
rows = []
combos = [(c, rc, rh, a, 1) for c, rc, rh, a in itertools.product((30, 40, 50), (0.25, 0.35), (0.35, 0.5), (0.55, 0.7, 1.0))]
combos += [(c, 0.5, 0.5, a, 0) for c, a in itertools.product((30, 40, 50), (0.55, 0.7, 1.0))]
for claws, rc, rh, arm, ret in combos:
    shell = dict(base, **{"shellback.clawHands": claws, "proto.bossRetreatClaws": rc, "proto.bossRetreatHull": rh, "proto.bossArmour": arm, "proto.bossRetreat": ret})
    L, best, templ, _ = boss_eval.evaluate(st, shell)
    top, low = max(best.values()), min(best.values())
    rows.append({"shell": shell, "best": best, "templ": templ, "top": top, "low": low})
    print(json.dumps({"claws": claws, "rc": rc, "rh": rh, "arm": arm, "ret": ret, "top": round(top, 2), "low": round(low, 2), "best": {k[:4]: round(v, 2) for k, v in best.items()}}), flush=True)
json.dump(rows, open(sys.argv[2], "w"))
