// The arena of the v0.3 combat simulator (P3.1): ships, scenes and one duel on the real engine.
// Everything here calls runBattle (engine_v3/combat/battle.ts) with the Choosers that real doctrines build, so a number
// the simulator prints is a number the game would produce. Nothing here has a rule of its own, and nothing is random
// except through the battle's own seeded streams (and the seeded random plan of plans.ts).

import {
  battleShipOf, doctrineChooser, hash32, maxHands, maxHullPoints, maxRiggingPoints, newShip, powerRating, runBattle,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  AmbushRange, BattleRecord, BattleSide, Chooser, Doctrine, HullId, Ship, Stat, Terrain, WindKind,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { randomPlan } from "./plans.ts";

// ---------- Ships ----------

/** A ship to build: a hull and the upgrade level of each stat. A level 0 sloop is the fresh ship every captain starts with. */
export interface ShipSpec {
  hull?: HullId;
  levels?: Partial<Record<Stat, number>>;
}

/** A ship of this build, full of Hull, Rigging, Hands and Powder. */
export function buildShip(id: string, spec: ShipSpec = {}): Ship {
  const ship = newShip(`ship_${id}`, `cap_${id}`, `The ${id}`, spec.hull ?? "sloop", "dw_shallows", false);
  for (const [stat, level] of Object.entries(spec.levels ?? {}) as [Stat, number][]) ship.levels[stat] = level;
  ship.hullPoints = maxHullPoints(ship);
  ship.riggingPoints = maxRiggingPoints(ship);
  ship.hands = maxHands(ship);
  return ship;
}

/** The Power Rating of a build, from the engine (D26). A fresh sloop is 10. */
export const ratingOf = (spec: ShipSpec = {}): number => powerRating(buildShip("rating", spec));

/** The same level on the four stats that matter in a fight (Hull, Cannons, Sails, Berths). Hold and Drill do not (P3.B3 teaches the simulator Drill). */
export const evenLevels = (level: number): Record<Stat, number> => ({ hull: level, cannons: level, sails: level, berths: level, hold: 0, drill: 0 });

/**
 * The balanced sloop whose Power Rating is closest to `ratio` times a fresh sloop's. The total of levels is spread as evenly as
 * it can be over Hull, Cannons, Sails and Berths, never past the maximum level. A ratio the upgrades cannot reach gives the top.
 */
export function sloopForRatio(ratio: number): ShipSpec {
  const goal = ratio * ratingOf();
  let best: ShipSpec = {};
  let bestGap = Math.abs(ratingOf(best) - goal);
  const stats: Stat[] = ["hull", "cannons", "sails", "berths"];
  for (let total = 0; total <= stats.length * 10; total++) {
    const levels: Partial<Record<Stat, number>> = {};
    stats.forEach((s, i) => { levels[s] = Math.floor(total / stats.length) + (i < total % stats.length ? 1 : 0); });
    const spec: ShipSpec = { levels };
    const gap = Math.abs(ratingOf(spec) - goal);
    if (gap < bestGap) { best = spec; bestGap = gap; }
  }
  return best;
}

// ---------- Fighters and scenes ----------

/** One captain in the arena: a ship and how they fight, a doctrine or a random plan. */
export interface Fighter {
  name: string;
  ship?: ShipSpec;
  /** A real doctrine. Leave it out for a random plan (plans.ts). */
  doctrine?: Doctrine;
  /** What the other side's "enemy type" condition sees this captain as. Players are `player`. */
  kind?: "player" | "monster";
}

/** Where a battle happens. Open water in a Breeze is the baseline of GAMEPLAY 8.4. */
export interface Scene {
  name: string;
  terrain: Terrain;
  wind: WindKind;
  ambush?: AmbushRange;
  /** The water is Charted for both captains (Local Knowledge, no Reef scrape). */
  charted?: boolean;
}

export const OPEN_BREEZE: Scene = { name: "open/breeze", terrain: "open", wind: "breeze" };

/** The terrains of GAMEPLAY 2.2 that can hold a battle, in a Breeze, plus a Calm and a Gale in open water. */
export const SCENES: readonly Scene[] = [
  OPEN_BREEZE,
  { name: "open/calm", terrain: "open", wind: "calm" },
  { name: "open/gale", terrain: "open", wind: "gale" },
  { name: "shallows", terrain: "shallows", wind: "breeze" },
  { name: "reef", terrain: "reef", wind: "breeze" },
  { name: "reef/charted", terrain: "reef", wind: "breeze", charted: true },
  { name: "rocky", terrain: "rocky", wind: "breeze" },
  { name: "fog", terrain: "fog", wind: "breeze" },
  { name: "kelp", terrain: "kelp", wind: "breeze" },
];

export const sceneByName = (name: string): Scene => {
  const scene = SCENES.find((s) => s.name === name);
  if (!scene) throw new Error(`No scene called ${name}`);
  return scene;
};

// ---------- A duel ----------

const chooserOf = (f: Fighter, other: Fighter, seed: number, side: BattleSide): Chooser =>
  f.doctrine ? doctrineChooser(f.doctrine, { enemyType: other.kind ?? "player" }) : randomPlan(seed, side);

/** Runs one battle: `hunter` against `target` in the scene, on the Tide seed. Pure. */
export function duel(hunter: Fighter, target: Fighter, scene: Scene, seed: number): BattleRecord {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  return runBattle({
    tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
    hunter: battleShipOf(buildShip("a", hunter.ship), { id: "cap_a" }, "hunter", flags),
    target: battleShipOf(buildShip("b", target.ship), { id: "cap_b" }, "target", flags),
    doctrines: { hunter: hunter.doctrine?.name ?? hunter.name, target: target.doctrine?.name ?? target.name },
    choosers: { hunter: chooserOf(hunter, target, seed, "hunter"), target: chooserOf(target, hunter, seed, "target") },
    ...(scene.ambush ? { ambush: scene.ambush } : {}),
  });
}

// ---------- Reading a result ----------

/** How a battle ended from one side's point of view. */
export type Verdict = "win" | "loss" | "draw" | "escape";

export function verdictFor(record: BattleRecord, side: BattleSide): Verdict {
  const o = record.outcome;
  if (o.kind === "escaped") return "escape";
  if (o.winner === null) return "draw";
  return o.winner === side ? "win" : "loss";
}

/** The score a side got: 1 for a win, 0.5 for a draw or an escape, 0 for a loss. */
export const scoreOf = (v: Verdict): number => (v === "win" ? 1 : v === "loss" ? 0 : 0.5);

/** Damage share `side` dealt minus the damage share it took (8.7 Victory on points). */
export const shareLead = (record: BattleRecord, side: BattleSide): number =>
  record.dealt[side] - record.dealt[side === "hunter" ? "target" : "hunter"];

/** A seed for sample `i` of a named experiment, so every experiment draws its own reproducible stream of battles. */
export const seedFor = (experiment: string, i: number): number => hash32(`p3/${experiment}/${i}`);
