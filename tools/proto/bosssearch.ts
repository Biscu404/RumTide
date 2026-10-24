// SCRATCH ONLY. The best doctrine one Fighting Style's captain can write against Old Shellback, found by a small search.
// Usage: PROTO_STYLE=Gunline LADDER=6 node tools/proto/bosssearch.ts '{"rules":[...],"set":{...},"pop":16,"gens":2,"seeds":40,"confirm":120}'
import { B, rngFor } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, DoctrineRule } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { runBoss } from "../v3/sim/jobs.ts";
import { randomCondition } from "../v3/sim/plans.ts";

const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const style = process.env.PROTO_STYLE ?? "";
const pop: number = cfg.pop ?? 16, gens: number = cfg.gens ?? 2, seeds: number = cfg.seeds ?? 40, confirm: number = cfg.confirm ?? 120;
const HELM = ["closeIn", "hold", "openRange", "crossTheirBow"];
const GUNS = ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "charge", "volley",
  ...(style === "Bombardier" ? ["mortar", "mortar"] : []), ...(style === "Firebrand" ? ["hotShot", "hotShot", "firePots"] : [])];
const rng = rngFor(777, "bosssearch", style);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)]!;
const action = (): any => ({ kind: "fight", helm: pick(HELM), guns: pick(GUNS) });
const ruleWith = (): DoctrineRule => ({ if: rng.next() < 0.3 ? [randomCondition(rng), randomCondition(rng)] : [randomCondition(rng)], then: action() }) as DoctrineRule;
function mutate(d: Doctrine, name: string): Doctrine {
  const rules = d.rules.map((r) => ({ ...r, if: [...r.if] })) as DoctrineRule[];
  const cond = rules.length - 1;
  const roll = rng.next();
  if (roll < 0.35) { const i = Math.floor(rng.next() * rules.length); (rules[i] as any).then = action(); }
  else if (roll < 0.6 && cond > 0) { const i = Math.floor(rng.next() * cond); rules[i] = { ...rules[i]!, if: ruleWith().if }; }
  else if (roll < 0.8) { if (cond < 3) rules.splice(Math.floor(rng.next() * (cond + 1)), 0, ruleWith()); else rules[Math.floor(rng.next() * cond)] = ruleWith(); }
  else if (cond > 1) { const i = Math.floor(rng.next() * (cond - 1)); [rules[i], rules[i + 1]] = [rules[i + 1]!, rules[i]!]; }
  return { name, rules };
}
const rate = (d: Doctrine, label: string, count: number, from = 0) => {
  const r: any = runBoss({ doctrine: d, tide: 6, label, from, count });
  return r.beaten / count;
};
const template: Doctrine = { name: `${style}-template`, rules: cfg.rules };
// Seeds: this style's template, plus every doctrine a captain of any style could write (the Crabber of P2.6 and the other
// templates without their style only orders), so a style's best is never worse than what everyone can do.
const ONLY: Record<string, string> = { mortar: "Bombardier", hotShot: "Firebrand" };
const usable = (d: Doctrine): Doctrine => ({ ...d, rules: d.rules.map((r: any) => (r.then?.kind === "fight" && ONLY[r.then.guns] && ONLY[r.then.guns] !== style ? { ...r, then: { ...r.then, guns: "roundShot" } } : r)) });
const crabber: Doctrine = { name: "Crabber", rules: [
  { if: [{ kind: "round", op: "is", n: 3 }], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
  { if: [{ kind: "range", op: "is", range: "grappled" }], then: { kind: "fight", helm: "closeIn", guns: "grapeshot" } },
  { if: [], then: { kind: "fight", helm: "crossTheirBow", guns: "roundShot" } }] } as any;
const others: Doctrine[] = (cfg.others ?? []).map((rules: any, i: number) => usable({ name: `other${i}`, rules }));
const seedsList: Doctrine[] = [template, crabber, ...others];
let population: Doctrine[] = [...seedsList, ...Array.from({ length: Math.max(0, pop - seedsList.length) }, (_, i) => mutate(seedsList[i % seedsList.length]!, `m0_${i}`))];
let ranked: { d: Doctrine; r: number }[] = [];
for (let g = 0; g <= gens; g++) {
  ranked = population.map((d) => ({ d, r: rate(d, `bs/${style}/${g}/${d.name}`, seeds) })).sort((a, b) => b.r - a.r);
  if (g === gens) break;
  const parents = ranked.slice(0, Math.max(2, Math.floor(pop / 4))).map((x) => x.d);
  population = [...parents];
  let k = 0;
  while (population.length < pop) population.push(mutate(parents[k++ % parents.length]!, `m${g + 1}_${k}`));
}
const finalists = ranked.slice(0, 3).map((x) => ({ d: x.d, r: rate(x.d, `bs/${style}/confirm`, confirm, 10000) }));
finalists.sort((a, b) => b.r - a.r);
const templateRate = rate(template, `bs/${style}/template`, confirm, 10000);
console.log(JSON.stringify({ style, best: finalists[0]!.r, template: templateRate, bestRules: finalists[0]!.d.rules }));
