// Check 5 of GAMEPLAY 8.9 (P3.1, P3.B3): Old Shellback is beatable by a fresh sloop with a good doctrine, for every Fighting Style.
//
// A fresh level 0 sloop that really has the style lies in wait in the Narrows on Tide 6 and the real Tide loop does the rest, so
// the escape roll, the Truce, the fixed Helm score and "beaten" (being on the winning side of a battle that has a winner, D105)
// are all the game's own. "A good doctrine" is found, not guessed, and found once for each style: a search over doctrines that
// captain can really save (three rules with conditions and an Otherwise, validated like save_doctrine) writing only the Guns orders
// that style can give, Deck orders included (plays.ts: the Mortar for the Bombardier, Hot Shot and Fire Pots for the Firebrand). It
// starts from the seven templates, the Crabber of the P2.6 notes and random doctrines, keeps the best by fights won, judges the
// finalists again on fresh fights, and confirms the winner on fights nobody has seen. The reported number is that last one, so the
// search cannot flatter itself. The check passes when every style of the wheel is from 35% to 80% (D140, replacing the single
// band of 40% to 60%). The Smuggler is searched too and reported, but it is not judged.
//
// Old Shellback has no style, so a "their style is X" condition never holds against him, and the search does not write one. He is the
// reworked boss of docs/specs/fighting-styles.md section 7 (P3.B2 piece 3): his shell, his seeded rear up, the claw snatch, and a retreat
// into his shell that beats him. Nothing here knows his rules: the fight is the Tide loop and "beaten" is `bossesBeaten`.
//
// Alongside it: the templates and the Crabber for each style on the confirming fights, and the gate pace of GAMEPLAY 2.5 (the
// median captain passes by Tide 7 to 9, nobody later than Tide 12) worked out from the win chance on each Tide, with one fight a
// Tide (D108). The gate pace is a measurement, not a verdict: it uses the best doctrine found for the style that beat him most, and
// that style's own template as the starting doctrine.

import {
  Rng, TEMPLATE_NAMES, styleTemplate, templateDoctrine, validateDoctrine,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, FightingStyle } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { FIGHTING_STYLES } from "./arena.ts";
