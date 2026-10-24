import json, sys
d = json.loads(sys.stdin.read().strip().splitlines()[-1])
cols = list(d["rows"])
print("             " + " ".join(f"{c:>12s}" for c in cols))
for r, v in d["rows"].items():
    print(f"{r:12s} " + " ".join("%5.1f/%5.1f" % (v[c]["win"], v[c]["loss"]) for c in cols))
