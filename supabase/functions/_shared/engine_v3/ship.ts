// Derived ship numbers (GAMEPLAY 6) and the Watches budget (3.1).

import { B } from "./balance.ts";
import { CARGO_GOODS, GOODS } from "./types.ts";
import type { Captain, Good, HullId, Ship, Stat } from "./types.ts";

const hullDef = (hull: HullId) => B.hulls[hull];
const grow = (level: number) => 1 + B.upgrade.perLevel * level;

export const statValue = (hull: HullId, level: number) => B.baseStat * hullDef(hull).mult * grow(level);
export const maxHullPoints = (ship: Pick<Ship, "hull" | "levels">) => Math.round(B.baseHull * hullDef(ship.hull).mult * grow(ship.levels.hull));
export const maxRiggingPoints = (ship: Pick<Ship, "hull" | "levels">) => Math.round(B.baseRigging * hullDef(ship.hull).mult * grow(ship.levels.sails));
export const maxHands = (ship: Pick<Ship, "hull" | "levels">) => Math.floor(hullDef(ship.hull).maxHands * grow(ship.levels.berths));
export const holdCapacity = (ship: Pick<Ship, "hull" | "levels">) => Math.floor(hullDef(ship.hull).hold * grow(ship.levels.hold));
export const holdUsed = (ship: Pick<Ship, "hold">) => GOODS.reduce((n, g) => n + (ship.hold[g] ?? 0) * B.holdSpace[g], 0);
export const carriesCargo = (ship: Pick<Ship, "hold" | "plunder">) => ship.plunder > 0 || CARGO_GOODS.some((g) => (ship.hold[g] ?? 0) > 0);

/**
 * Power Rating (D26), for parley, fairness and NPC scaling: (max Hull / 10 + Cannons + Sails + Hands / 3) / 4.
 * A fresh sloop is 10. Hands are the Hands aboard now, so a ship that has lost its crew rates lower (D74).
 */
export const powerRating = (ship: Pick<Ship, "hull" | "levels" | "hands">): number =>
  (maxHullPoints(ship) / B.power.hullPer + statValue(ship.hull, ship.levels.cannons) + statValue(ship.hull, ship.levels.sails) + ship.hands / B.power.handsPer) /
  B.power.divisor;

/** Upgrade cost for buying the next level of a stat (v0.2 5.3), with the season's cost multiplier. */
export const upgradeCost = (currentLevel: number, costMult = 1) =>
  Math.round(B.upgrade.baseCost * B.upgrade.growth ** currentLevel * costMult);

export function emptyHold(): Record<Good, number> {
  return { provisions: 0, powder: 0, timber: 0, rum: 0, sugar: 0, spice: 0 };
}

export function zeroLevels(): Record<Stat, number> {
  return { hull: 0, cannons: 0, sails: 0, berths: 0, hold: 0 };
}

/** A fresh ship with full hull, rigging and Hands and the starting supplies. */
export function newShip(id: string, captainId: string, name: string, hull: HullId, waterId: string, docked: boolean): Ship {
  const levels = zeroLevels();
  const base = { hull, levels };
  const hold = emptyHold();
  hold.provisions = B.start.provisions;
  hold.powder = B.start.powder;
  return {
    id, captainId, name, hull, waterId, docked, levels,
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
