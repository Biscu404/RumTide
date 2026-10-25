// Check 5 of GAMEPLAY 8.9 (P3.1): Old Shellback is beatable by a fresh sloop with a good doctrine, about half the time.
//
// A fresh level 0 sloop lies in wait in the Narrows on Tide 6 and the real Tide loop does the rest, so the escape roll, the
// Truce, the fixed Helm score and "beaten" (being on the winning side of a battle that has a winner, D105) are all the
// game's own. "A good doctrine" is found, not guessed: a search over doctrines a new captain can really save (three rules
// with conditions and an Otherwise, validated like save_doctrine) keeps the best by fights won, the finalists are judged
// again on fresh fights, and the winner is confirmed on fights nobody has seen. The reported number is that last one, so the
// search cannot flatter itself. The check passes when it is from 40% to 60%.
//
// Alongside it: the four templates, the Crabber of the P2.6 notes, and the gate pace of GAMEPLAY 2.5 (the median captain
// passes by Tide 7 to 9, nobody later than Tide 12) worked out from the win chance on each Tide. D108 decided that he fights
// every captain who reaches him each Tide, and the pace under the old one fight a Tide is printed beside it.

import { Rng, TEMPLATE_NAMES, templateDoctrine, validateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Effort } from "./effort.ts";
import type { BossJob, BossResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { mutateDoctrine, randomDoctrine } from "./plans.ts";
import { share, wilson } from "./stats.ts";

export const BOSS_LOW = 0.4; // "about half the time", ten points either side
export const BOSS_HIGH = 0.6;
export const BOSS_TIDE = 6; // the Tide of the challenge; his Hull is still 300
export const SLOTS = 3; // rules with conditions a new captain can save (D64)

/** The Crabber of the P2.6 notes: Close In, a Round shot when he rears up, Grapeshot once the claws are on, else Cross Their Bow. */
export const crabber = (): Doctrine => ({
  name: "Crabber",
  rules: [
    { if: [{ kind: "round", op: "is", n: 3 }], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: { kind: "fight", helm: "closeIn", guns: "grapeshot" } },
    { if: [], then: { kind: "fight", helm: "crossTheirBow", guns: "roundShot" } },
  ],
});

export interface Scored {
  doctrine: Doctrine;
  result: BossResult;
  seeds: number;
  /** Fights won. */
  rate: number;
}

const job = (doctrine: Doctrine, tide: number, label: string, count: number): BossJob => ({ doctrine, tide, label, from: 0, count });

function scored(doctrine: Doctrine, result: BossResult, seeds: number): Scored {
  return { doctrine, result, seeds, rate: share(result.beaten, seeds) };
}

/** Scores doctrines on the same fights; the lead breaks ties between doctrines that win equally often. */
async function score(pool: Pool, doctrines: Doctrine[], tide: number, label: string, seeds: number): Promise<Scored[]> {
  const results = await pool.run("boss", doctrines.map((d) => job(d, tide, label, seeds)));
  return doctrines.map((d, i) => scored(d, results[i]!, seeds));
}

const objective = (s: Scored): number => s.rate + 0.1 * (s.result.lead / s.seeds);

export interface SearchTrace {
  generation: number;
  best: number; // the best objective of the generation
  bestRate: number;
}

export interface BossData {
  best: Scored; // confirmed on fights the search never saw
  finalists: Scored[]; // judged on the held out fights
  references: Scored[]; // the templates and the Crabber, on the same fights as `best`
  trace: SearchTrace[];
  /** Win chance of the best doctrine and of the starting Brawler on each Tide, from the first Tide he can be fought. */
  pace: { tide: number; best: number; brawler: number }[];
  /** Every captain at his door fights him each Tide, each against a whole Old Shellback (D108 as decided in P3.2). */
  gate: GatePace;
  /** The same win chances with one fight a Tide, as P2.6 built it: a queue. */
  queue: GatePace;
}

export async function runBoss(pool: Pool, effort: Effort): Promise<BossData> {
  const B = effort.boss;
  const rng = new Rng("p3/boss/search");
  const trace: SearchTrace[] = [];

  let population: Doctrine[] = [
    ...TEMPLATE_NAMES.map((n) => templateDoctrine(n)),
    crabber(),
    ...Array.from({ length: B.random }, (_, i) => randomDoctrine(rng, `r${i}`, SLOTS)),
  ];
  let ranked: Scored[] = [];
  for (let g = 0; g <= B.generations; g++) {
    ranked = (await score(pool, population, BOSS_TIDE, `boss/search/${g}`, B.searchSeeds)).sort((a, b) => objective(b) - objective(a));
    trace.push({ generation: g, best: objective(ranked[0]!), bestRate: ranked[0]!.rate });
    if (g === B.generations) break;
    const parents = ranked.slice(0, B.keep).map((s) => s.doctrine);
    population = [...parents];
    parents.forEach((p, pi) => {
      for (let m = 0; m < B.perParent; m++) population.push(mutateDoctrine(rng, p, `g${g + 1}p${pi}m${m}`, SLOTS));
    });
  }
  const finalists = (await score(pool, ranked.slice(0, B.finalists).map((s) => s.doctrine), BOSS_TIDE, "boss/heldout", B.heldOut)).sort((a, b) => objective(b) - objective(a));
  const winner = finalists[0]!.doctrine;
  const [best] = await score(pool, [winner], BOSS_TIDE, "boss/confirm", B.confirm);
  if (validateDoctrine(winner, { slots: SLOTS }).length > 0) throw new Error("The search made a doctrine a captain could not save");

  const referenceDoctrines = [...TEMPLATE_NAMES.map((n) => templateDoctrine(n)), crabber()];
  const references = await score(pool, referenceDoctrines, BOSS_TIDE, "boss/confirm", B.reference);

  // Gate pace: the win chance on each Tide, for the best doctrine and for the starting Brawler.
  const tides = Array.from({ length: 10 }, (_, i) => 5 + i); // Tide 5 to 14
  const bestByTide = await Promise.all(tides.map((t) => score(pool, [winner], t, `boss/pace/${t}`, B.gateSeeds)));
  const brawlerByTide = await Promise.all(tides.map((t) => score(pool, [templateDoctrine("Brawler")], t, `boss/pace/${t}`, B.gateSeeds)));
  const pace = tides.map((tide, i) => ({ tide, best: bestByTide[i]![0]!.rate, brawler: brawlerByTide[i]![0]!.rate }));
  const chances = pace.map((p) => p.best);
  const gate = gatePace(chances, tides[0]!, CAPTAINS, SEASONS, CAPTAINS);
  const queue = gatePace(chances, tides[0]!, CAPTAINS, SEASONS, 1);
  return { best: best!, finalists, references, trace, pace, gate, queue };
}

// ---------- The gate pace (2.5, D108) ----------

export interface GatePace {
  /** Fights he takes in a Tide: 1 is a queue, and as many as there are captains is "every captain who reaches him". */
  fightsPerTide: number;
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
 * (the last one holds for later Tides). He takes `fightsPerTide` fights a Tide, against captains who have not passed yet, picked at
 * random (D108): with 1 that is the queue P2.6 built, and with as many as there are captains each one fights him every Tide, each
 * fight against a whole Old Shellback. A captain who wins passes. A loser tries again next Tide, which is kinder than the real tow
 * home and the sail back, so the pace is the best the gate can do.
 */
export function gatePace(chance: readonly number[], firstTide: number, captains = CAPTAINS, seasons = SEASONS, fightsPerTide = 1): GatePace {
  const rng = new Rng("p3/boss/gate");
  let median = 0;
  let last = 0;
  let byTwelve = 0;
  for (let s = 0; s < seasons; s++) {
    const waiting = Array.from({ length: captains }, (_, i) => i);
    const passed: number[] = [];
    for (let tide = firstTide; waiting.length > 0 && tide < firstTide + 200; tide++) {
      const p = chance[Math.min(chance.length - 1, tide - firstTide)] ?? 0;
      const left = [...waiting];
      const fighters: number[] = [];
      const fights = Math.min(fightsPerTide, left.length);
      for (let i = 0; i < fights; i++) fighters.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
      for (const captain of fighters) {
        if (rng.next() >= p) continue;
        waiting.splice(waiting.indexOf(captain), 1);
        passed.push(tide);
      }
    }
    passed.sort((a, b) => a - b);
    median += passed[Math.ceil(captains / 2) - 1] ?? firstTide + 200;
    last += passed[captains - 1] ?? firstTide + 200;
    if ((passed[captains - 1] ?? Infinity) <= 12) byTwelve++;
  }
  return { fightsPerTide, captains, firstTide, medianTide: median / seasons, lastTide: last / seasons, lastByTwelve: byTwelve / seasons };
}

// ---------- Judgement ----------

export interface BossVerdict {
  pass: boolean;
  rate: number;
  range: [number, number];
  best: Scored;
}

export function judgeBoss(data: BossData): BossVerdict {
  const rate = data.best.rate;
  return { pass: rate >= BOSS_LOW && rate <= BOSS_HIGH, rate, range: wilson(data.best.result.beaten, data.best.seeds), best: data.best };
}
