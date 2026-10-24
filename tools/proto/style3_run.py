import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
BASE = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1,"proto.hit.firePots":1.4,"proto.pairWin":1.6,"proto.pairLose":0.6}
D3 = dict(BASE, **{"proto.dash":1,"proto.dashSpoilsRake":1,"proto.kite":1,"proto.slippery":1.25,"proto.steady":1.2,"proto.spoiledRake":1.25,"proto.overtime":2})
cfgs=[{"kind":"rr","cfg":{"label":f"D3, Skirmisher kites with Round shot D{d}","variant":"counter2","drill":d,"n":100,"set":D3}} for d in (0,5,10,15)]
for name,s,env in (("today's rules, old Brawler",{}, {"LADDER":"4"}),("spec as written, 4 distances",dict(BASE),{"LADDER":"4"}),("D3, 6 distances, Brawler style",D3,{"LADDER":"6","PROTO_STYLE":"Brawler"})):
    cfgs.append({"kind":"boss","env":env,"cfg":{"label":f"Shellback: {name}","brawler":"old" if name.startswith("today") else "new","n":300,"set":s}})
def run(c):
    env=dict(os.environ,LADDER="6"); env.update(c.get("env",{}))
    script="tools/proto/roundrobin.ts" if c["kind"]=="rr" else "tools/proto/boss.ts"
    p=subprocess.run(["node",script,json.dumps(c["cfg"])],capture_output=True,text=True,env=env)
    if p.returncode!=0: return {"label":c["cfg"]["label"],"error":p.stderr[-400:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
