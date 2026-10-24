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


import { runBoss } from "../v3/sim/jobs.ts";
const doc = brawlerDoctrine(cfg.brawler ?? "old", 0);
const r = runBoss({ doctrine: doc, tide: 6, label: `proto/boss/${cfg.label ?? ""}`, from: 0, count: n });
console.log(JSON.stringify({ label: cfg.label, beatenPct: Math.round((1000 * r.beaten) / n) / 10, kinds: Object.fromEntries(Object.entries(r.kinds).map(([k, v]) => [k, Math.round((1000 * v) / n) / 10])) }));
