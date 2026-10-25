// Old Shellback (GAMEPLAY 2.5, docs/specs/fighting-styles.md section 7): the gate boss of the Narrows. A giant hermit crab that wears a
// sunken galleon for a shell.
//
// This file holds what makes him what he is: his statline, his shell (what a hit does to him), his moods (he closes in, rears up in
// one seeded round, then grapples) with the doctrine that plays them, the claw snatch, the retreat that beats him, the Lurk plan that
// waits for captains who have not beaten him, the upkeep that makes him whole again at the start of every Tide (and a little more
// tired from Tide 9), and the gate, `bossesBeaten`, that the Crossing code (P5.6) will check. He is a real NPC captain with a real
// ship in the season state, so encounters, battles and replays treat him like any other ship. Pure: no randomness at all; the one
// roll of his fights, the round he rears up, is drawn by the battle from a stream of its own.
//
// Fighting him is the ordinary combat code, with a few small seams that all read the functions below: a fixed Helm score (helm.ts),
// the shell factor of every hit (guns.ts, battle.ts, fire.ts), the mood in his view and the snatch and the retreat (battle.ts), and no
// towing for a beaten boss (encounter.ts).

import { B, SEASON_PRESETS } from "../balance.ts";
import type { Captain, CaptainId, MapBoss, ReplayEvent, SeasonState, Ship, Statline, StraitId, VoyagePlan } from "../types.ts";
import type { World } from "../map.ts";
import type { BattleShip, Doctrine, GunsOrder, HelmMove, Mood, Range } from "./types.ts";

const S = B.shellback;

/** His captain id is his boss id on the map (`bosses` in cradle.json), and the id `bossesBeaten` lists. */
export const SHELLBACK_ID = "old_shellback";
export const SHELLBACK_DOCTRINE = "Claw and Shell";

/** A boss is an NPC captain with the `boss` role. */
export const isBoss = (captain: Pick<Captain, "kind" | "npcRole">): boolean => captain.kind === "npc" && captain.npcRole === "boss";

// ---------- The statline (2.5) ----------

/**
 * His numbers on a given Tide: Hull 300, no Rigging, claws that fight as 52 Hands, Cannons 22 and a Helm score of 10 (D140). From the
 * decay Tide on he loses 8% of his Hull every Tide, compounding, so each Tide he has 92% of the Hull of the Tide before and never
 * quite reaches 0 (D106). Tide 9 is the first Tide he is tired. The Hull is rounded to a whole point and never less than 1.
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

// ---------- The habits (2.5, fighting styles spec section 7) ----------

const NEUTRAL = 1; // a factor that changes nothing

/** Is this ship Old Shellback? His shell, moods, snatch and retreat are his alone, and he is known by his captain's id (D100). */
export const isShellback = (ship: Pick<BattleShip, "captainId">): boolean => ship.captainId === SHELLBACK_ID;

/**
 * The round he rears up in this fight: one of `rearUpRounds`, picked from the roll the battle drew from its own stream. `roll` is a
 * number from 0 up to but not including 1.
 */
export const rearUpRoundFor = (roll: number): number => {
  const rounds = S.rearUpRounds;
  return rounds[Math.min(rounds.length - 1, Math.floor(roll * rounds.length))] as number;
};

/** What he is doing in a round: closing in before the rear up, rearing up in that round, grappling after it. */
export const moodOf = (round: number, rearUp: number): Mood => (round < rearUp ? "closing" : round === rearUp ? "rearing" : "grappling");

/**
 * His shell: the part of a hit on him that gets through. Every hit does `armour` of its damage, except in the round he rears up.
 * A Mortar shell falls on the shell from above and does `mortarFactor` times its damage, ignoring the shell, in every round.
 * The same for any other ship: 1. `order` is the order the shooter really fired, so a ship without a Mortar fires Round shot.
 */
export function shellFactor(target: Pick<BattleShip, "captainId">, order: GunsOrder, rearing: boolean): number {
  if (!isShellback(target)) return NEUTRAL;
  if (order === "mortar") return S.mortarFactor;
  return rearing ? NEUTRAL : S.armour;
}

