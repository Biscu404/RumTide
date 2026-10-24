import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
BASE = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1,"proto.hit.firePots":1.4,"proto.pairWin":1.6,"proto.pairLose":0.6}
ALL4 = dict(BASE, **{"proto.dash":1,"proto.dashSpoilsRake":1,"proto.kite":1,"proto.slippery":1.25,"proto.steady":1.2})
series = [
  ("D1: spoiled rake x1.25", dict(ALL4, **{"proto.spoiledRake":1.25})),
  ("D2: spoiled rake x1.5", dict(ALL4, **{"proto.spoiledRake":1.5})),
  ("D3: D1 + 2 overtime rounds", dict(ALL4, **{"proto.spoiledRake":1.25,"proto.overtime":2})),
  ("D4: D2 + 2 overtime rounds", dict(ALL4, **{"proto.spoiledRake":1.5,"proto.overtime":2})),
]
cfgs=[{"cfg":{"label":f"{name} D{d}","variant":"counter","drill":d,"n":100,"set":s}} for name,s in series for d in (0,5,10,15)]
def run(c):
    env=dict(os.environ,LADDER="6")
    p=subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(c["cfg"])],capture_output=True,text=True,env=env)
    if p.returncode!=0: return {"label":c["cfg"]["label"],"error":p.stderr[-400:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
