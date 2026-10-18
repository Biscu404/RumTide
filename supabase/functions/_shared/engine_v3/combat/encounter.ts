// Encounters (GAMEPLAY 3.7 step 6 and 8.1, v0.2 7.6 and 9): parley, the escape roll, the starting range, the battle, and
// what a finished battle does to the world: damage, loot, Wrecks and Flotsam, bounties, shields and towing.
//
// combatEncounter is the EncounterResolver resolveTide uses by default (D73). Like every engine function it draws no
// random number of its own except the escape roll, which comes from a child of the encounter's stream. The battle
// draws from rngFor(tideSeed, "battle", hunterId, targetId, round) inside runBattle. The resolver changes the ships,
// captains and state it is handed; resolveTide hands it clones, so the input state is never touched.

import { B, SEASON_PRESETS } from "../balance.ts";
import { CARGO_GOODS } from "../types.ts";
import type {
  ArchipelagoId, Captain, CaptainId, ReplayEvent, SeasonState, Ship, ShipId, WaterId, Wind,
} from "../types.ts";
import type { World } from "../map.ts";
import { nearestKnownHarbour } from "../plan.ts";
import { maxHands, maxHullPoints, maxRiggingPoints, powerRating, statValue } from "../ship.ts";
import type { EncounterContext, EncounterOutcome, EncounterResolver, EncounterSide } from "../tide.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput } from "./battle.ts";
import { doctrineChooser, pickDoctrine } from "./doctrine.ts";
import { cargoValue, carriedBy, jettison, scale, settleLoot } from "./loot.ts";
import type { Carried, SalvagePile } from "./loot.ts";
import { BATTLE_SIDES } from "./types.ts";
import type { BattleAftermath, BattleLoot, BattleRecord, BattleShip, BattleSide, EnemyType, OutcomeKind } from "./types.ts";

const E = B.escape;
const EPSILON = 1e-9; // a hunter exactly at the threshold counts, whatever the floating point product says
const AMBUSH_DEFAULT = "medium"; // a Lurker with no choice starts the battle at Medium (8.1)

const emptyCarried = (): Carried => ({ plunder: 0, goods: {} });

// ---------- The escape roll (v0.2 4.4 rule 5, 14) ----------

/**
 * The target's chance to slip away: its Sails over both ships' Sails, 1.3 times for a Quiet stance, plus 0.2 in Fog,
 * kept between 0.05 and 0.75. Sails here is the Sails stat, not the Rigging left (D77).
 */
export function escapeChance(targetSails: number, hunterSails: number, quiet: boolean, fog: boolean): number {
  const raw = (targetSails / (targetSails + hunterSails)) * (quiet ? E.quietMult : 1) + (fog ? E.fogBonus : 0);
  return Math.min(E.max, Math.max(E.min, raw));
}

// ---------- Parley (v0.2 7.6) ----------

export type ParleyResult =
  | { kind: "none" } // the target set no parley, or the hunter is not strong enough
  | { kind: "tribute"; threshold: number; fraction: number } // accepted: the target pays this share of its plunder and cargo and both sail on
  | { kind: "refused"; threshold: number }; // the hunter set No Quarter: the fight goes on

/** The target's offer against the hunter's strength. Run before the escape roll (3.7 step 6, D76). */
export function parleyResult(
  target: Pick<Captain, "parley">, hunter: Pick<Captain, "noQuarter">, targetPR: number, hunterPR: number,
): ParleyResult {
  const threshold = target.parley;
  if (threshold === "off" || !B.parley.thresholds.includes(threshold)) return { kind: "none" };
  if (hunterPR + EPSILON < targetPR * threshold) return { kind: "none" };
  return hunter.noQuarter ? { kind: "refused", threshold } : { kind: "tribute", threshold, fraction: B.parley.tribute };
}

// ---------- Moving what a ship carries ----------

function removeCarried(ship: Ship, c: Carried): void {
  ship.plunder = Math.max(0, ship.plunder - c.plunder);
  for (const good of CARGO_GOODS) ship.hold[good] = Math.max(0, ship.hold[good] - (c.goods[good] ?? 0));
}

