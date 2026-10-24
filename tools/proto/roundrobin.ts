// SCRATCH ONLY. All four templates against each other on the boarding prototype.
// Usage: node tools/proto/roundrobin.ts '<json config>'
// Config: { label, set: {...}, variant: "plain"|"adapt"|"smart", drill: 0, n: 200 }

import { B, battleShipOf, doctrineChooser, runBattle, templateDoctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, DoctrineRule } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor, verdictFor } from "../v3/sim/arena.ts";
import type { Scene } from "../v3/sim/arena.ts";

interface Config { label?: string; set?: Record<string, number>; variant?: "plain" | "adapt" | "smart" | "counter" | "counter2"; drill?: number; n?: number }
const cfg: Config = JSON.parse(process.argv[2] ?? "{}");
const n = cfg.n ?? 200;
const drill = cfg.drill ?? 0;
const variant = cfg.variant ?? "adapt";

function setPath(path: string, value: number): void {
  const keys = path.split(".");
  let holder: any = B;
  for (const k of keys.slice(0, -1)) holder = holder[k];
  if (typeof holder[keys[keys.length - 1]!] !== "number") throw new Error(`No number at B.${path}`);
  holder[keys[keys.length - 1]!] = value;
}
for (const [k, v] of Object.entries(cfg.set ?? {})) setPath(k, v);

const fight = (helm: string, guns: string): any => ({ kind: "fight", helm, guns });
const when = (...c: any[]): any[] => c;
const grappled = { kind: "range", op: "is", range: "grappled" };
const rule = (c: any[], then: any): DoctrineRule => ({ if: c, then }) as DoctrineRule;
const theirs = (order: string) => ({ kind: "theirLastGuns", order });

const NAMES = ["Brawler", "Skirmisher", "Runner", "Coward"] as const;
type Name = (typeof NAMES)[number];

function brawlerNew(): Doctrine {
  const strongest = drill >= B.proto.fireAt ? "firePots" : "volley";
  return {
    name: "Brawler",
    rules: [
      rule(when(grappled, theirs("repel")), fight("hold", strongest)),
      rule(when(grappled), fight("hold", "charge")),
      rule(when({ kind: "range", op: "is", range: "close" }), fight("closeIn", "board")),
      rule([], fight("closeIn", "roundShot")),
    ],
  } as Doctrine;
}

function counterRules(helm: string): DoctrineRule[] {
  // The cycle: Repel beats Charge, Charge beats Volley, Volley beats Repel. First round: guess Charge.
  return [
    rule(when(grappled, theirs("charge")), fight(helm, "repel")),
    rule(when(grappled, theirs("volley")), fight(helm, "charge")),
    rule(when(grappled, theirs("repel")), fight(helm, "volley")),
  ];
}

function doctrineOf(name: Name): Doctrine {
  if (name === "Brawler") return brawlerNew();
  const d = templateDoctrine(name);
  if (variant === "plain" || name === "Runner" && (variant === "adapt" || variant === "counter" || variant === "counter2")) return d;
  if (variant === "adapt" || variant === "counter" || variant === "counter2") {
    const grab = rule(when(grappled), fight("openRange", "repel"));
    // counter: a Skirmisher that kites, opening the range whenever the ships are at Short or nearer
    const kite = rule(when({ kind: "range", op: "atMost", range: "short" }), fight("openRange", variant === "counter2" ? "roundShot" : "chainShot"));
    if (name === "Skirmisher") return { ...d, rules: variant === "counter" || variant === "counter2" ? [grab, kite, ...d.rules] : [grab, ...d.rules] };
    return { ...d, rules: [d.rules[0]!, grab, ...d.rules.slice(1)] }; // Coward: surrender check first
  }
  // smart: every template plays the cycle when grappled
  const helm = name === "Coward" ? "hold" : "openRange";
  const extra = [...counterRules(helm), rule(when(grappled), fight(helm, "charge"))];
  if (name === "Coward") return { ...d, rules: [d.rules[0]!, ...extra, ...d.rules.slice(1)] };
  return { ...d, rules: [...extra, ...d.rules] };
}

