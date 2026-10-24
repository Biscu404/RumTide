// SCRATCH ONLY. The six Fighting Styles (and the Smuggler) against each other on six distances.
// Usage: LADDER=6 node tools/proto/styles.ts '<json config>'
// Config: { label, set: {...}, drill: 0, n: 60, only?: string[] (styles to include), templates?: { [style]: rules } }

import { B, battleShipOf, doctrineChooser, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, DoctrineRule } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor, verdictFor } from "../v3/sim/arena.ts";
import type { Scene } from "../v3/sim/arena.ts";

const cfg = JSON.parse(process.argv[2] ?? "{}");
const n: number = cfg.n ?? 60;
const drill: number = cfg.drill ?? 0;
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) {
  const keys = path.split(".");
  let h: any = B;
  for (const k of keys.slice(0, -1)) h = h[k];
  if (typeof h[keys[keys.length - 1]!] !== "number") throw new Error(`No number at B.${path}`);
  h[keys[keys.length - 1]!] = value;
}

const fight = (helm: string, guns: string): any => ({ kind: "fight", helm, guns });
const r = (c: any[], then: any): DoctrineRule => ({ if: c, then }) as DoctrineRule;
const range = (op: string, rg: string) => ({ kind: "range", op, range: rg });
const G = range("is", "grappled");
const theirGuns = (order: string) => ({ kind: "theirLastGuns", order });
const track = (who: string, t: string, op: string, pct: number) => ({ kind: "track", who, track: t, op, pct });
const surrender = { kind: "surrender" };

// Starting doctrines: at most 3 rules with conditions, then Otherwise (the base slots, D64).
const TEMPLATES: Record<string, DoctrineRule[]> = {
  Bombardier: [
    r([G], fight("openRange", "repel")),
    r([range("atMost", "short")], fight("openRange", "roundShot")),
    r([range("is", "medium")], fight("openRange", "mortar")),
    r([], fight("hold", "mortar")),
  ],
  Gunline: [
    r([G], fight("openRange", "repel")),
    r([range("atMost", "short")], fight("hold", "grapeshot")),
    r([range("atLeast", "long")], fight("closeIn", "roundShot")),
    r([], fight("hold", "roundShot")),
  ],
  Skirmisher: [
    r([G], fight("openRange", "repel")),
    r([range("atMost", "close")], fight("openRange", "roundShot")),
    r([range("atLeast", "medium")], fight("closeIn", "chainShot")),
    r([], fight("crossTheirBow", "roundShot")),
  ],
  Rammer: [
    r([G], fight("openRange", "repel")),
    r([], fight("closeIn", "roundShot")),
  ],
  Boarder: [
    r([G, theirGuns("repel")], fight("hold", "volley")),
    r([G], fight("hold", "charge")),
    r([range("atMost", "short")], fight("closeIn", "board")),
    r([], fight("closeIn", "roundShot")),
  ],
  Firebrand: [
    r([G], fight("hold", "firePots")),
    r([], fight("closeIn", "hotShot")),
  ],
  Smuggler: [
    r([track("mine", "hull", "below", 40)], surrender),
    r([G], fight("openRange", "repel")),
    r([], fight("openRange", "chainShot")),
  ],
};
for (const [k, v] of Object.entries(cfg.templates ?? {})) TEMPLATES[k] = v as DoctrineRule[];

const ALL = ["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand", "Smuggler"];
const NAMES: string[] = cfg.only ?? ALL;

