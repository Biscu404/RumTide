// Derived ship numbers (GAMEPLAY 6) and the Watches budget (3.1).

import { B, SEASON_PRESETS } from "./balance.ts";
import type { PresetId } from "./balance.ts";
import { CARGO_GOODS, GOODS } from "./types.ts";
import type { Captain, FightingStyle, Good, HullId, Ship, Stat } from "./types.ts";

const hullDef = (hull: HullId) => B.hulls[hull];
const grow = (level: number) => 1 + B.upgrade.perLevel * level;
const EPSILON = 1e-9; // keeps a crew that is a whole number in exact arithmetic from rounding down in floating point

// A monster's statline, when it has one, wins over its hull and levels. The style only changes the crew (the Bombardier's).
type Built = Pick<Ship, "hull" | "levels" | "statline" | "style">;

/** The share of the Hands a style sails with: a Bombardier's mortar takes the deck, so it carries a smaller crew (spec section 3). */
export const crewShare = (style: FightingStyle | undefined): number => (style === "bombardier" ? B.styles.bombardier.handsShare : 1);

/** Max Hands before the style's share: what the hull and its Berths hold. */
const berthHands = (ship: Built): number => hullDef(ship.hull).maxHands * grow(ship.levels.berths);

export const statValue = (hull: HullId, level: number) => B.baseStat * hullDef(hull).mult * grow(level);
export const maxHullPoints = (ship: Built) => ship.statline?.maxHull ?? Math.round(B.baseHull * hullDef(ship.hull).mult * grow(ship.levels.hull));
export const maxRiggingPoints = (ship: Built) => ship.statline?.maxRigging ?? Math.round(B.baseRigging * hullDef(ship.hull).mult * grow(ship.levels.sails));
/** Max Hands: the hull and Berths, times the style's crew share (the Bombardier sails with 60%). Hiring, wages, healing and Capture all read this. */
export const maxHands = (ship: Built) => ship.statline?.maxHands ?? Math.floor(berthHands(ship) * crewShare(ship.style) + EPSILON);
/** The Cannons and Sails stat values of a ship: its statline's if it is a monster, else the hull and level curve (6.2). */
export const cannonsOf = (ship: Built) => ship.statline?.cannons ?? statValue(ship.hull, ship.levels.cannons);
export const sailsOf = (ship: Built) => ship.statline?.sails ?? statValue(ship.hull, ship.levels.sails);
export const holdCapacity = (ship: Pick<Ship, "hull" | "levels">) => Math.floor(hullDef(ship.hull).hold * grow(ship.levels.hold));
export const holdUsed = (ship: Pick<Ship, "hold">) => GOODS.reduce((n, g) => n + (ship.hold[g] ?? 0) * B.holdSpace[g], 0);
export const carriesCargo = (ship: Pick<Ship, "hold" | "plunder">) => ship.plunder > 0 || CARGO_GOODS.some((g) => (ship.hold[g] ?? 0) > 0);

// ---------- Drill (boarding spec section 4) ----------

export type DrillUnlock = keyof typeof B.drill.unlocks;

/** The Drill level of a ship, 0 for a ship with none (a monster, or a ship saved before Drill existed). */
export const drillOf = (ship: Pick<Ship, "levels">): number => ship.levels?.drill ?? 0;

/** The most Drill levels a ship can have in this season (D120). */
export const drillCap = (preset: PresetId): number => SEASON_PRESETS[preset].drillMaxLevel;

/** The stage a Drill level is in: 0 Deckhands (levels 1 to 5), 1 Cutthroats (6 to 10), 2 Sea Wolves (11 to 15). -1 at level 0. */
export const drillStage = (level: number): number =>
  level <= 0 ? -1 : Math.min(B.drill.perLevel.length - 1, Math.floor((level - 1) / B.drill.stageSize));

/** The boarding strength the first `level` levels of Drill add, as a fraction: a level adds its stage's share, later stages more. */
export function drillBonus(level: number): number {
  let bonus = 0;
  for (let i = 1; i <= level; i++) bonus += B.drill.perLevel[drillStage(i)] as number;
  return bonus;
}

/** What Drill multiplies boarding strength by, and the Hands of the Power Rating. 1 at Drill 0. */
export const drillFactor = (level: number): number => 1 + drillBonus(level);

/** Finishing a stage unlocks Fire Pots (5), Grapnels (10) and Second Wave (15). */
export const drillUnlocked = (level: number, unlock: DrillUnlock): boolean => level >= B.drill.unlocks[unlock];

/** The Hands the Power Rating counts. A style is equal on paper and does not change the rating (spec section 7), so a ship
 * whose style sails with a smaller crew counts its Hands against that crew: a full Bombardier counts as a full crew. A drilled
 * crew counts for more: Hands times the Drill factor (boarding spec section 4), so parley and the fairness factor see it. */
