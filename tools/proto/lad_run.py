import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
FULL = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1}
cfgs=[]
def add(ladder,tag,extra):
    for d in (0,10):
        cfgs.append({"ladder":ladder,"cfg":{"label":f"{tag}/D{d}","variant":"adapt","drill":d,"n":150,"set":dict(FULL,**extra)}})
add(4,"4 bands, today's pace",{})
add(5,"5 bands, slow approach",{})
add(5,"5 bands, closeHold 2",{"combat.bands.closeHold":2})
add(6,"6 bands, slow approach",{})
add(6,"6 bands, closeHold 2",{"combat.bands.closeHold":2})
add(6,"6 bands, closeHold 2 + 6 rounds",{"combat.bands.closeHold":2,"combat.rounds":6})
add(6,"6 bands, 6 rounds only",{"combat.rounds":6})
def run(c):
    env=dict(os.environ,LADDER=str(c["ladder"]))
    p=subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(c["cfg"])],capture_output=True,text=True,env=env)
    if p.returncode!=0: return {"label":c["cfg"]["label"],"error":p.stderr[-400:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