import { chunked } from "./chunks.ts";
import type { Effort } from "./effort.ts";
import { emptyBoss, mergeBoss } from "./jobs.ts";
import type { BossJob, BossResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { mutateDoctrine, randomDoctrine } from "./plans.ts";
import type { DoctrineSpace } from "./plans.ts";
import { ordersFor } from "./plays.ts";
import { share, wilson } from "./stats.ts";

export const BOSS_LOW = 0.35; // D140: every style's best doctrine beats him 35% to 80% of the time
export const BOSS_HIGH = 0.8;
export const BOSS_TIDE = 6; // the Tide of the challenge; his Hull is still 300
export const SLOTS = 3; // rules with conditions a new captain can save (D64)
const PART = 100; // fights in one job, so a long run of fights spreads over every worker

/**
 * The Crabber of the P2.6 notes: Close In, a Round shot in round 3, Grapeshot once the claws are on, else Cross Their Bow. Round 3 is the
 * middle of the rounds he may rear up in (2, 3 or 4, D202), so the Crabber is a plain reference plan for the search to beat, not a
 * plan for his habits; Cross Their Bow is the move he snatches (D206).
 */
export const crabber = (): Doctrine => ({
  name: "Crabber",
  rules: [
    { if: [{ kind: "round", op: "is", n: 3 }], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: { kind: "fight", helm: "closeIn", guns: "grapeshot" } },
    { if: [], then: { kind: "fight", helm: "crossTheirBow", guns: "roundShot" } },
  ],
});

/** What the search for a style may write: the orders its fresh sloop can give, and no style test (he has no style). */
export const spaceFor = (style: FightingStyle): DoctrineSpace => ({ orders: ordersFor({ style }, "grappled"), styles: [] });

export interface Scored {
  doctrine: Doctrine;
  result: BossResult;
  seeds: number;
  /** Fights won. */
  rate: number;
}

function scored(doctrine: Doctrine, result: Scored["result"], seeds: number): Scored {
  return { doctrine, result, seeds, rate: share(result.beaten, seeds) };
}

/** One doctrine to score: its fights on a Tide, drawn from the seeds of `label`. */
interface Entry {
  doctrine: Doctrine;
  tide: number;
  label: string;
  seeds: number;
}

/**
 * Scores every entry for a style in one go. Each entry's fights are cut into parts so a long run spreads over every worker, and the
 * whole lot is one call to the pool, which runs one call at a time.
 */
async function scoreAll(pool: Pool, style: FightingStyle, entries: Entry[]): Promise<Scored[]> {
  const jobs = entries.flatMap((e) => chunked(e.seeds, PART).map((p): BossJob => ({ doctrine: e.doctrine, ship: { style }, tide: e.tide, label: e.label, from: p.from, count: p.count })));
  const results = await pool.run("boss", jobs);
  let at = 0;
  return entries.map((e) => {
    const total = emptyBoss();
    for (let p = 0; p < chunked(e.seeds, PART).length; p++) mergeBoss(total, results[at++]!);
    return scored(e.doctrine, total, e.seeds);
  });
}

/** Scores doctrines for a style on the same fights. */
const score = (pool: Pool, style: FightingStyle, doctrines: Doctrine[], tide: number, label: string, seeds: number): Promise<Scored[]> =>
  scoreAll(pool, style, doctrines.map((doctrine) => ({ doctrine, tide, label, seeds })));

/** Fights won, with the damage lead to break ties between doctrines that win equally often. */
const objective = (s: Scored): number => s.rate + 0.1 * (s.result.lead / s.seeds);

export interface SearchTrace {
  generation: number;
  best: number; // the best objective of the generation
  bestRate: number;
}

/** The search for one style. */
export interface StyleBoss {
  style: FightingStyle;
  /** The Smuggler's row is reported and not judged. */
  judged: boolean;
  best: Scored; // confirmed on fights the search never saw
  finalists: Scored[]; // judged on the held out fights
  references: Scored[]; // the templates and the Crabber, on the same fights as `best`
  trace: SearchTrace[];
}

async function searchStyle(pool: Pool, effort: Effort, style: FightingStyle, judged: boolean): Promise<StyleBoss> {
  const B = effort.boss;
  const space = spaceFor(style);
  const rng = new Rng(`p3/boss/search/${style}`);
  const trace: SearchTrace[] = [];

  let population: Doctrine[] = [
    ...TEMPLATE_NAMES.map((n) => templateDoctrine(n)),
    crabber(),
    ...Array.from({ length: B.random }, (_, i) => randomDoctrine(rng, `r${i}`, SLOTS, space)),
  ];
  let ranked: Scored[] = [];
  for (let g = 0; g <= B.generations; g++) {
    ranked = (await score(pool, style, population, BOSS_TIDE, `boss/${style}/search/${g}`, B.searchSeeds)).sort((a, b) => objective(b) - objective(a));
    trace.push({ generation: g, best: objective(ranked[0]!), bestRate: ranked[0]!.rate });
    if (g === B.generations) break;
    const parents = ranked.slice(0, B.keep).map((s) => s.doctrine);
    population = [...parents];
    parents.forEach((p, pi) => {
      for (let m = 0; m < B.perParent; m++) population.push(mutateDoctrine(rng, p, `g${g + 1}p${pi}m${m}`, SLOTS, space));
    });
  }
  const finalists = (await score(pool, style, ranked.slice(0, B.finalists).map((s) => s.doctrine), BOSS_TIDE, `boss/${style}/heldout`, B.heldOut)).sort((a, b) => objective(b) - objective(a));
  const winner = finalists[0]!.doctrine;
  const [best] = await score(pool, style, [winner], BOSS_TIDE, `boss/${style}/confirm`, B.confirm);
  if (validateDoctrine(winner, { slots: SLOTS }).length > 0) throw new Error("The search made a doctrine a captain could not save");
  const references = await score(pool, style, [...TEMPLATE_NAMES.map((n) => templateDoctrine(n)), crabber()], BOSS_TIDE, `boss/${style}/confirm`, B.reference);
  return { style, judged, best: best!, finalists, references, trace };
}

export interface BossData {
  /** The six styles of the wheel in order, then the Smuggler. */
  styles: StyleBoss[];
  /** The style whose best doctrine beat him most, which the gate pace is measured for. */
  paceStyle: FightingStyle;
  /** Win chance of that style's best doctrine and of its own template on each Tide, from the first Tide he can be fought. */
  pace: { tide: number; best: number; starter: number }[];
  gate: GatePace;
}

export async function runBoss(pool: Pool, effort: Effort): Promise<BossData> {
  const B = effort.boss;
  const styles: StyleBoss[] = [];
  for (const { style } of FIGHTING_STYLES) styles.push(await searchStyle(pool, effort, style, true));
  styles.push(await searchStyle(pool, effort, "smuggler", false));

  const top = styles.filter((s) => s.judged).reduce((a, b) => (b.best.rate > a.best.rate ? b : a));
  const winner = top.best.doctrine;
  const starter = templateDoctrine(styleTemplate(top.style));
  // Gate pace: the win chance on each Tide, for the best doctrine and for the starting doctrine.
  const tides = Array.from({ length: 10 }, (_, i) => 5 + i); // Tide 5 to 14
  const scoredByTide = await scoreAll(pool, top.style, tides.flatMap((tide) => [winner, starter].map((doctrine): Entry => ({ doctrine, tide, label: `boss/pace/${tide}`, seeds: B.gateSeeds }))));
  const pace = tides.map((tide, i) => ({ tide, best: scoredByTide[2 * i]!.rate, starter: scoredByTide[2 * i + 1]!.rate }));
  const gate = gatePace(pace.map((p) => p.best), tides[0]!);
  return { styles, paceStyle: top.style, pace, gate };
}

// ---------- The gate pace (2.5, D108) ----------

export interface GatePace {
  captains: number;
  firstTide: number;
  /** Averaged over many seasons: the Tide the median captain and the last captain pass. */
  medianTide: number;
  lastTide: number;
  /** Seasons where the last captain passed by Tide 12. */
  lastByTwelve: number;
}

const CAPTAINS = 6;
const SEASONS = 4000;

/**
 * Six captains who are all at the gate from `firstTide`, each with the same chance to win a fight on each Tide, `chance[tide - firstTide]`
 * (the last one holds for later Tides). One fight a Tide (D81, D108): one captain who has not passed yet, at random, fights him.
 * A captain who wins passes and leaves the queue. A loser goes to the back of it at once, which is kinder than the real tow home.
 */
export function gatePace(chance: readonly number[], firstTide: number, captains = CAPTAINS, seasons = SEASONS): GatePace {
  const rng = new Rng("p3/boss/gate");
  let median = 0;
  let last = 0;
  let byTwelve = 0;
  for (let s = 0; s < seasons; s++) {
    const waiting = Array.from({ length: captains }, (_, i) => i);
    const passed: number[] = [];
    for (let tide = firstTide; waiting.length > 0 && tide < firstTide + 200; tide++) {
      const p = chance[Math.min(chance.length - 1, tide - firstTide)] ?? 0;
      const at = Math.floor(rng.next() * waiting.length);
      if (rng.next() < p) { waiting.splice(at, 1); passed.push(tide); }
    }
    passed.sort((a, b) => a - b);
    median += passed[Math.ceil(captains / 2) - 1] ?? firstTide + 200;
    last += passed[captains - 1] ?? firstTide + 200;
    if ((passed[captains - 1] ?? Infinity) <= 12) byTwelve++;
  }
  return { captains, firstTide, medianTide: median / seasons, lastTide: last / seasons, lastByTwelve: byTwelve / seasons };
}

// ---------- Judgement ----------

export interface BossRow {
  style: FightingStyle;
  judged: boolean;
  rate: number;
  range: [number, number];
  ok: boolean;
  best: Scored;
}

export interface BossVerdict {
  pass: boolean;
  rows: BossRow[];
}

export function judgeBoss(data: BossData): BossVerdict {
  const rows = data.styles.map((s): BossRow => {
    const rate = s.best.rate;
    return { style: s.style, judged: s.judged, rate, range: wilson(s.best.result.beaten, s.best.seeds), ok: rate >= BOSS_LOW && rate <= BOSS_HIGH, best: s.best };
  });
  return { pass: rows.filter((r) => r.judged).every((r) => r.ok), rows };
}
