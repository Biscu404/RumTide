import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
FULL = {"combat.range.round.grappled":0,"combat.range.grape.grappled":0,"proto.deck":1,"proto.firstOver":1,"proto.lashed":1,"proto.closeFire":1,"proto.hit.firePots":1.4,"proto.pairWin":1.6,"proto.pairLose":0.6}
cfgs=[{"label":f"margins 1.6/0.6 {v}/D{d}","variant":v,"drill":d,"n":150,"set":FULL} for v in ("adapt","smart") for d in (0,5,10,15)]
def run(cfg):
    p=subprocess.run(["node","tools/proto/roundrobin.ts",json.dumps(cfg)],capture_output=True,text=True)
    if p.returncode!=0: return {"label":cfg["label"],"error":p.stderr[-300:]}
    return json.loads(p.stdout.strip().splitlines()[-1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(run,cfgs))
json.dump(res,open(sys.argv[1],"w")); print("done",len(res))
