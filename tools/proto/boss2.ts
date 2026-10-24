// SCRATCH ONLY. One Fighting Style (set PROTO_STYLE) against Old Shellback. Usage: node tools/proto/boss2.ts '{"rules":[...],"set":{...},"n":200}'
import { B } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { runBoss } from "../v3/sim/jobs.ts";
const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const n = cfg.n ?? 200;
const r: any = runBoss({ doctrine: { name: process.env.PROTO_STYLE ?? "x", rules: cfg.rules } as any, tide: 6, label: `proto/boss2/${process.env.PROTO_STYLE}`, from: 0, count: n });
console.log(JSON.stringify({ style: process.env.PROTO_STYLE, beatenPct: Math.round((1000 * r.beaten) / n) / 10, kinds: Object.fromEntries(Object.entries(r.kinds).map(([k, v]) => [k, Math.round((1000 * (v as number)) / n) / 10])) }));
