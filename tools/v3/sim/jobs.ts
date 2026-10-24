// The jobs of the combat simulator (P3.1, P3.B3). A job is plain data that says what to fight, and a runner that fights it and
// returns plain numbers. Keeping them JSON means the same job runs on the main thread (tests) or on a worker (pool.ts).

import { BATTLE_SIDES, hash32, newSeason, resolveTide } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleRecord, BattleSide, Doctrine, Range } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { cradle, SIX_SHIPS_WIND } from "../sixShips.ts";
import { buildShip, duel, sceneByName, scoreOf, seedFor, shareLead, verdictFor } from "./arena.ts";
import type { Fighter, ShipSpec } from "./arena.ts";
import type { Play } from "./plays.ts";
import { addVerdict, emptyTally, mergeTally } from "./stats.ts";
import type { Tally } from "./stats.ts";

// ---------- Duels ----------

export interface DuelsJob {
  a: Fighter; // the hunter
  b: Fighter; // the target
  scene: string; // a name from SCENES
  label: string; // names the experiment, so its seeds are its own
  from: number; // first sample number
  count: number;
}

/** Cut Free contests tried, and how many of them the ship that tried won. */
export interface CutFreeCount {
  tries: number;
  wins: number;
}

export interface DuelsResult {
  tally: Tally; // from the hunter's point of view
  kinds: Record<string, number>; // how the battles ended, by outcome kind
  lead: number; // the hunter's damage share lead, summed over the battles
  rounds: number; // rounds fought, summed
  /**
   * Battles that ended Escaped, counted for the side that got away: the side whose ship played Open Range in the last round (the
   * record does not name who escaped). If both ran, both count.
   */
  ran: Record<BattleSide, number>;
  /**
   * The Cut Free contests of the battles, each tried by a Grappled ship that played Open Range. `held` are tries against a
   * boarder's edge (made by the ship that does not hold it, the edge being Lashed fast); `open` are tries when nobody holds the edge.
   */
  cutFree: { held: CutFreeCount; open: CutFreeCount };
}

export const emptyDuels = (): DuelsResult => ({
  tally: emptyTally(), kinds: {}, lead: 0, rounds: 0, ran: { hunter: 0, target: 0 },
  cutFree: { held: { tries: 0, wins: 0 }, open: { tries: 0, wins: 0 } },
});

/** Adds `from` into `into`. */
export function mergeDuels(into: DuelsResult, from: DuelsResult): DuelsResult {
  mergeTally(into.tally, from.tally);
  for (const [k, v] of Object.entries(from.kinds)) into.kinds[k] = (into.kinds[k] ?? 0) + v;
  into.lead += from.lead;
  into.rounds += from.rounds;
  for (const side of BATTLE_SIDES) into.ran[side] += from.ran[side];
  for (const held of ["held", "open"] as const) {
    into.cutFree[held].tries += from.cutFree[held].tries;
    into.cutFree[held].wins += from.cutFree[held].wins;
  }
  return into;
}

/** What one battle adds to the counts of who ran and who tried to cut free. */
function countBattle(r: BattleRecord, into: DuelsResult): void {
  const last = r.rounds[r.rounds.length - 1];
  if (r.outcome.kind === "escaped" && last) {
    for (const side of BATTLE_SIDES) if (last.ships.find((s) => s.ship === r[side])?.helm === "openRange") into.ran[side]++;
  }
  for (const round of r.rounds) {
    for (const c of round.contests) {
      if (c.kind !== "cutFree" || c.ship !== undefined) continue; // a fleet mate's contest is not in a one ship duel
      if (round.edge !== undefined && c.side === round.edge) continue; // the holder of the edge is not the ship that is held fast
      const bucket = round.edge === undefined ? into.cutFree.open : into.cutFree.held;
      bucket.tries++;
      if (c.winner === c.side) bucket.wins++;
    }
  }
}

export function runDuels(job: DuelsJob): DuelsResult {
  const scene = sceneByName(job.scene);
  const out = emptyDuels();
  for (let i = job.from; i < job.from + job.count; i++) {
    const r = duel(job.a, job.b, scene, seedFor(job.label, i));
    addVerdict(out.tally, verdictFor(r, "hunter"));
    out.kinds[r.outcome.kind] = (out.kinds[r.outcome.kind] ?? 0) + 1;
    out.lead += shareLead(r, "hunter");
    out.rounds += r.rounds.length;
    countBattle(r, out);
  }
  return out;
}

// ---------- Situations (the best play of a round) ----------

/** How much of the damage share lead is added to a battle's score to break ties between plays that win alike. */
const LEAD_WEIGHT = 0.05;

/** The distance at the start of every round of every battle of an experiment: starts[i][r - 1] is the range of round r on sample i. */
export interface StartsJob {
  a: Fighter;
  b: Fighter;
  scene: string;
  label: string;
  count: number;
}

export interface StartsResult {
  starts: Range[][];
}

/**
 * Plays the two doctrines through, untouched, on the samples 0 to count - 1 and writes down how every round began. Check 2 uses it
 * to find the battles that start round k at a given distance, such as Grappled, before it tries any play there.
 */
export function runStarts(job: StartsJob): StartsResult {
  const scene = sceneByName(job.scene);
  const starts: Range[][] = [];
  for (let i = 0; i < job.count; i++) starts.push(duel(job.a, job.b, scene, seedFor(job.label, i)).rounds.map((r) => r.rangeBefore));
  return { starts };
}

