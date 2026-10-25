// Old Shellback (GAMEPLAY 2.5): the gate boss of the Narrows. A giant hermit crab that wears a sunken galleon for a shell.
//
// This file holds what makes him what he is: his statline, his habits (a doctrine like any captain's, plus one move only a
// monster has), the Lurk plan that waits for captains who have not beaten him, the upkeep that makes him whole again at the
// start of every Tide (and a little more tired from Tide 9), and the gate, `bossesBeaten`, that the Crossing code (P5.6)
// will check. He is a real NPC captain with a real ship in the season state, so encounters, battles and replays treat him
// like any other ship. Pure: no randomness at all; every roll of his fights comes from the battle.
//
// Spawning him is season.ts (newBoss). Fighting him is the ordinary combat code, with three small seams: a fixed Helm score
// (helm.ts), the `exposed` move of his third round (guns.ts, battle.ts), and no towing for a beaten boss (encounter.ts).

import { B, SEASON_PRESETS } from "../balance.ts";
import type { Captain, CaptainId, MapBoss, ReplayEvent, SeasonState, Ship, Statline, StraitId, VoyagePlan } from "../types.ts";
import type { World } from "../map.ts";
import type { Doctrine } from "./types.ts";

const S = B.shellback;

/** His captain id is his boss id on the map (`bosses` in cradle.json), and the id `bossesBeaten` lists. */
export const SHELLBACK_ID = "old_shellback";
export const SHELLBACK_DOCTRINE = "Claw and Shell";

/** A boss is an NPC captain with the `boss` role. */
export const isBoss = (captain: Pick<Captain, "kind" | "npcRole">): boolean => captain.kind === "npc" && captain.npcRole === "boss";

// ---------- The statline (2.5) ----------

/**
 * His numbers on a given Tide: Hull 300, no Rigging, claws that fight as 40 Hands. From the decay Tide on he loses 8% of his
 * Hull every Tide, compounding, so each Tide he has 92% of the Hull of the Tide before and never quite reaches 0 (D106).
 * Tide 9 is the first Tide he is tired. The Hull is rounded to a whole point and never less than 1.
 */
export function shellbackStatline(tide: number, decayFromTide: number): Statline {
  let hull = S.hull;
  for (let i = decayFromTide; i <= tide; i++) hull *= 1 - S.decayPerTide;
  return {
    maxHull: Math.max(1, Math.round(hull)),
    maxRigging: 0,
    maxHands: S.clawHands,
    cannons: S.cannons,
    sails: S.sails,
    helm: S.helm,
  };
}

/** Gives a boss ship its statline and makes it whole: full Hull and claws, fed, with a full magazine (D106). */
export function applyStatline(ship: Ship, line: Statline): void {
  ship.statline = line;
  ship.hullPoints = line.maxHull;
  ship.riggingPoints = line.maxRigging;
  ship.hands = line.maxHands;
  ship.handsWounded = 0;
  ship.shortRations = false;
  ship.hold.provisions = B.start.provisions;
  ship.hold.powder = B.start.powder;
}

// ---------- The habits (2.5) ----------

/**
 * Rounds 1 and 2 he closes in. In round 3 he rears up and exposes his soft underside, so Round shot does double damage to
 * him. In rounds 4 and 5 he grapples. It is a doctrine like a captain's: round conditions, a Helm move and a Guns order.
 * The rear up is the one thing a captain's doctrine cannot say (D102). Every number is in `B.shellback`.
 */
export const shellbackDoctrine = (): Doctrine => ({
  name: SHELLBACK_DOCTRINE,
  rules: [
    { if: [{ kind: "round", op: "atLeast", n: S.grappleFromRound }], then: { kind: "fight", helm: "closeIn", guns: "board" } },
    { if: [{ kind: "round", op: "is", n: S.rearUpRound }], then: { kind: "fight", helm: "hold", guns: "holdFire", exposed: S.rearUpRoundShot } },
    { if: [], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
  ],
});

// ---------- The plan ----------

/**
 * What a boss does every Tide: lie in wait in its water and engage only the players who have not beaten it (D103). A
 * captain who has beaten him is not engaged at all, so he passes freely. It uses the boss's own doctrine. Orders are never
 * written for a boss, so this is its standing plan (plan.ts).
 */
export const bossPlan = (captain: Pick<Captain, "id" | "defaultDoctrine">): VoyagePlan => ({
  steps: [{ kind: "lurk", filter: { kind: "notBeaten", boss: captain.id } }],
  doctrine: captain.defaultDoctrine,
});

// ---------- Upkeep ----------

/**
 * Makes Old Shellback whole with this Tide's statline (D106): full Hull, claws and magazine, whatever the last fight left of
 * him. Returns the replay event when anything changed, `t` being the tick it happens on (0 at the start of a Tide).
 */
export function restoreBoss(state: SeasonState, ship: Ship, tide: number, t = 0): ReplayEvent | null {
  const before = JSON.stringify([ship.statline, ship.hullPoints, ship.hands]);
  applyStatline(ship, shellbackStatline(tide, SEASON_PRESETS[state.preset].shellbackDecayFromTide));
  if (JSON.stringify([ship.statline, ship.hullPoints, ship.hands]) === before) return null;
  return { t, kind: "bossRecovers", ship: ship.id, hullPoints: ship.hullPoints, maxHullPoints: ship.statline?.maxHull ?? ship.hullPoints };
}

/**
 * Run at the start of every Tide, before anyone sails: each boss is whole again, with this Tide's Hull (D106). Beaten, he
 * "retreats into his shell and is back next Tide, a little angrier". He is also made whole after every fight, so the next
 * captain who reaches him meets him whole (D108, see encounter.ts). Changes `state` and returns the replay events of the
 * bosses that had something to recover, in captain id order. No randomness and no clock.
 */
export function upkeepBosses(state: SeasonState, tide: number): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  for (const id of Object.keys(state.captains).sort()) {
    const captain = state.captains[id] as Captain;
    const ship = state.ships[captain.shipId];
    if (!ship || !isBoss(captain) || captain.id !== SHELLBACK_ID) continue;
    const event = restoreBoss(state, ship, tide);
    if (event) events.push(event);
  }
  return events;
}

// ---------- The gate (2.5, 2.4) ----------

/** Beating a boss: every player on the winning side who has not already beaten it adds its id to `bossesBeaten`, which stays sorted. Returns who is new. */
export function recordBossWin(winners: readonly Captain[], boss: Pick<Captain, "id">): CaptainId[] {
  const newcomers: CaptainId[] = [];
  for (const captain of winners) {
    if (captain.kind !== "player" || captain.bossesBeaten.includes(boss.id)) continue;
    captain.bossesBeaten.push(boss.id);
    captain.bossesBeaten.sort();
    newcomers.push(captain.id);
  }
  return newcomers;
}

export const hasBeaten = (captain: Pick<Captain, "bossesBeaten">, boss: string): boolean => captain.bossesBeaten.includes(boss);

/** The boss that blocks a strait until a captain has beaten it, or undefined when the strait is open to everyone. */
export const bossAtStrait = (world: World, strait: StraitId): MapBoss | undefined => world.map.bosses.find((b) => b.gates.includes(strait));

/** Whether a captain may cross a strait: it is open, or the boss that guards it has been beaten by them (2.4, 2.5). The Crossing code (P5.6) asks this. */
export function mayCross(world: World, captain: Pick<Captain, "bossesBeaten">, strait: StraitId): boolean {
  const boss = bossAtStrait(world, strait);
  return !boss || hasBeaten(captain, boss.id);
}
