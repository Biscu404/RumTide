import json, sys
d = json.load(open(sys.argv[1]))
idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
r = d[idx]
pairs = [p.split(">") for p in sys.argv[3].split(",")] if len(sys.argv) > 3 else None
m = r["matrix"]
for a in m:
    for b in m[a]:
        if pairs and [a, b] not in pairs: continue
        k = sorted(m[a][b]["kinds"].items(), key=lambda kv: -kv[1])
        print(f"{a:10s} vs {b:10s} " + "  ".join(f"{x} {v}" for x, v in k))
