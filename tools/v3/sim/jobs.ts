// The jobs of the combat simulator (P3.1). A job is plain data that says what to fight, and a runner that fights it and
// returns plain numbers. Keeping them JSON means the same job runs on the main thread (tests) or on a worker (pool.ts).

import {
  GUNS_ORDERS, HELM_MOVES, battleShipOf, doctrineChooser, hash32, newSeason, resolveTide, runBattle,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Chooser, Doctrine, GunsOrder, HelmMove } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { cradle, SIX_SHIPS_WIND } from "../sixShips.ts";
import { buildShip, duel, sceneByName, scoreOf, seedFor, shareLead, verdictFor } from "./arena.ts";
import type { Fighter, ShipSpec } from "./arena.ts";
import { addVerdict, emptyTally } from "./stats.ts";
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

export interface DuelsResult {
  tally: Tally; // from the hunter's point of view
  kinds: Record<string, number>; // how the battles ended, by outcome kind
  lead: number; // the hunter's damage share lead, summed over the battles
  rounds: number; // rounds fought, summed
}

export function runDuels(job: DuelsJob): DuelsResult {
  const scene = sceneByName(job.scene);
  const tally = emptyTally();
  const kinds: Record<string, number> = {};
  let lead = 0;
  let rounds = 0;
  for (let i = job.from; i < job.from + job.count; i++) {
    const r = duel(job.a, job.b, scene, seedFor(job.label, i));
    addVerdict(tally, verdictFor(r, "hunter"));
    kinds[r.outcome.kind] = (kinds[r.outcome.kind] ?? 0) + 1;
    lead += shareLead(r, "hunter");
    rounds += r.rounds.length;
  }
  return { tally, kinds, lead, rounds };
}

// ---------- Situations (the best play of a round) ----------

/** One Helm move with one Guns order: a play for a round. */
export interface Play {
  helm: HelmMove;
  guns: GunsOrder;
}

/** Every play there is, the Helm moves in order, each with every Guns order. */
export const ALL_PLAYS: readonly Play[] = HELM_MOVES.flatMap((helm) => GUNS_ORDERS.map((guns) => ({ helm, guns })));

export interface SituationJob {
  scene: string;
  me: Doctrine; // played in the rounds before and after round `k`
  foe: Doctrine; // played throughout by the other ship
  k: number; // the round whose play is tried
  n: number; // seeds
  label: string;
  /** Only these plays, instead of all of them. */
  plays?: Play[];
}

export interface SituationResult {
  plays: Play[];
  /** value[p][i]: how play p did on seed i. The score of the battle (1, 0.5, 0) plus a twentieth of the damage share lead. */
  values: number[][];
}

/** How much of the damage share lead is added to a battle's score to break ties between plays that win alike. */
const LEAD_WEIGHT = 0.05;

/**
 * The situation is the state of a battle at the start of round `k`, reached by `me` and `foe` playing their doctrines from
 * round 1. Every play is tried in round `k` on the same seeds, and `me` goes on with its doctrine afterwards. The rounds
 * before `k` are identical for every play, because every roll of a round has its own named stream (D34).
 */
export function runSituation(job: SituationJob): SituationResult {
  const scene = sceneByName(job.scene);
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const plays = job.plays ?? [...ALL_PLAYS];
  const mine = doctrineChooser(job.me, { enemyType: "player" });
  const theirs = doctrineChooser(job.foe, { enemyType: "player" });
  const values: number[][] = plays.map(() => []);
  for (let i = 0; i < job.n; i++) {
    const seed = seedFor(job.label, i);
    plays.forEach((play, p) => {
      const forced: Chooser = (view) => (view.round === job.k ? { kind: "fight", rule: -2, abilities: [], helm: play.helm, guns: play.guns } : mine(view));
      const r = runBattle({
        tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
        hunter: battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags),
        target: battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags),
        doctrines: { hunter: job.me.name, target: job.foe.name },
        choosers: { hunter: forced, target: theirs },
      });
      values[p]!.push(scoreOf(verdictFor(r, "hunter")) + LEAD_WEIGHT * shareLead(r, "hunter"));
    });
  }
  return { plays, values };
}

// ---------- Old Shellback ----------

export interface BossJob {
  doctrine: Doctrine; // the challenger's doctrine
  ship?: ShipSpec; // the challenger's build; a fresh sloop when left out
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

/** A fresh sloop with the doctrine lies in wait in the Narrows on `tide`, and Old Shellback and the Tide loop do the rest. */
export function runBoss(job: BossJob): BossResult {
  const tally = emptyTally();
  const kinds: Record<string, number> = {};
  let beaten = 0;
  let lead = 0;
  for (let i = job.from; i < job.from + job.count; i++) {
    const state = newSeason({
      seasonId: "p3", preset: "season0", seed: 5, world: cradle,
      captains: [{ id: "cap_p", name: "Pip", shipName: "The Gull", water: "the_narrows", docked: false }],
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
    }
    const result = resolveTide({
      state, world: cradle, seed: hash32(`p3/${job.label}/${i}`), windOverride: SIX_SHIPS_WIND,
      orders: { cap_p: { tide: job.tide, planA: { steps: [{ kind: "lurk", filter: { kind: "npcs" } }] } } },
    });
    const battle = result.replay.find((e) => e.kind === "battle");
    if (!battle || battle.kind !== "battle") {
      addVerdict(tally, "draw");
      kinds["nofight"] = (kinds["nofight"] ?? 0) + 1;
      continue;
    }
    const mine = battle.record.hunter === "ship_cap_p" ? "hunter" : "target";
    addVerdict(tally, verdictFor(battle.record, mine));
    kinds[battle.record.outcome.kind] = (kinds[battle.record.outcome.kind] ?? 0) + 1;
    lead += shareLead(battle.record, mine);
    if (result.state.captains.cap_p!.bossesBeaten.includes("old_shellback")) beaten++;
  }
  return { tally, kinds, beaten, lead };
}

// ---------- The registry ----------

export const JOBS = { duels: runDuels, situation: runSituation, boss: runBoss } as const;
export type JobKind = keyof typeof JOBS;
export type JobInput<K extends JobKind> = Parameters<(typeof JOBS)[K]>[0];
export type JobOutput<K extends JobKind> = ReturnType<(typeof JOBS)[K]>;