export interface SituationJob {
  scene: string;
  me: Fighter; // the ship that tries the plays, the hunter; it plays its doctrine in the rounds before and after round `k`
  foe: Fighter; // plays its doctrine throughout
  k: number; // the round whose play is tried
  /** The samples of the experiment to try the plays on: the battles that start round `k` at `range` (found by runStarts). */
  samples: number[];
  range: Range;
  label: string; // the experiment's seeds, the same label runStarts used
  plays: Play[];
}

export interface SituationResult {
  plays: Play[];
  /** value[p][i]: how play p did on the i-th sample. The score of the battle (1, 0.5, 0) plus a twentieth of the damage share lead. */
  values: number[][];
  /** The distance at the start of round k, read from the Chooser's view. Every sample and every play saw this one. */
  range: Range;
}

/**
 * The situation is the state of a battle at the start of round `k`, reached by `me` and `foe` playing their doctrines from
 * round 1. Every play is tried in round `k` on the same samples, and `me` goes on with its doctrine afterwards. The rounds
 * before `k` are identical for every play, because every roll of a round has its own named stream (D34); the run checks that by
 * reading the distance round `k` begins at and throwing if it is not the one the situation was picked for.
 */
export function runSituation(job: SituationJob): SituationResult {
  const scene = sceneByName(job.scene);
  const values: number[][] = job.plays.map(() => []);
  for (const i of job.samples) {
    const seed = seedFor(job.label, i);
    job.plays.forEach((play, p) => {
      const seen: { range: Range | null } = { range: null };
      const r = duel(job.me, job.foe, scene, seed, (own) => (view) => {
        if (view.round !== job.k) return own(view);
        seen.range = view.range;
        return { kind: "fight", rule: -2, abilities: [], helm: play.helm, guns: play.guns };
      });
      if (seen.range !== job.range) throw new Error(`Sample ${i} of ${job.label} starts round ${job.k} at ${String(seen.range)}, not at ${job.range}`);
      values[p]!.push(scoreOf(verdictFor(r, "hunter")) + LEAD_WEIGHT * shareLead(r, "hunter"));
    });
  }
  return { plays: job.plays, values, range: job.range };
}

// ---------- Old Shellback ----------

export interface BossJob {
  doctrine: Doctrine; // the challenger's doctrine
  ship?: ShipSpec; // the challenger's build, with its Fighting Style; a fresh sloop with no style when left out
  tide: number; // the Tide of the challenge; his Hull shrinks from the decay Tide on
  label: string;
  from: number;
  count: number;
}

export interface BossResult {
  tally: Tally; // from the challenger's point of view
  kinds: Record<string, number>;
  /** The challenger beat him: they were on the winning side of a battle with a winner (D105). */
  beaten: number;
  /** The challenger's damage share lead over him, summed over the fights. */
  lead: number;
}

export const emptyBoss = (): BossResult => ({ tally: emptyTally(), kinds: {}, beaten: 0, lead: 0 });

/** Adds `from` into `into`, so a long run of fights can be cut into jobs for the pool. */
export function mergeBoss(into: BossResult, from: BossResult): BossResult {
  mergeTally(into.tally, from.tally);
  for (const [k, v] of Object.entries(from.kinds)) into.kinds[k] = (into.kinds[k] ?? 0) + v;
  into.beaten += from.beaten;
  into.lead += from.lead;
  return into;
}

/** A sloop with the doctrine lies in wait in the Narrows on `tide`, and Old Shellback and the Tide loop do the rest. */
export function runBoss(job: BossJob): BossResult {
  const out = emptyBoss();
  for (let i = job.from; i < job.from + job.count; i++) {
    const state = newSeason({
      seasonId: "p3", preset: "season0", seed: 5, world: cradle,
      captains: [{ id: "cap_p", name: "Pip", shipName: "The Gull", water: "the_narrows", docked: false, ...(job.ship?.style ? { style: job.ship.style } : {}) }],
    });
    state.tide = job.tide;
    const captain = state.captains.cap_p!;
    captain.doctrines = [job.doctrine];
    captain.defaultDoctrine = job.doctrine.name;
    if (job.ship) {
      const ship = state.ships[captain.shipId]!;
      const built = buildShip("p", job.ship);
      ship.hull = built.hull;
      ship.levels = built.levels;
      ship.hullPoints = built.hullPoints;
      ship.riggingPoints = built.riggingPoints;
      ship.hands = built.hands;
      ship.hold.firePots = built.hold.firePots;
    }
    const result = resolveTide({
      state, world: cradle, seed: hash32(`p3/${job.label}/${i}`), windOverride: SIX_SHIPS_WIND,
      orders: { cap_p: { tide: job.tide, planA: { steps: [{ kind: "lurk", filter: { kind: "npcs" } }] } } },
    });
    const battle = result.replay.find((e) => e.kind === "battle");
    if (!battle || battle.kind !== "battle") {
      addVerdict(out.tally, "draw");
      out.kinds["nofight"] = (out.kinds["nofight"] ?? 0) + 1;
      continue;
    }
    const mine = battle.record.hunter === "ship_cap_p" ? "hunter" : "target";
    addVerdict(out.tally, verdictFor(battle.record, mine));
    out.kinds[battle.record.outcome.kind] = (out.kinds[battle.record.outcome.kind] ?? 0) + 1;
    out.lead += shareLead(battle.record, mine);
    if (result.state.captains.cap_p!.bossesBeaten.includes("old_shellback")) out.beaten++;
  }
  return out;
}

// ---------- The registry ----------

export const JOBS = { duels: runDuels, starts: runStarts, situation: runSituation, boss: runBoss } as const;
export type JobKind = keyof typeof JOBS;
export type JobInput<K extends JobKind> = Parameters<(typeof JOBS)[K]>[0];
export type JobOutput<K extends JobKind> = ReturnType<(typeof JOBS)[K]>;