function addCarried(ship: Ship, c: Carried): void {
  ship.plunder += c.plunder;
  for (const good of CARGO_GOODS) ship.hold[good] += c.goods[good] ?? 0;
}

/** The target hands over a share of its plunder and cargo to the hunter. Nothing is created or lost. */
function payTribute(from: Ship, to: Ship, fraction: number): Carried {
  const paid = scale(carriedBy(from), fraction);
  removeCarried(from, paid);
  addCarried(to, paid);
  return paid;
}

// ---------- Building a battle ----------

/** What kind of ship the enemy is, for the "enemy type" condition of a doctrine (D72, D78). */
export function enemyTypeOf(captain: Pick<Captain, "kind" | "npcRole">): EnemyType {
  if (captain.kind === "player") return "player";
  switch (captain.npcRole) {
    case "navy": return "navy";
    case "pirate": return "brethren";
    case "boss": return "monster";
    case "rookie": return "player"; // a Cradle Rookie fights like a captain in the same sloop
    default: return "merchant"; // merchants, locals and any NPC without a role are traders
  }
}

export interface BattleFlags {
  charted: boolean; // the water was Charted for this captain when the Tide began (D12, D40)
  withCurrent: boolean; // moving with a Strong Current (D41, D79)
  lurker: boolean; // lies in wait (8.1)
}

/** One ship as the battle sees it: derived stats, health, Powder, and no crew bonuses until crew exists (P8). */
export function battleShipOf(ship: Ship, captain: Pick<Captain, "id">, side: BattleSide, flags: BattleFlags): BattleShip {
  return {
    shipId: ship.id,
    captainId: captain.id,
    name: ship.name,
    side,
    hull: ship.hull,
    cannons: statValue(ship.hull, ship.levels.cannons),
    sails: statValue(ship.hull, ship.levels.sails),
    maxHullPoints: maxHullPoints(ship),
    maxRiggingPoints: maxRiggingPoints(ship),
    maxHands: maxHands(ship),
    helmBonus: 0,
    boardingBonus: 0,
    charted: flags.charted,
    withCurrent: flags.withCurrent,
    lurker: flags.lurker,
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.hold.powder,
    abilities: [],
    guns: { order: null, repeats: 0, charged: false },
  };
}

// ---------- Applying a battle to the world ----------

export interface ApplyBattleInput {
  state: SeasonState; // gets the Wrecks and Flotsam
  record: BattleRecord;
  ships: Record<BattleSide, Ship>;
  captains: Record<BattleSide, Captain>;
  powerRatings: Record<BattleSide, number>; // each side's Power Rating before the battle (D26)
  mutual: boolean; // both ships were hunting each other
  inCradle: boolean;
  refusedParley: boolean; // the hunter set No Quarter and turned a parley down (v0.2 9 rule 2)
}

export interface BattleApplied {
  aftermath: BattleAftermath;
  tow: ShipId[]; // ships to tow to a Harbour at the end of the Tide
  bounties: { captain: CaptainId; amount: number }[]; // bounties added, which start the next Tide at full size
}

/** The outcomes whose loser is towed to a Harbour at the end of the Tide (8.7). */
const TOWED: readonly OutcomeKind[] = ["sunk", "captured"];

function summary(result: ReturnType<typeof settleLoot>): BattleLoot {
  return { share: result.share, fairness: result.fairness, cradle: result.cradle, capped: result.capped, taken: result.taken, lost: result.lost };
}

/**
 * Puts a finished battle into the world: the damage the ships took, cargo thrown overboard as Flotsam, the loot (and the
 * Wreck of a Sunk ship), bounties, the shield after a PvP loss, and which ship needs towing. Changes the ships, captains
 * and state in `input`. Nothing in `record` changes.
 */
