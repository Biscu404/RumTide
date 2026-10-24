import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
FULL = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1,"proto.hit.firePots":1.4}
cands = {
 "A once x2.0 grap10": {"proto.firstOverOnce":1,"proto.firstOverBonus":2.0,"proto.grapnelsAt":10,"proto.fireAt":5},
 "B once x2.0 grap5":  {"proto.firstOverOnce":1,"proto.firstOverBonus":2.0,"proto.grapnelsAt":5,"proto.fireAt":10},
 "C once x1.5 grap5":  {"proto.firstOverOnce":1,"proto.firstOverBonus":1.5,"proto.grapnelsAt":5,"proto.fireAt":10},
 "D once x2.5 grap10": {"proto.firstOverOnce":1,"proto.firstOverBonus":2.5,"proto.grapnelsAt":10,"proto.fireAt":5},
 "E every x1.5 grap7": {"proto.firstOverOnce":0,"proto.firstOverBonus":1.5,"proto.grapnelsAt":7,"proto.fireAt":5},
}
cfgs=[]
for name,s in cands.items():
    for d in (0,5,10,15):
        cfgs.append({"label":f"{name}/D{d}","variant":"adapt","drill":d,"n":150,"set":dict(FULL,**s)})
def run(cfg):
    p=subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(cfg)],capture_output=True,text=True)
    if p.returncode!=0: return {"label":cfg["label"],"error":p.stderr[-300:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
