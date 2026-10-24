// Fire (docs/specs/fighting-styles.md section 3 and edge cases): how long a fire burns, what it takes, and which fire wins when
// two burn on one ship. Pure, with no randomness of its own: whether a Hot Shot, a Mortar shell, a Fire Pot or an ember catches
// is rolled in battle.ts, each from its own labelled stream ("fire/hotShot/<id>", "fire/mortar/<id>", "fire/pots/<id>",
// "fire/embers/<id>"), so no other roll moves.
//
// A burning ship loses `combat.fire.hull` Hull at the end of every round, after the deck fight, for as many rounds as the fire
// burns, the round it was lit included. A fire can sink a ship. The one thing a fire never does is take a ship below 1 Hull
// when it is the flash of a Fire Pot thrown by a ship that is not a Firebrand (boarding spec section 2).

import { B } from "../balance.ts";
import type { ShipId } from "../types.ts";
import { hasStyle } from "./styles.ts";
import type { BattleShip, FireSource } from "./types.ts";

const C = B.combat;
const S = B.styles;
const NEUTRAL = 1; // a factor that changes nothing

/** A fire on a ship: the rounds it still has to burn (the coming end of round included), and the ship that lit it. */
export interface Blaze {
  rounds: number;
  by: ShipId;
}

/** The fires burning in a battle, by ship id. A ship that is not burning has no entry. */
export type Blazes = Readonly<Record<ShipId, Blaze>>;

/**
 * How long a fire burns, by where it came from. A Firebrand's Hot Shot and Fire Pots burn a round longer than the base fire
 * (D138). The Mortar's fire, the blaze a ship catches by ramming a Firebrand and the embers of a Fireship have their own numbers.
 */
export function blazeRounds(source: FireSource, by: Pick<BattleShip, "style">): number {
  switch (source) {
    case "mortar": return S.bombardier.mortarFireRounds;
    case "ram": return S.firebrand.ramBlazeRounds;
    case "embers": return C.fire.rounds;
    case "hotShot":
    case "firePots":
      return C.fire.rounds + (hasStyle(by, "firebrand") ? S.firebrand.extraFireRounds : 0);
  }
}

/** A new fire on a ship. A ship that is already burning keeps whichever fire burns longer (the fire already there on a tie). */
export function ignite(blazes: Blazes, ship: ShipId, by: ShipId, rounds: number): Blazes {
  const burning = blazes[ship];
  return burning !== undefined && burning.rounds >= rounds ? blazes : { ...blazes, [ship]: { rounds, by } };
}

/**
 * The Hull a fire takes off a burning ship at the end of a round: `combat.fire.hull`, times the fire drill of a Gunline (it
 * loses 60% of it), or times what the pitch in a Firebrand's hold adds (it loses twice as much).
 */
export function fireLoss(ship: Pick<BattleShip, "style">): number {
  const drilled = hasStyle(ship, "gunline") ? S.gunline.fireDrill : NEUTRAL;
  const pitch = hasStyle(ship, "firebrand") ? S.firebrand.ownFire : NEUTRAL;
  return Math.round(C.fire.hull * drilled * pitch);
}

/** The Hull the flash of a Fire Pot costs a ship: `combat.deck.fireHull`, but never so much that the ship is left below 1 Hull. */
export const flashLoss = (hullPoints: number): number => Math.max(0, Math.min(C.deck.fireHull, hullPoints - 1));
