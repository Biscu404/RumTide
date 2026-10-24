import json, sys, os, subprocess
sys.path.insert(0,'tools/proto')
import tune, wheel
from concurrent.futures import ThreadPoolExecutor
st=json.load(open('tools/proto/tune_state.json'))
ALL7=wheel.FIGHT+["Smuggler"]
jobs=[
 ("Drill 0, n 100, all seven", dict(tune.config(st,100,label="Drill 0, n 100", only=ALL7))),
 ("everyone Drill 10, n 60", dict(tune.config(st,60,drill=10,label="everyone Drill 10", only=wheel.FIGHT), drillAll=True)),
 ("everyone Drill 15, n 60", dict(tune.config(st,60,drill=15,label="everyone Drill 15", only=wheel.FIGHT), drillAll=True)),
 ("only the Boarder at Drill 10, n 60", tune.config(st,60,drill=10,label="only the Boarder at Drill 10", only=wheel.FIGHT)),
]
def go(j):
    return tune.run(j[1])
with ThreadPoolExecutor(2) as ex: res=list(ex.map(go, jobs))
json.dump(res, open('tools/proto/o_validate.json','w'))
for r in res:
    print("loss", round(tune.loss(r),3)); wheel.report(r)
# Old Shellback, one run per style template
base=tune.config(st,1)
from importlib import reload
TPL_DEFAULT={"Boarder":[tune.rule([tune.G, tune.their_guns("repel")], tune.fight("hold","volley")), tune.rule([tune.G], tune.fight("hold","charge")), tune.rule([tune.rng("atMost","short")], tune.fight("closeIn","board")), tune.rule([], tune.fight("closeIn","roundShot"))]}
tpl=dict(TPL_DEFAULT, **base["templates"])
def boss(style):
    env=dict(os.environ, LADDER="6", PROTO_STYLE=style)
    p=subprocess.run(["node","tools/proto/boss2.ts",json.dumps({"rules":tpl[style],"set":base["set"],"n":200})],capture_output=True,text=True,env=env)
    return p.stdout.strip() or p.stderr[-300:]
with ThreadPoolExecutor(2) as ex: out=list(ex.map(boss, wheel.FIGHT))
print("\nOld Shellback against a fresh sloop of each style:")
for o in out: print(" ", o)