function duel(h: Name, t: Name, scene: Scene, seed: number) {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags);
  for (const s of [hs, ts]) { s.drill = drill; s.pots = drill >= B.proto.fireAt ? B.proto.pots : 0; }
  hs.style = h; ts.style = t;
  const hd = doctrineOf(h), td = doctrineOf(t);
  hd.name = `${h}-h`; td.name = `${t}-t`;
  return runBattle({
    tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
    hunter: hs, target: ts,
    doctrines: { hunter: hd.name, target: td.name },
    choosers: { hunter: doctrineChooser(hd, { enemyType: "player" }), target: doctrineChooser(td, { enemyType: "player" }) },
    ...(scene.ambush ? { ambush: scene.ambush } : {}),
  });
}

interface Tally { win: number; draw: number; escape: number; loss: number; total: number; captured: number; grappled: number; gRound: number }
const fresh = (): Tally => ({ win: 0, draw: 0, escape: 0, loss: 0, total: 0, captured: 0, grappled: 0, gRound: 0 });
const matrix: Record<string, Record<string, Tally>> = {};
for (const a of NAMES) { matrix[a] = {}; for (const b of NAMES) if (a !== b) matrix[a]![b] = fresh(); }

for (let ai = 0; ai < NAMES.length; ai++) {
  for (let bi = ai + 1; bi < NAMES.length; bi++) {
    const a = NAMES[ai]!, b = NAMES[bi]!;
    for (const scene of SCENES) {
      for (const seat of ["hunter", "target"] as const) {
        for (let i = 0; i < n; i++) {
          const seed = seedFor(`rr/${a}/${b}/${scene.name}/${seat}`, i);
          const rec = seat === "hunter" ? duel(a, b, scene, seed) : duel(b, a, scene, seed);
          const aSide = seat === "hunter" ? "hunter" : "target";
          const va = verdictFor(rec, aSide as any);
          const vb = verdictFor(rec, (aSide === "hunter" ? "target" : "hunter") as any);
          const cap = rec.outcome.kind === "captured" ? 1 : 0;
          const gi = ((rec as any).rounds ?? []).findIndex((r: any) => r.rangeAfter === "grappled");
          const grap = gi >= 0 ? 1 : 0;
          for (const [x, y, v] of [[a, b, va], [b, a, vb]] as const) {
            const t = matrix[x]![y]!;
            t[v] += 1; t.total += 1; t.captured += cap; t.grappled += grap; if (gi >= 0) t.gRound += gi + 1;
          }
        }
      }
    }
  }
}

const pct = (x: number, d: number) => Math.round((1000 * x) / d) / 10;
const out: any = { label: cfg.label ?? "", variant, drill, n, matrix: {}, field: {}, fieldLoss: {}, capture: {}, grappled: {}, gRound: {}, escapes: {} };
for (const a of NAMES) {
  out.matrix[a] = {};
  let w = 0, l = 0, tot = 0, c = 0, g = 0, gr = 0, es = 0;
  for (const b of NAMES) {
    if (a === b) continue;
    const t = matrix[a]![b]!;
    out.matrix[a][b] = { win: pct(t.win, t.total), draw: pct(t.draw, t.total), escape: pct(t.escape, t.total), loss: pct(t.loss, t.total) };
    w += t.win; l += t.loss; tot += t.total; c += t.captured; g += t.grappled; gr += t.gRound; es += t.escape;
  }
  out.field[a] = pct(w, tot);
  out.fieldLoss[a] = pct(l, tot);
  out.capture[a] = pct(c, tot);
  out.grappled[a] = pct(g, tot);
  out.gRound[a] = g ? Math.round((10 * gr) / g) / 10 : 0;
  out.escapes[a] = pct(es, tot);
}
console.log(JSON.stringify(out));
