// Shared test helpers for combat. Not part of the engine surface.

import { Rng } from "../rng.ts";
import { maxHands, maxHullPoints, maxRiggingPoints, newShip, statValue } from "../ship.ts";
import type { HullId, Ship } from "../types.ts";
import type { BattleShip, BattleSide } from "./types.ts";

/** A BattleShip for a Ship at the start of a battle. */
export function battleShipFrom(ship: Ship, side: BattleSide, over: Partial<BattleShip> = {}): BattleShip {
  return {
    shipId: ship.id,
    captainId: ship.captainId,
    name: ship.name,
    side,
    hull: ship.hull,
    cannons: statValue(ship.hull, ship.levels.cannons),
    sails: statValue(ship.hull, ship.levels.sails),
    maxHullPoints: maxHullPoints(ship),
    maxRiggingPoints: maxRiggingPoints(ship),
    maxHands: maxHands(ship),
    helmBonus: 0,
    charted: false,
    withCurrent: false,
    lurker: false,
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.hold.powder,
    abilities: [],
    guns: { order: null, repeats: 0, charged: false },
    ...over,
  };
}

/** A fresh level 0 ship on the given side, full of everything. */
export function testShip(side: BattleSide, hull: HullId = "sloop", over: Partial<BattleShip> = {}): BattleShip {
  return battleShipFrom(newShip(`ship_${side}`, `cap_${side}`, `The ${side}`, hull, "dw_shallows", false), side, over);
}

/** An Rng that hands out the given numbers in order, then repeats the last one. Child streams are itself,
 *  so the order of draws is the order of calls. 0 makes every chance roll succeed, 0.99 makes it fail. */
export class ScriptedRng extends Rng {
  private script: number[];
  private at = 0;

  constructor(...values: number[]) {
    super("scripted");
    this.script = values;
  }

  override next(): number {
    const v = this.script[Math.min(this.at, this.script.length - 1)] ?? 0;
    this.at++;
    return v;
  }

  override stream(): Rng {
    return this;
  }
}

/** Freezes an object and everything inside it, so any write to it throws (modules run in strict mode). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