/** The shell on a hit that is not a shot (a Ram, the fire burning him): `armour`, except in the round he rears up. */
export const shellArmour = (target: Pick<BattleShip, "captainId">, rearing: boolean): number =>
  isShellback(target) && !rearing ? S.armour : NEUTRAL;

/**
 * The claw snatch: a ship that crosses his bow at Short or Close while he Closes In is caught, and the ships are Grappled. True when
 * his played move is Close In, the other flagship's is Cross Their Bow, and the range after the Helm step is Short or Close.
 */
export const snatches = (hisMove: HelmMove, theirMove: HelmMove, after: Range): boolean =>
  S.snatch && hisMove === "closeIn" && theirMove === "crossTheirBow" && (after === "short" || after === "close");

/**
 * Whether he retreats into his shell, and why: his Hull has fallen below `retreatHull` of its full ("hull"), or his claws below
 * `retreatClaws` of theirs ("claws"). A ship that retreats is beaten (D105), whatever the points say.
 */
export const retreatCause = (ship: Pick<BattleShip, "hullPoints" | "maxHullPoints" | "hands" | "maxHands">): "hull" | "claws" | null =>
  ship.hullPoints < S.retreatHull * ship.maxHullPoints ? "hull" : ship.hands < S.retreatClaws * ship.maxHands ? "claws" : null;

export const retreats = (ship: Pick<BattleShip, "hullPoints" | "maxHullPoints" | "hands" | "maxHands">): boolean => retreatCause(ship) !== null;

/**
 * His habits are a doctrine like a captain's, read top down, with one condition only a monster has: his mood (D102, D203). Before
 * the rear up he closes in with Round shot; in the round he rears up he holds still and holds fire, and his shell does not turn the
 * blow aside; after it he closes in and Boards. Once he holds a ship his claws Charge (the great guns are quiet while Grappled, and
 * he has no Powder to Volley): the rule comes first, so a ship he has snatched or boarded never sees him rear up (D175).
 * Because he Boards or snatches he is the boarder, so he has the boarder's edge: once he holds you, he is hard to shake.
 * A doctrine cannot name the round, so the battle tells his view his mood. Every number is in `B.shellback`.
 */
export const shellbackDoctrine = (): Doctrine => ({
  name: SHELLBACK_DOCTRINE,
  rules: [
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: { kind: "fight", helm: "closeIn", guns: "charge" } },
    { if: [{ kind: "mood", mood: "grappling" }], then: { kind: "fight", helm: "closeIn", guns: "board" } },
    { if: [{ kind: "mood", mood: "rearing" }], then: { kind: "fight", helm: "hold", guns: "holdFire" } },
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
 * Run at the start of every Tide, before anyone sails: each boss is whole again, with this Tide's Hull and his habits as the code has
 * them (D106, D203). Beaten, he
 * "retreats into his shell and is back next Tide, a little angrier". Changes `state` and returns the replay events of the
 * bosses that had something to recover, in captain id order. No randomness and no clock.
 */
export function upkeepBosses(state: SeasonState, tide: number): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const decayFrom = SEASON_PRESETS[state.preset].shellbackDecayFromTide;
  for (const id of Object.keys(state.captains).sort()) {
    const captain = state.captains[id] as Captain;
    const ship = state.ships[captain.shipId];
    if (!ship || !isBoss(captain) || captain.id !== SHELLBACK_ID) continue;
    const before = JSON.stringify([ship.statline, ship.hullPoints, ship.hands]);
    applyStatline(ship, shellbackStatline(tide, decayFrom));
    // His habits come from the code too, so a rework reaches a season already running (D203).
    captain.doctrines = [shellbackDoctrine()];
    captain.defaultDoctrine = SHELLBACK_DOCTRINE;
    if (JSON.stringify([ship.statline, ship.hullPoints, ship.hands]) !== before) {
      events.push({ t: 0, kind: "bossRecovers", ship: ship.id, hullPoints: ship.hullPoints, maxHullPoints: ship.statline?.maxHull ?? ship.hullPoints });
    }
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
