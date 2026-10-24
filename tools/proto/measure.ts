// SCRATCH ONLY. Measures the Brawler against the other three templates for one configuration of the boarding prototype.
// Usage: node tools/proto/measure.ts '<json config>'
// Config: { set: {"proto.deck":1,...}, brawler: "old"|"new", opps: "plain"|"adapt", drillB: 0, drillO: 0, n: 1000, label: "..." }

import { B, battleShipOf, doctrineChooser, runBattle, templateDoctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, DoctrineRule } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor, verdictFor } from "../v3/sim/arena.ts";
import type { Scene } from "../v3/sim/arena.ts";

interface Config {
  label?: string;
  set?: Record<string, number>;
  brawler?: "old" | "new";
  opps?: "plain" | "adapt";
  drillB?: number;
  drillO?: number;
  n?: number;
  scenes?: string[];
  only?: string; // one opponent
}

const cfg: Config = JSON.parse(process.argv[2] ?? "{}");
const n = cfg.n ?? 1000;

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

function brawlerDoctrine(kind: "old" | "new", drill: number): Doctrine {
  if (kind === "old") return templateDoctrine("Brawler");
  const strongest = drill >= B.proto.fireAt ? "firePots" : "volley";
  return {
    name: "Brawler (new)",
    rules: [
      // Against a crew that repels, Fire Pots ignore the pikes when it has them, else Volley.
      rule(when(grappled, { kind: "theirLastGuns", order: "repel" }), fight("hold", strongest)),
      rule(when(grappled), fight("hold", "charge")),
      rule(when({ kind: "range", op: "is", range: "close" }), fight("closeIn", "board")),
      rule([], fight("closeIn", "roundShot")),
    ],
  } as Doctrine;
}

function opponent(name: "Skirmisher" | "Runner" | "Coward", adapt: boolean): Doctrine {
  const d = templateDoctrine(name);
  if (!adapt || name === "Runner") return d;
  // An opponent that has learned the new fight: when grappled it tries to cut free and repels meanwhile.
  const grab = rule(when(grappled), fight("openRange", "repel"));
  if (name === "Skirmisher") return { ...d, rules: [grab, ...d.rules] };
  return { ...d, rules: [d.rules[0]!, grab, ...d.rules.slice(1)] }; // Coward: surrender check first
}

interface Side { name: string; doctrine: Doctrine; drill: number }

function duel(h: Side, t: Side, scene: Scene, seed: number) {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags);
  for (const [s, side] of [[hs, h], [ts, t]] as const) { s.drill = side.drill; s.pots = side.drill >= B.proto.fireAt ? B.proto.pots : 0; }
  return runBattle({
    tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
    hunter: hs, target: ts,
    doctrines: { hunter: h.doctrine.name, target: t.doctrine.name },
    choosers: { hunter: doctrineChooser(h.doctrine, { enemyType: "player" }), target: doctrineChooser(t.doctrine, { enemyType: "player" }) },
    ...(scene.ambush ? { ambush: scene.ambush } : {}),
  });
}

const scenes = cfg.scenes ? SCENES.filter((s) => cfg.scenes!.includes(s.name)) : SCENES;
const opps = (["Skirmisher", "Runner", "Coward"] as const).filter((o) => !cfg.only || cfg.only === o);
const out: any = { label: cfg.label ?? "", opps: {}, n };
let shareSum = 0;
for (const o of opps) {
  const me: Side = { name: "Brawler", doctrine: brawlerDoctrine(cfg.brawler ?? "old", cfg.drillB ?? 0), drill: cfg.drillB ?? 0 };
  const them: Side = { name: o, doctrine: opponent(o, cfg.opps === "adapt"), drill: cfg.drillO ?? 0 };
  const t = { win: 0, draw: 0, escape: 0, loss: 0, total: 0 };
  const kinds: Record<string, number> = {};
  for (const scene of scenes) {
    for (const seat of ["hunter", "target"] as const) {
      for (let i = 0; i < n; i++) {
        const seed = seedFor(`proto/${o}/${scene.name}/${seat}`, i);
        const rec = seat === "hunter" ? duel(me, them, scene, seed) : duel(them, me, scene, seed);
        const v = verdictFor(rec, seat);
        t[v] += 1; t.total += 1;
        const k = `${rec.outcome.kind}:${rec.outcome.winner === seat ? "me" : rec.outcome.winner === null ? "-" : "them"}`;
        kinds[k] = (kinds[k] ?? 0) + 1;
      }
    }
  }
  const r = (x: number) => Math.round((1000 * x) / t.total) / 10;
  out.opps[o] = { win: r(t.win), draw: r(t.draw), escape: r(t.escape), loss: r(t.loss), kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, r(v)])) };
  shareSum += t.win / t.total;
}
out.field = Math.round((1000 * shareSum) / opps.length) / 10;
console.log(JSON.stringify(out));