export function applyBattle(input: ApplyBattleInput): BattleApplied {
  const { state, record, ships, captains } = input;

  // The ships come out of the battle as the battle left them.
  for (const final of record.final) {
    const ship = ships[final.side];
    ship.hullPoints = final.hullPoints;
    ship.riggingPoints = final.riggingPoints;
    ship.hands = final.hands;
    ship.hold.powder = final.powder;
  }

  // Cargo thrown overboard is gone before the winner can take it (D60).
  const flotsam: SalvagePile[] = [];
  for (const side of record.jettisoned) {
    const ship = ships[side];
    const thrown = jettison(carriedBy(ship), ship.id, record.at, record.tide);
    for (const good of CARGO_GOODS) ship.hold[good] = 0;
    if (thrown.flotsam) {
      state.flotsam[thrown.flotsam.id] = thrown.flotsam;
      flotsam.push(thrown.flotsam);
    }
  }

  const { outcome } = record;
  const pvp = captains.hunter.kind === "player" && captains.target.kind === "player";
  const aftermath: BattleAftermath = {
    pvp, winner: null, loser: null, loot: null, wreck: null, flotsam,
    bounty: { added: 0, collected: 0 }, shieldUntil: null, towed: false,
  };
  const applied: BattleApplied = { aftermath, tow: [], bounties: [] };
  if (outcome.winner === null || outcome.loser === null) return applied;

  const winner = outcome.winner, loser = outcome.loser;
  aftermath.winner = ships[winner].id;
  aftermath.loser = ships[loser].id;

  // Loot by outcome, times the fairness factor, times the Cradle halving, capped (8.7).
  const result = settleLoot({
    outcome: outcome.kind, loser: ships[loser].id, carried: carriedBy(ships[loser]), at: record.at, tide: record.tide,
    pvp, inCradle: input.inCradle, loserPR: input.powerRatings[loser], winnerPR: input.powerRatings[winner],
  });
  removeCarried(ships[loser], result.lost);
  addCarried(ships[winner], result.taken);
  if (result.wreck) {
    state.wrecks[result.wreck.id] = result.wreck;
    aftermath.wreck = result.wreck;
  }
  aftermath.loot = summary(result);

  if (pvp) {
    // Whoever beats a captain with a bounty collects it, paid by the Admiralty (v0.2 9 rule 2).
    const owed = captains[loser].bounty;
    if (owed > 0) {
      ships[winner].plunder += owed;
      captains[loser].bounty = 0;
      aftermath.bounty.collected = owed;
    }
    // Hunting a ship under two thirds of your strength, or turning parley down, puts a bounty on the winner equal to the loot.
    const winnerHunted = winner === "hunter" || input.mutual;
    const huntedWeaker = input.powerRatings[loser] < B.fairness.bountyBelowRatio * input.powerRatings[winner];
    const value = cargoValue(result.taken);
    if (winnerHunted && (huntedWeaker || input.refusedParley) && value > 0) {
      captains[winner].bounty += value;
      aftermath.bounty.added = value;
      applied.bounties.push({ captain: captains[winner].id, amount: value });
    }
    // A PvP loss shields the loser from players for a while (v0.2 9 rule 3).
    captains[loser].shieldUntilTide = record.tide + B.shieldTidesAfterPvpLoss;
    aftermath.shieldUntil = captains[loser].shieldUntilTide;
  }

  if (TOWED.includes(outcome.kind)) {
    aftermath.towed = true;
    applied.tow.push(ships[loser].id);
  }
  return applied;
}

// ---------- Towing (8.7) ----------

/**
 * Tows a Sunk or Captured ship to the nearest Harbour its captain knows, or the season's start water when none can be
 * reached. It docks there, its plunder is banked, and its Hull is raised to at least half (D75). Run at the end of the Tide.
 */
export function towShip(
  world: World, state: SeasonState, ship: Ship, captain: Captain, winds: Record<ArchipelagoId, Wind>,
): { from: WaterId; to: WaterId; banked: number } {
  const from = ship.waterId;
  const to = nearestKnownHarbour(world, captain, ship, winds) ?? SEASON_PRESETS[state.preset].startWater;
  ship.waterId = to;
  ship.docked = true;
  const banked = ship.plunder;
  captain.chest += banked;
  ship.plunder = 0;
  ship.hullPoints = Math.max(ship.hullPoints, Math.ceil(maxHullPoints(ship) * B.tow.hullShare));
  return { from, to, banked };
}

// ---------- The resolver ----------

const resultOf = (kind: OutcomeKind): string => (kind === "escaped" ? "disengaged" : kind);