const ratedHands = (ship: Built & Pick<Ship, "hands">): number => {
  if (ship.statline) return ship.hands;
  const own = maxHands(ship);
  const hands = own > 0 ? (ship.hands * berthHands(ship)) / own : ship.hands;
  return hands * drillFactor(drillOf(ship));
};

/** The D26 sum, (max Hull / 10 + Cannons + Sails + Hands / 3) / 4, of a ship. */
const powerSum = (ship: Built & Pick<Ship, "hands">): number =>
  (maxHullPoints(ship) / B.power.hullPer + cannonsOf(ship) + sailsOf(ship) + ratedHands(ship) / B.power.handsPer) / B.power.divisor;

/** The D26 sum of a fresh sloop, which is where the exponent pivots: 10. */
const FRESH_SUM = (B.baseHull / B.power.hullPer + 2 * B.baseStat + B.hulls.sloop.maxHands / B.power.handsPer) / B.power.divisor;

/**
 * Power Rating (D26, D136), for parley, fairness and NPC scaling: 10 x (S / 10) ^ 1.6, where S is the D26 sum
 * (max Hull / 10 + Cannons + Sails + Hands / 3) / 4. The rating grows faster than the stats, because Hull, guns and crew
 * multiply in a fight. A fresh sloop is 10. Hands are the Hands aboard now, so a ship that has lost its crew rates lower
 * (D74), and a style's smaller crew is counted against its own size.
 */
export const powerRating = (ship: Built & Pick<Ship, "hands">): number => FRESH_SUM * (powerSum(ship) / FRESH_SUM) ** B.power.exponent;

/** Upgrade cost for buying the next level of a stat (v0.2 5.3), with the season's cost multiplier. */
export const upgradeCost = (currentLevel: number, costMult = 1) =>
  Math.round(B.upgrade.baseCost * B.upgrade.growth ** currentLevel * costMult);

/** The price of the next level of Drill: the same as the next level of any other upgrade (D141). */
export const drillCost = upgradeCost;

export function emptyHold(): Record<Good, number> {
  return { provisions: 0, powder: 0, firePots: 0, timber: 0, rum: 0, sugar: 0, spice: 0 };
}

export function zeroLevels(): Record<Stat, number> {
  return { hull: 0, cannons: 0, sails: 0, berths: 0, hold: 0, drill: 0 };
}

/** A fresh ship with full hull, rigging and Hands and the starting supplies. A style, when given, sails on it (its crew included). */
export function newShip(
  id: string, captainId: string, name: string, hull: HullId, waterId: string, docked: boolean, style?: FightingStyle,
): Ship {
  const levels = zeroLevels();
  const base = { hull, levels, ...(style ? { style } : {}) };
  const hold = emptyHold();
  hold.provisions = B.start.provisions;
  hold.powder = B.start.powder;
  hold.firePots = B.start.firePots + (style === "firebrand" ? B.styles.firebrand.startPots : 0); // a Firebrand sails with its pots
  return {
    id, captainId, name, hull, ...(style ? { style } : {}), waterId, docked, levels,
    hullPoints: maxHullPoints(base),
    riggingPoints: maxRiggingPoints(base),
    hands: Math.floor(maxHands(base) * B.start.handsShare),
    handsWounded: 0,
    hold,
    plunder: 0,
    shortRations: false,
  };
}

export interface WatchesBreakdown {
  total: number;
  base: number;
  bonuses: string[];
  penalties: string[];
}

/** Watches for the coming Tide (3.1): base by hull, bonuses up to the cap, then penalties. */
export function watchesFor(ship: Ship, captain: Captain): WatchesBreakdown {
  const W = B.watches;
  const base = hullDef(ship.hull).watches;
  const bonuses: string[] = [];
  if (ship.levels.sails >= W.sailsBonusLevel) bonuses.push("sails");
  if (captain.skills.seamanship >= W.seamanshipBonusRank) bonuses.push("seamanship");
  if (captain.perks.includes("navigator.watch")) bonuses.push("navigator");
  if (captain.perks.includes("trinket.watch")) bonuses.push("trinket");
  let total = Math.min(W.cap, base + bonuses.length);
  const penalties: string[] = [];
  if (ship.hands < W.lowHandsShare * maxHands(ship)) penalties.push("lowHands");
  if (ship.shortRations) penalties.push("shortRations");
  if (holdUsed(ship) > W.heavyHoldShare * holdCapacity(ship)) penalties.push("heavyHold");
  total = Math.max(W.min, total - penalties.length);
  return { total, base, bonuses, penalties };
}
