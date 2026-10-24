import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import boss_eval
SPACE = {
 "hull": [{"shellback.hull": v} for v in (300, 400, 500, 600)],
 "claws": [{"shellback.clawHands": v} for v in (44, 46, 48, 50, 52)],
 "cannons": [{"shellback.cannons": v} for v in (10, 14, 18, 22)],
 "helm": [{"shellback.helm": v} for v in (8, 10, 14)],
 "armour": [{"proto.bossArmour": v} for v in (0.5, 0.6, 0.7, 0.8)],
 "retreatHull": [{"proto.bossRetreatHull": v} for v in (0.25, 0.35, 0.5)],
 "retreatClaws": [{"proto.bossRetreatClaws": v} for v in (0.15, 0.2, 0.25, 0.35)],
 "rearUp": [{"shellback.rearUpRoundShot": v} for v in (2, 3)],
 "mortarVsBoss": [{"proto.mortarVsBoss": v} for v in (2, 2.5, 3, 3.5)],
 "cannons2": [{"shellback.cannons": v} for v in (12, 16)],
}
st = json.load(open(sys.argv[1])); path = sys.argv[2]; sweeps = int(sys.argv[3])
shell = json.load(open(path)) if os.path.exists(path) else {"proto.bossRetreat": 1, "proto.bossNoPoints": 1, "proto.bossArmour": 0.7, "shellback.hull": 300,
    "shellback.clawHands": 40, "shellback.cannons": 10, "shellback.helm": 10, "proto.bossRetreatHull": 0.5, "proto.bossRetreatClaws": 0.5, "shellback.rearUpRoundShot": 2, "proto.bossMoods": 1}
best, b, t, _ = boss_eval.evaluate(st, shell)
print("start", round(best, 4), b, t, flush=True)
for sw in range(sweeps):
    imp = False
    for name, cands in SPACE.items():
        for c in cands:
            trial = dict(shell, **c)
            if trial == shell: continue
            L, bb, tt, _ = boss_eval.evaluate(st, trial)
            if L < best - 1e-9:
                best, shell, b, t, imp = L, trial, bb, tt, True
                print(f"sweep {sw} {name} {c} loss {L:.4f} best {bb} templates {tt}", flush=True)
        json.dump(shell, open(path, "w"), indent=1)
    if not imp: break
print("final", round(best, 4), b, t); print(json.dumps(shell))
