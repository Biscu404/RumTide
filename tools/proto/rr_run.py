import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

FULL = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1}
REFINED = dict(FULL, **{"proto.firstOverOnce":1,"proto.firstOverBonus":3,"proto.grapnelsAt":5,"proto.fireAt":10})
cfgs = []
for name, s in (("spec", FULL), ("refined", REFINED)):
    for variant in ("plain","adapt","smart"):
        for d in (0,5,10,15):
            cfgs.append({"label": f"{name}/{variant}/D{d}", "variant": variant, "drill": d, "n": 200, "set": s})

def run(cfg):
    p = subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(cfg)],capture_output=True,text=True)
    if p.returncode != 0: return {"label":cfg["label"],"error":p.stderr[-300:]}
    return json.loads(p.stdout.strip().splitlines()[-1])

with ThreadPoolExecutor(int(sys.argv[2]) if len(sys.argv)>2 else 4) as ex:
    res = list(ex.map(run, cfgs))
json.dump(res, open(sys.argv[1],"w"))
print("done", len(res))
