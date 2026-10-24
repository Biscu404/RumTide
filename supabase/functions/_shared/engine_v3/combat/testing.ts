// Shared test helpers for combat. Not part of the engine surface.

import { Rng } from "../rng.ts";
import { cannonsOf, maxHands, maxHullPoints, maxRiggingPoints, newShip, sailsOf } from "../ship.ts";
import type { FightingStyle, HullId, Ship } from "../types.ts";
import type { BattleInput, Chooser } from "./battle.ts";
import type { BattleShip, BattleSide, GunsOrder, HelmMove } from "./types.ts";

/** A BattleShip for a Ship at the start of a battle. */
export function battleShipFrom(ship: Ship, side: BattleSide, over: Partial<BattleShip> = {}): BattleShip {
  return {
    shipId: ship.id,
    captainId: ship.captainId,
    name: ship.name,
    side,
    hull: ship.hull,
    ...(ship.style ? { style: ship.style } : {}),
    cannons: cannonsOf(ship),
    sails: sailsOf(ship),
    maxHullPoints: maxHullPoints(ship),
    maxRiggingPoints: maxRiggingPoints(ship),
    maxHands: maxHands(ship),
    helmBonus: 0,
    boardingBonus: 0,
    ...(ship.statline ? { fixedHelm: ship.statline.helm } : {}),
    charted: false,
    withCurrent: false,
    lurker: false,
    ...(ship.levels.drill > 0 ? { drill: ship.levels.drill } : {}),
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.hold.powder,
    ...(ship.hold.firePots > 0 ? { firePots: ship.hold.firePots } : {}),
    abilities: [],
    guns: { order: null, repeats: 0, charged: false },
    ...over,
  };
}

/** A fresh level 0 ship on the given side, full of everything. */
export function testShip(side: BattleSide, hull: HullId = "sloop", over: Partial<BattleShip> = {}): BattleShip {
  return battleShipFrom(newShip(`ship_${side}`, `cap_${side}`, `The ${side}`, hull, "dw_shallows", false), side, over);
}

/** A fresh level 0 ship of a Fighting Style on the given side, with the style's crew (a Bombardier sails with 60% of the Hands). */
export function styleShip(side: BattleSide, style: FightingStyle, hull: HullId = "sloop", over: Partial<BattleShip> = {}): BattleShip {
  return battleShipFrom(newShip(`ship_${side}`, `cap_${side}`, `The ${side}`, hull, "dw_shallows", false, style), side, over);
}

/** A fresh level 0 ship with its own id (`ship_<id>`) on the given side: for the ships of a fleet battle. */
export function fleetShip(id: string, side: BattleSide, hull: HullId = "sloop", over: Partial<BattleShip> = {}): BattleShip {
  return battleShipFrom(newShip(`ship_${id}`, `cap_${id}`, `The ${id}`, hull, "dw_shallows", false), side, over);
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

// ---------- Scripted captains for battle tests ----------

/** A captain who plays the same Helm move and Guns order every round. */
export const always = (helm: HelmMove, guns: GunsOrder, extra: { jettison?: boolean } = {}): Chooser => () => ({
  kind: "fight", rule: 0, abilities: [], helm, guns, ...extra,
});

/** A captain who plays a script by round number, and `otherwise` in the rounds it does not name. */
export const scripted = (plays: Record<number, [HelmMove, GunsOrder]>, otherwise: [HelmMove, GunsOrder]): Chooser => (view) => {
  const [helm, guns] = plays[view.round] ?? otherwise;
  return { kind: "fight", rule: 0, abilities: [], helm, guns };
};

/** A captain who plays `then` until `round`, and strikes the colours in that round. */
export const surrendersAt = (round: number, then: Chooser): Chooser => (view) =>
  view.round >= round ? { kind: "surrender", rule: 1, abilities: [] } : then(view);

/** A battle between two ships on a given Tide seed. Open water, a Breeze, the hunter's doctrine against the target's. */
export function battleOf(
  hunter: BattleShip,
  target: BattleShip,
  choosers: { hunter: Chooser; target: Chooser },
  over: Partial<BattleInput> = {},
): BattleInput {
  return {
    tide: 5, seed: 1234, at: "dw_shallows", terrain: "open", wind: "breeze",
    hunter, target,
    doctrines: { hunter: "Scripted hunter", target: "Scripted target" },
    choosers,
    ...over,
  };
}
