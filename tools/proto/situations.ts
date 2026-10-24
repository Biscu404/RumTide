// SCRATCH ONLY. Check 2 of GAMEPLAY 8.9 for the Fighting Styles: which Helm moves and orders are clearly best somewhere.
// Usage: LADDER=6 node tools/proto/situations.ts '{"me":"Gunline","foe":"Rammer","scene":"open/breeze","set":{...},"templates":{...},"n":40}'
import { B, battleShipOf, doctrineChooser, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Chooser, Doctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { buildShip, sceneByName, scoreOf, seedFor, shareLead, verdictFor } from "../v3/sim/arena.ts";

const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const n: number = cfg.n ?? 40;
const me: string = cfg.me, foe: string = cfg.foe;
const scene = sceneByName(cfg.scene);
const HELM = ["closeIn", "hold", "openRange", "crossTheirBow"];
const ORDERS = ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "charge", "volley",
  ...(me === "Bombardier" ? ["mortar"] : []), ...(me === "Firebrand" ? ["hotShot", "firePots"] : [])];
const plays = HELM.flatMap((helm) => ORDERS.map((guns) => ({ helm, guns })));

function fight(play: { helm: string; guns: string } | null, k: number, seed: number): { value: number; rounds: number; grappledAtK: boolean } {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags);
  for (const [s, st] of [[hs, me], [ts, foe]] as const) {
    s.style = st; s.drill = 0;
    if (st === "Bombardier") { s.maxHands = Math.round(s.maxHands * B.proto.bombHands); s.hands = s.maxHands; }
    s.pots = st === "Firebrand" ? B.proto.firebrandPots : 0;
  }
  const mine = doctrineChooser({ name: me, rules: cfg.templates[me] } as Doctrine, { enemyType: "player" });
  const forced: Chooser = (view: any) => (play && view.round === k ? ({ kind: "fight", rule: -2, abilities: [], helm: play.helm, guns: play.guns } as any) : mine(view));
  const r = runBattle({ tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind, hunter: hs, target: ts,
    doctrines: { hunter: me, target: foe }, choosers: { hunter: forced, target: doctrineChooser({ name: foe, rules: cfg.templates[foe] } as Doctrine, { enemyType: "player" }) } });
  const before = (r as any).rounds[k - 2];
  return { value: scoreOf(verdictFor(r, "hunter")) + 0.05 * shareLead(r, "hunter"), rounds: r.rounds.length, grappledAtK: !!before && before.rangeAfter === "grappled" };
}

const out: any[] = [];
for (const k of (cfg.ks ?? [1, 2, 3, 4])) {
  // Skip a situation the battle never reaches: the doctrine's own battles must still be going at round k.
  let alive = 0;
  const seedsK: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = fight(null, k, seedFor(`sit/${me}/${foe}/${cfg.scene}`, i));
    if (b.rounds >= k) alive++;
    if (b.rounds >= k && (!cfg.grappledOnly || b.grappledAtK)) seedsK.push(i);
  }
  if (cfg.grappledOnly ? seedsK.length < 30 : alive < n * 0.5) continue;
  const values = plays.map((p) => seedsK.map((i) => fight(p, k, seedFor(`sit/${me}/${foe}/${cfg.scene}`, i)).value));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const means = values.map(mean);
  const spread = Math.max(...means) - Math.min(...means);
  if (spread < 0.1) { out.push({ k, matters: false }); continue; }
  const bestOf = (keep: (p: any) => boolean) => { let bi = -1; plays.forEach((p, i) => { if (keep(p) && (bi < 0 || means[i]! > means[bi]!)) bi = i; }); return bi; };
  const clearly = (bi: number, rivals: number[]) => rivals.every((ri) => {
    if (ri < 0 || ri === bi) return true;
    const d = values[bi]!.map((v, i) => v - values[ri]![i]!);
    const m = mean(d), sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (d.length - 1));
    return m > 2 * (sd / Math.sqrt(d.length));
  });
  const top = bestOf(() => true);
  const tp = plays[top]!;
  const helmRivals = HELM.filter((h) => h !== tp.helm).map((h) => bestOf((p) => p.helm === h));
  const ordRivals = ORDERS.filter((o) => o !== tp.guns).map((o) => bestOf((p) => p.guns === o));
  out.push({ k, seeds: seedsK.length, matters: true, top: tp, clearHelm: clearly(top, helmRivals) ? tp.helm : null, clearOrder: clearly(top, ordRivals) ? tp.guns : null });
  if (cfg.debug) out[out.length - 1].byOrder = Object.fromEntries(ORDERS.map((o) => { const i = bestOf((p) => p.guns === o); return [o, Math.round(1000 * means[i]!) / 1000 + " " + plays[i]!.helm]; }));
}
console.log(JSON.stringify({ me, foe, scene: cfg.scene, rows: out }));
