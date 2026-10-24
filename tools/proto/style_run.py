import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
BASE = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1,"proto.hit.firePots":1.4,"proto.pairWin":1.6,"proto.pairLose":0.6}
DASH = {"proto.dash":1}
SPOIL = {"proto.dash":1,"proto.dashSpoilsRake":1}
ALL4 = dict(SPOIL, **{"proto.kite":1,"proto.slippery":1.25,"proto.steady":1.2})
GRAP = dict(ALL4, **{"proto.styleGrapnels":1})
series = [
  (4, "ref: 4 distances", BASE, ["adapt"]),
  (6, "A: 6 distances", BASE, ["adapt"]),
  (6, "B: + Dash", dict(BASE, **DASH), ["adapt"]),
  (6, "C: + Dash spoils rake", dict(BASE, **SPOIL), ["adapt","counter"]),
  (6, "D: + all four traits", dict(BASE, **ALL4), ["adapt","counter"]),
  (6, "E: + Brawler grapnels", dict(BASE, **GRAP), ["adapt","counter"]),
]
cfgs=[]
for ladder,name,s,variants in series:
    for v in variants:
        for d in (0,5,10,15):
            cfgs.append({"ladder":ladder,"cfg":{"label":f"{name} [{v}] D{d}","variant":v,"drill":d,"n":100,"set":s}})
def run(c):
    env=dict(os.environ,LADDER=str(c["ladder"]))
    p=subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(c["cfg"])],capture_output=True,text=True,env=env)
    if p.returncode!=0: return {"label":c["cfg"]["label"],"error":p.stderr[-400:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
