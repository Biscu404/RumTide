"""SCRATCH ONLY. Runs tools/proto/styles.ts for a list of configs and prints the wheel check.
Usage: python3 tools/proto/wheel.py suite.json out.json [workers]"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

BEATS = {
    "Bombardier": ["Gunline", "Firebrand"],
    "Gunline": ["Skirmisher", "Boarder"],
    "Skirmisher": ["Rammer", "Firebrand"],
    "Rammer": ["Gunline", "Bombardier"],
    "Boarder": ["Skirmisher", "Bombardier"],
    "Firebrand": ["Boarder", "Rammer"],
}
EVEN = [("Rammer", "Boarder"), ("Gunline", "Firebrand"), ("Skirmisher", "Bombardier")]
FIGHT = list(BEATS)


def run(c):
    env = dict(os.environ, LADDER="6")
    p = subprocess.run(["node", "tools/proto/styles.ts", json.dumps(c)], capture_output=True, text=True, env=env)
    if p.returncode != 0:
        return {"label": c.get("label"), "error": p.stderr[-600:]}
    return json.loads(p.stdout.strip().splitlines()[-1])


def report(r):
    if "error" in r:
        print(r["label"], "ERROR", r["error"]); return
    m = r["matrix"]
    print(f"\n=== {r['label']} (Drill {r['drill']}, n {r['n']})")
    print("field share (wins vs the other five fighting styles), draws+escapes:")
    print("  " + "  ".join(f"{s[:5]} {r['field'][s]:5.1f}/{r['draws'][s]:4.1f}" for s in FIGHT if s in r["field"]))
    print("designed wins (A beats B): A win / B win / undecided")
    bad = 0
    for a, bs in BEATS.items():
        for b in bs:
            if a not in m or b not in m[a]: continue
            w, l = m[a][b]["win"], m[a][b]["loss"]
            dec = w + l
            share = 100 * w / dec if dec else 50
            flag = "" if (w > l and share <= 80) else ("  <-- too hard" if share > 80 else "  <-- WRONG WAY")
            if flag: bad += 1
            print(f"  {a:10s} > {b:10s} {w:5.1f} / {l:5.1f} / {100 - dec:5.1f}   share {share:5.1f}{flag}")
    print("designed evens:")
    for a, b in EVEN:
        if a not in m or b not in m[a]: continue
        w, l = m[a][b]["win"], m[a][b]["loss"]
        dec = w + l
        share = 100 * w / dec if dec else 50
        flag = "" if 30 <= share <= 70 else "  <-- lopsided"
        if flag: bad += 1
        print(f"  {a:10s} = {b:10s} {w:5.1f} / {l:5.1f} / {100 - dec:5.1f}   share {share:5.1f}{flag}")
    if "Smuggler" in m:
        print("Smuggler (escapes / struck / other) against each:")
        print("  " + "  ".join(f"{s[:5]} E{m['Smuggler'][s]['escape']:4.0f} W{m['Smuggler'][s]['win']:3.0f} L{m['Smuggler'][s]['loss']:3.0f}" for s in FIGHT if s in m["Smuggler"]))
    print(f"problems: {bad}")


if __name__ == "__main__":
    cfgs = json.load(open(sys.argv[1]))
    workers = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(run, cfgs))
    json.dump(res, open(sys.argv[2], "w"))
    for r in res:
        report(r)
