// The arena of the v0.3 combat simulator (P3.1, P3.B3): ships, scenes and one duel on the real engine.
// Everything here calls runBattle (engine_v3/combat/battle.ts) with the Choosers that real doctrines build, so a number
// the simulator prints is a number the game would produce. Nothing here has a rule of its own, and nothing is random
// except through the battle's own seeded streams (and the seeded random plan of plans.ts).
//
// A ship can carry a Fighting Style, and then it really has it: the engine's own newShip gives it the style's crew (the
// Bombardier's 60%), its Fire Pots (a Firebrand's two) and every trait that reads Ship.style. A Fighter for a style plays that
// style's template doctrine (styleFighter). Drill is a level like any other, and pots can be set for a test setup.

import {
  battleShipOf, doctrineChooser, hash32, maxHands, maxHullPoints, maxRiggingPoints, newShip, powerRating, runBattle, styleTemplate,
  templateDoctrine,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  AmbushRange, BattleRecord, BattleSide, Chooser, Doctrine, FightingStyle, HullId, Ship, Stat, TemplateName, Terrain, WindKind,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { randomPlan } from "./plans.ts";

// ---------- Ships ----------

/**
 * A ship to build: a hull, the upgrade level of each stat, a Fighting Style and Fire Pots. A level 0 sloop with no style is the
 * fresh ship a captain starts a season with; a style changes it the way the engine does (newShip).
 */
export interface ShipSpec {
  hull?: HullId;
  levels?: Partial<Record<Stat, number>>;
  style?: FightingStyle;
  /** Fire Pots in the hold. Left out, the ship has what newShip gives it: a Firebrand its starting pots, everyone else none. */
  pots?: number;
}

/** A ship of this build, full of Hull, Rigging, Hands and Powder. */
export function buildShip(id: string, spec: ShipSpec = {}): Ship {
  const ship = newShip(`ship_${id}`, `cap_${id}`, `The ${id}`, spec.hull ?? "sloop", "dw_shallows", false, spec.style);
  for (const [stat, level] of Object.entries(spec.levels ?? {}) as [Stat, number][]) ship.levels[stat] = level;
  ship.hullPoints = maxHullPoints(ship);
  ship.riggingPoints = maxRiggingPoints(ship);
  ship.hands = maxHands(ship);
  if (spec.pots !== undefined) ship.hold.firePots = spec.pots;
  return ship;
}

/** The Power Rating of a build, from the engine (D26). A fresh sloop is 10. */
export const ratingOf = (spec: ShipSpec = {}): number => powerRating(buildShip("rating", spec));

/** The same level on the four stats that matter in a fight (Hull, Cannons, Sails, Berths). Hold does not, and Drill is spent on its own (checks 7 and 8). */
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

/** The six Fighting Styles of the wheel (fighting styles spec section 5). The Smuggler is the trader's style and sits outside it. */
export type WheelStyle = Exclude<FightingStyle, "smuggler">;

/**
 * The six styles of the wheel in the order of the spec's tables, each with the template doctrine its captain starts with. This
 * is the field of check 1. (The engine has a list of all seven styles too, also called FIGHTING_STYLES; it is not this one.)
 */
export const FIGHTING_STYLES: readonly { style: WheelStyle; template: TemplateName }[] = (
  ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand"] as const
).map((style) => ({ style, template: styleTemplate(style) }));

/** A captain of this style: a ship that really has the style, playing the style's template. `ship` adds levels, pots and so on. */
export function styleFighter(style: FightingStyle, ship: ShipSpec = {}): Fighter {
  const template = styleTemplate(style);
  return { name: template, ship: { ...ship, style }, doctrine: templateDoctrine(template) };
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

/**
 * Runs one battle: `hunter` against `target` in the scene, on the Tide seed. Pure. `hunterChooser` wraps the hunter's own Chooser,
 * which check 2 uses to force one play in one round and carry on with the doctrine in every other.
 */
export function duel(hunter: Fighter, target: Fighter, scene: Scene, seed: number, hunterChooser?: (own: Chooser) => Chooser): BattleRecord {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const own = chooserOf(hunter, target, seed, "hunter");
  return runBattle({
    tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
    hunter: battleShipOf(buildShip("a", hunter.ship), { id: "cap_a" }, "hunter", flags),
    target: battleShipOf(buildShip("b", target.ship), { id: "cap_b" }, "target", flags),
    doctrines: { hunter: hunter.doctrine?.name ?? hunter.name, target: target.doctrine?.name ?? target.name },
    choosers: { hunter: hunterChooser ? hunterChooser(own) : own, target: chooserOf(target, hunter, seed, "target") },
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