const battleShipFor = (side: EncounterSide, role: BattleSide): BattleShip =>
  battleShipOf(side.ship, side.captain, role, { charted: side.charted, withCurrent: side.withCurrent, lurker: side.lurking });

/** Hunting a player ends your own shield early (v0.2 9 rule 3). Shields are measured in whole Tides, so the shield ends before this one. */
const endShield = (captain: Captain, tide: number): void => {
  if (captain.shieldUntilTide >= tide) captain.shieldUntilTide = tide - 1;
};

/**
 * Parley, then the escape roll, then battle (3.7 step 6). A parley paid or an escape lets the ships sail on (the hunter
 * freezes when the target slips away); a battle freezes both. Neither happens in a mutual encounter: both ships chose the fight.
 */
export const combatEncounter: EncounterResolver = (ctx: EncounterContext): EncounterOutcome => {
  const { hunter, target, tide, t } = ctx;
  const events: ReplayEvent[] = [];
  const pair = { hunter: hunter.ship.id, target: target.ship.id };
  const powerRatings = { hunter: powerRating(hunter.ship), target: powerRating(target.ship) };

  if (hunter.captain.kind === "player" && target.captain.kind === "player") {
    endShield(hunter.captain, tide);
    if (ctx.mutual) endShield(target.captain, tide);
  }

  let refusedParley = false;
  if (!ctx.mutual) {
    const parley = parleyResult(target.captain, hunter.captain, powerRatings.target, powerRatings.hunter);
    if (parley.kind === "tribute") {
      const paid = payTribute(target.ship, hunter.ship, parley.fraction);
      events.push({ t, kind: "parley", ...pair, threshold: parley.threshold, accepted: true, paid });
      return { result: "tribute", freeze: [], events };
    }
    if (parley.kind === "refused") {
      refusedParley = true;
      events.push({ t, kind: "parley", ...pair, threshold: parley.threshold, accepted: false, paid: emptyCarried() });
    }

    const chance = escapeChance(
      statValue(target.ship.hull, target.ship.levels.sails), statValue(hunter.ship.hull, hunter.ship.levels.sails),
      target.stance === "quiet", ctx.terrain === "fog",
    );
    const roll = ctx.rng.stream("escape").next();
    const escaped = roll < chance;
    events.push({ t, kind: "escape", ...pair, chance, roll, escaped });
    if (escaped) return { result: "escaped", freeze: [hunter.ship.id], events };
  }

  // Battle. A Lurker who springs the ambush picks the starting range (8.1).
  const doctrines = { hunter: pickDoctrine(hunter.captain, hunter.doctrine), target: pickDoctrine(target.captain, target.doctrine) };
  const input: BattleInput = {
    tide, seed: ctx.seed, at: ctx.at, terrain: ctx.terrain ?? "open", wind: ctx.wind.kind,
    hunter: battleShipFor(hunter, "hunter"),
    target: battleShipFor(target, "target"),
    doctrines: { hunter: doctrines.hunter.name, target: doctrines.target.name },
    choosers: {
      hunter: doctrineChooser(doctrines.hunter, { enemyType: enemyTypeOf(target.captain) }),
      target: doctrineChooser(doctrines.target, { enemyType: enemyTypeOf(hunter.captain) }),
    },
    ...(hunter.lurking ? { ambush: hunter.ambushRange ?? AMBUSH_DEFAULT } : {}),
  };
  const record = runBattle(input);
  const applied = applyBattle({
    state: ctx.state, record,
    ships: { hunter: hunter.ship, target: target.ship },
    captains: { hunter: hunter.captain, target: target.captain },
    powerRatings, mutual: ctx.mutual,
    inCradle: ctx.archipelago === SEASON_PRESETS[ctx.state.preset].startArchipelago,
    refusedParley,
  });
  events.push({ t, kind: "battle", record, aftermath: applied.aftermath });
  return {
    result: resultOf(record.outcome.kind),
    freeze: BATTLE_SIDES.map((side) => (side === "hunter" ? hunter : target).ship.id),
    events,
    tow: applied.tow,
    bounties: applied.bounties,
  };
};
