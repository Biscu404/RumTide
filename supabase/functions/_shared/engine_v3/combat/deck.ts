// The deck fight (docs/specs/boarding.md sections 2 and 3, D116 to D118): the Deck orders, the cycle, and what a crew removes
// from the other in a Grappled round. Pure, with no randomness of its own: the only roll of the deck fight, whether a thrown
// Fire Pot catches, is drawn by battle.ts from its own labelled stream.
//
// While Grappled the great guns are quiet, and the order a rule gives is a Deck order. Charge beats Volley, Volley beats Repel
// and Repel beats Charge, like the Helm cycle of 8.4; Fire Pots and Fists are outside the cycle. Fists is what a crew fights
// with when it cannot use its order: a Guns order, a Volley with no Powder, Fire Pots with no pot or no right to throw it.

import { B } from "../balance.ts";
import { drillUnlocked } from "../ship.ts";
import { canThrowPots } from "./styles.ts";
import type { BattleShip, DeckOrder, GunsOrder, Pairing } from "./types.ts";

const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing

/** Charge beats Volley (the charge reaches the muskets before they reload), Volley beats Repel, Repel beats Charge. */
const BEATS: Readonly<Partial<Record<DeckOrder, DeckOrder>>> = { charge: "volley", volley: "repel", repel: "charge" };

/** How `mine` met `theirs`: it won the pairing of the cycle, lost it, or neither (Fire Pots and Fists are outside the cycle). */
export function pairing(mine: DeckOrder, theirs: DeckOrder): Pairing {
  if (BEATS[mine] === theirs) return "won";
  if (BEATS[theirs] === mine) return "lost";
  return "even";
}

/** The winning order hits harder (`pairWin`), the losing order softer (`pairLose`), otherwise 1. */
export const pairFactor = (p: Pairing): number => (p === "won" ? C.deck.pairWin : p === "lost" ? C.deck.pairLose : NEUTRAL);

export interface CrewContext {
  /** The ships were not Grappled when the round began: they grapple in this round, and the guns have fired at Close. */
  grappleRound: boolean;
  /** This ship's own Board order made the grapple, or joined it (both ships Board). */
  boarded: boolean;
}

/**
 * The Deck order a crew really fights with this round. `ship` is the ship as the round began, so Powder and pots are what it
 * had then.
 *
 * In the round the ships grapple, the crew whose Board made the grapple fights as a Charge (First over the rail is the edge's
 * bonus, worked out with the strength); every other crew chose its order before the grapple and fights with Fists. After that
 * a Charge, a Repel, a Volley that has Powder and Fire Pots that can be thrown count as they are given, and every other order,
 * the great guns' among them, means Fists.
 */
export function crewOrder(ship: Pick<BattleShip, "style" | "drill" | "firePots" | "powder">, played: GunsOrder, ctx: CrewContext): DeckOrder {
  if (ctx.grappleRound) return ctx.boarded ? "charge" : "fists";
  switch (played) {
    case "charge": return "charge";
    case "repel": return "repel";
    case "volley": return ship.powder > 0 ? "volley" : "fists";
    case "firePots": return canThrowPots(ship) ? "firePots" : "fists";
    default: return "fists";
  }
}

/** Second Wave (Drill 15): after the exchange the crew strikes once more at a share of its strength. */
export const hasSecondWave = (ship: Pick<BattleShip, "drill">): boolean => drillUnlocked(ship.drill ?? 0, "secondWave");

/**
 * The Hands a crew removes from the other: kill share x its boarding strength x the hit of its order x the pairing x the
 * guard of the other crew's order. Fire Pots ignore the guard of Repel. Second Wave adds `secondWaveShare` of the whole.
 */
export function deckKill(strength: number, mine: DeckOrder, theirs: DeckOrder, secondWave: boolean): number {
  const guard = mine === "firePots" && theirs === "repel" ? NEUTRAL : C.deck.guard[theirs];
  const wave = secondWave ? NEUTRAL + B.drill.secondWaveShare : NEUTRAL;
  return C.boarding.killShare * strength * C.deck.hit[mine] * pairFactor(pairing(mine, theirs)) * guard * wave;
}
