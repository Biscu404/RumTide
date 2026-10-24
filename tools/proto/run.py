import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

def run(cfg):
    p = subprocess.run(["node", "tools/proto/measure.ts", json.dumps(cfg)], capture_output=True, text=True)
    if p.returncode != 0:
        return {"label": cfg.get("label"), "error": p.stderr[-400:]}
    return json.loads(p.stdout.strip().splitlines()[-1])

def table(cfgs, workers=2):
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(run, cfgs))
    print(f"{'step':44s} {'FIELD':>6s} {'vs Skirm':>9s} {'vs Runner':>10s} {'vs Coward':>10s}")
    for r in res:
        if "error" in r:
            print(r["label"], "ERROR", r["error"]); continue
        o = r["opps"]
        print(f"{r['label']:44s} {r['field']:6.1f} {o['Skirmisher']['win']:9.1f} {o['Runner']['win']:10.1f} {o['Coward']['win']:10.1f}")
    return res

if __name__ == "__main__":
    cfgs = json.load(open(sys.argv[1]))
    res = table(cfgs)
    if len(sys.argv) > 2:
        json.dump(res, open(sys.argv[2], "w"))