function duel(h: string, t: string, scene: Scene, seed: number) {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  // invest: the same number of upgrade levels for everyone, spent where each style wants them. The Boarder buys Drill.
  const L: number = cfg.invest ?? 0;
  const KEY: Record<string, string> = { Bombardier: "cannons", Gunline: "cannons", Skirmisher: "cannons", Rammer: "hull", Firebrand: "cannons", Smuggler: "sails" };
  // investSpec: the levels each non Boarder style buys with the gold of the Boarder's Drill (an explicit build per style).
  const levelsFor = (st: string) => (cfg.investSpec && st !== "Boarder" ? { levels: cfg.investSpec[st] ?? cfg.investSpec.default } : L > 0 && KEY[st] ? { levels: { [KEY[st]!]: L } as any } : {});
  const hs: any = battleShipOf(buildShip("a", levelsFor(h)), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b", levelsFor(t)), { id: "cap_b" }, "target", flags);
  for (const [s, st] of [[hs, h], [ts, t]] as const) {
    s.style = st;
    s.drill = (st === "Boarder" || cfg.drillAll ? drill : 0) + (st === "Boarder" && L > 0 ? L : 0) + (st === "Boarder" && cfg.investSpec ? cfg.investDrill : 0);
    if (st === "Bombardier") { s.maxHands = Math.round(s.maxHands * B.proto.bombHands); s.hands = s.maxHands; } // the mortar takes deck space
    s.pots = st === "Firebrand" ? B.proto.firebrandPots : s.drill >= B.proto.fireAt && st === "Boarder" ? B.proto.pots : 0;
  }
  const hd = { name: `${h}-h`, rules: TEMPLATES[h] } as Doctrine;
  const td = { name: `${t}-t`, rules: TEMPLATES[t] } as Doctrine;
  return runBattle({
    tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
    hunter: hs, target: ts,
    doctrines: { hunter: hd.name, target: td.name },
    choosers: { hunter: doctrineChooser(hd, { enemyType: "player" }), target: doctrineChooser(td, { enemyType: "player" }) },
    ...(scene.ambush ? { ambush: scene.ambush } : {}),
  });
}

type T = { win: number; draw: number; escape: number; loss: number; total: number; kinds: Record<string, number> };
const fresh = (): T => ({ win: 0, draw: 0, escape: 0, loss: 0, total: 0, kinds: {} });
const m: Record<string, Record<string, T>> = {};
for (const a of NAMES) { m[a] = {}; for (const b of NAMES) if (a !== b) m[a]![b] = fresh(); }

for (let ai = 0; ai < NAMES.length; ai++) {
  for (let bi = ai + 1; bi < NAMES.length; bi++) {
    const a = NAMES[ai]!, b = NAMES[bi]!;
    for (const scene of SCENES) {
      for (const seat of ["hunter", "target"] as const) {
        for (let i = 0; i < n; i++) {
          const rec = seat === "hunter" ? duel(a, b, scene, seedFor(`st/${a}/${b}/${scene.name}/h`, i)) : duel(b, a, scene, seedFor(`st/${a}/${b}/${scene.name}/t`, i));
          const aSide = seat === "hunter" ? "hunter" : "target";
          const bSide = aSide === "hunter" ? "target" : "hunter";
          for (const [x, y, side] of [[a, b, aSide], [b, a, bSide]] as const) {
            const v = verdictFor(rec, side as any);
            const t = m[x]![y]!;
            t[v] += 1; t.total += 1;
            const k = `${rec.outcome.kind}:${rec.outcome.winner === side ? "me" : rec.outcome.winner === null ? "-" : "them"}`;
            t.kinds[k] = (t.kinds[k] ?? 0) + 1;
          }
        }
      }
    }
  }
}

const pct = (x: number, d: number) => Math.round((1000 * x) / d) / 10;
const out: any = { label: cfg.label ?? "", drill, n, matrix: {}, field: {}, draws: {} };
for (const a of NAMES) {
  out.matrix[a] = {};
  let w = 0, tot = 0, d = 0;
  for (const b of NAMES) {
    if (a === b) continue;
    const t = m[a]![b]!;
    out.matrix[a][b] = { win: pct(t.win, t.total), draw: pct(t.draw, t.total), escape: pct(t.escape, t.total), loss: pct(t.loss, t.total), kinds: Object.fromEntries(Object.entries(t.kinds).map(([k, v]) => [k, pct(v, t.total)])) };
    if (b !== "Smuggler") { w += t.win; tot += t.total; d += t.draw + t.escape; }
  }
  out.field[a] = pct(w, tot);
  out.draws[a] = pct(d, tot);
}
console.log(JSON.stringify(out));
