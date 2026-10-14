// Section 4.4 rules 4 and 5, section 9 rule 3 (shields) and section 7.6 (parley).
// A meeting (movement.ts) becomes an encounter only if someone is hunting and the other ship is not
// protected. The hunted ship then tries to escape; if it cannot, parley may end it; otherwise
// the ships fight (combat.ts).
//
// Once a pair has escaped each other, they do not meet again for the rest of that Tide
// (docs/DECISIONS.md). The resolver keeps the set of escaped pairs; use pairKey for it.

import { B, escapeChance } from "./balance.ts";
import type { Rng } from "./rng.ts";
import type { Intent, Orders } from "./types.ts";

/** A ship as the encounter rules see it, with this Tide's orders already folded in. */
export interface EncounterShip {
  id: string;
  kind: "player" | "npc";
  fleetId: string | null;
  docked: boolean;
  shieldUntilTide: number | null;
  intent: Intent;
  huntFilter?: Orders["huntFilter"];
  /** The Sails stat value, not the level. */
  sails: number;
  pr: number;
  parley: Orders["parley"];
  noQuarter: boolean;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The key for a pair of ships, the same whichever order they are named in. */
export const pairKey = (a: string, b: string) => (compareIds(a, b) <= 0 ? `${a}|${b}` : `${b}|${a}`);

/** Last Tide on which a captain who lost a PvP battle on `tide` is shielded. */
export const shieldUntilAfterLoss = (tide: number) => tide + B.shieldTidesAfterPvpLoss;

/** Does this ship's hunt include players? Hunting players ends your own shield (section 9 rule 3). */
export function huntsPlayers(ship: Pick<EncounterShip, "intent" | "huntFilter">): boolean {
  if (ship.intent !== "hunt") return false;
  return (ship.huntFilter ?? "merchants") !== "merchants";   // players, anyone, a named captain
}

/** Docked, or under a shield. A shield ends the moment its owner hunts players. */
export function isProtected(ship: EncounterShip, tide: number): boolean {
  if (ship.docked) return true;
  if (ship.kind === "npc" || ship.shieldUntilTide === null) return false;
  return tide <= ship.shieldUntilTide && !huntsPlayers(ship);
}

/** Does `hunter`'s filter pick out `other`? Fleet mates cannot hunt each other (section 8.1). */
export function huntMatches(hunter: EncounterShip, other: EncounterShip): boolean {
  if (hunter.intent !== "hunt") return false;
  if (hunter.fleetId !== null && hunter.fleetId === other.fleetId) return false;
  const filter = hunter.huntFilter ?? "merchants";   // submit_orders requires a filter, this is only a safe default
  if (filter === "anyone") return true;
  if (filter === "merchants") return other.kind === "npc";   // every NPC counts, the galleon included
  if (filter === "players") return other.kind === "player";
  return other.kind === "player" && other.id === filter.captainId;
}

export interface Encounter {
  /** Ships that chose to fight, in id order. Two when both are hunting each other. */
  hunters: string[];
  /** The ship that tries to escape, or null if both are hunting each other and nobody flees. */
  hunted: string | null;
}

/** Rule 4: do these two ships, which just met, start an encounter? */
export function encounterBetween(a: EncounterShip, b: EncounterShip, tide: number): Encounter | null {
  const aHunts = huntMatches(a, b) && !isProtected(b, tide);
  const bHunts = huntMatches(b, a) && !isProtected(a, tide);
  if (aHunts && bHunts) return { hunters: [a.id, b.id].sort(compareIds), hunted: null };
  if (aHunts) return { hunters: [a.id], hunted: b.id };
  if (bHunts) return { hunters: [b.id], hunted: a.id };
  return null;
}

/** Rule 5: the hunted ship tries to slip away. Always draws one random number. */
export function rollEscape(hunted: EncounterShip, hunter: EncounterShip, rng: Rng): boolean {
  const roll = rng.next();
  return roll < escapeChance(hunted.sails, hunter.sails, hunted.intent === "quiet");
}

export type ParleyResult =
  | { kind: "none" }                       // the hunted ship set no parley, or the hunter is not strong enough
  | { kind: "tribute"; fraction: number }  // accepted: the hunted pays this share of plunder and cargo and sails on
  | { kind: "refused" };                   // the hunter set No Quarter: fight, and the hunter earns a bounty

/** Section 7.6. Run after a failed escape roll. */
export function parleyResult(hunted: EncounterShip, hunter: EncounterShip): ParleyResult {
  if (hunted.kind === "npc" || hunted.parley === "off") return { kind: "none" };
  if (hunter.pr < hunted.pr * hunted.parley) return { kind: "none" };
  return hunter.noQuarter ? { kind: "refused" } : { kind: "tribute", fraction: B.parley.tribute };
}
