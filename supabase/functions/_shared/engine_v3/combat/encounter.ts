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
import { cannonsOf, drillOf, maxHands, maxHullPoints, maxRiggingPoints, powerRating, sailsOf } from "../ship.ts";
import type { EncounterContext, EncounterOutcome, EncounterResolver, EncounterSide } from "../tide.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, BattleMate } from "./battle.ts";
import { doctrineChooser, pickDoctrine } from "./doctrine.ts";
import { apportion, pickFlagship } from "./fleet.ts";
import { isBoss, recordBossWin } from "./shellback.ts";
import { cargoValue, carriedBy, jettison, scale, settleLoot, splitByHolding, splitCarried, sumCarried } from "./loot.ts";
import type { Carried, SalvagePile } from "./loot.ts";
import { BATTLE_SIDES } from "./types.ts";
import type {
  BattleAftermath, BattleLoot, BattleRecord, BattleShip, BattleSide, EnemyType, FleetAftermath, OutcomeKind,
} from "./types.ts";

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

/** One ship as the battle sees it: derived stats, health, Powder, Drill and Fire Pots, and no crew bonuses until crew exists (P8). */
export function battleShipOf(ship: Ship, captain: Pick<Captain, "id">, side: BattleSide, flags: BattleFlags): BattleShip {
  const drill = drillOf(ship);
  const pots = ship.hold.firePots ?? 0;
  return {
    shipId: ship.id,
    captainId: captain.id,
    name: ship.name,
    side,
    hull: ship.hull,
    ...(ship.style ? { style: ship.style } : {}), // the captain's Fighting Style: its trait, and the badge a replay shows
    cannons: cannonsOf(ship),
    sails: sailsOf(ship),
    maxHullPoints: maxHullPoints(ship),
    maxRiggingPoints: maxRiggingPoints(ship),
    maxHands: maxHands(ship),
    helmBonus: 0,
    boardingBonus: 0,
    ...(ship.statline ? { fixedHelm: ship.statline.helm } : {}), // a monster scores what its statline says (D101)
    charted: flags.charted,
    withCurrent: flags.withCurrent,
    lurker: flags.lurker,
    ...(drill > 0 ? { drill } : {}), // the Drill level, for boarding strength and the unlocks (absent means 0)
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.hold.powder,
    ...(pots > 0 ? { firePots: pots } : {}), // a ship that carries no Fire Pots has no field, as before
    abilities: [],
    guns: { order: null, repeats: 0, charged: false },
  };
}

// ---------- Applying a battle to the world ----------

export interface ApplyBattleInput {
  state: SeasonState; // gets the Wrecks and Flotsam
  record: BattleRecord;
  ships: Record<BattleSide, Ship>; // each side's flagship, or its only ship
  captains: Record<BattleSide, Captain>;
  mates?: Record<BattleSide, { ship: Ship; captain: Captain }[]>; // the other ships of each side in a fleet battle (P2.5); absent means one ship a side
  powerRatings: Record<BattleSide, number>; // each whole side's Power Rating before the battle, its ships' added up (D26, D88)
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

/** One ship of a battle with the captain who sails it. `id` is the id the BattleRecord uses for it. */
interface Member {
  id: ShipId;
  side: BattleSide;
  ship: Ship;
  captain: Captain;
}

const byId = (a: Member, b: Member): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Every ship of the battle, the hunter side first and each side in ship id order. */
function membersOf(input: ApplyBattleInput): Member[] {
  const side = (role: BattleSide, id: ShipId): Member[] => [
    { id, side: role, ship: input.ships[role], captain: input.captains[role] },
    ...(input.mates?.[role] ?? []).map((m) => ({ id: m.ship.id, side: role, ship: m.ship, captain: m.captain })),
  ].sort(byId);
  return [...side("hunter", input.record.hunter), ...side("target", input.record.target)];
}

/**
 * Puts a finished battle into the world: the damage the ships took, cargo thrown overboard as Flotsam, the loot (and the
 * Wreck of a Sunk ship), bounties, the shield after a PvP loss, and which ships need towing. Changes the ships, captains
 * and state in `input`. Nothing in `record` changes.
 *
 * A fleet is judged as one side (D88 to D91). The losing ships pay together: the table's share of everything they carry,
 * times the fairness factor of the two whole sides' ratings, each ship paying its part. The winners split what is taken by
 * the damage each dealt. Bounties and shields are per captain, and every losing ship of a Sunk or Captured battle is towed.
 */
export function applyBattle(input: ApplyBattleInput): BattleApplied {
  const { state, record, captains } = input;
  const members = membersOf(input);
  const memberOf = new Map(members.map((m) => [m.id, m]));

  // The ships come out of the battle as the battle left them.
  for (const final of record.final) {
    const m = memberOf.get(final.shipId);
    if (!m) continue;
    m.ship.hullPoints = final.hullPoints;
    m.ship.riggingPoints = final.riggingPoints;
    m.ship.hands = final.hands;
    m.ship.hold.powder = final.powder;
    if (final.firePots !== undefined) m.ship.hold.firePots = final.firePots; // thrown pots are used up
  }

  // Cargo thrown overboard is gone before the winner can take it (D60).
  const flotsam: SalvagePile[] = [];
  const thrown = record.fleet ? record.fleet.jettisoned : record.jettisoned.map((side) => (side === "hunter" ? record.hunter : record.target));
  for (const id of thrown) {
    const ship = memberOf.get(id)?.ship;
    if (!ship) continue;
    const result = jettison(carriedBy(ship), ship.id, record.at, record.tide);
    for (const good of CARGO_GOODS) ship.hold[good] = 0;
    if (result.flotsam) {
      state.flotsam[result.flotsam.id] = result.flotsam;
      flotsam.push(result.flotsam);
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
  const winners = members.filter((m) => m.side === winner);
  const losers = members.filter((m) => m.side === loser);
  const flagshipOf = (side: BattleSide): Member => memberOf.get(side === "hunter" ? record.hunter : record.target) as Member;
  aftermath.winner = flagshipOf(winner).ship.id;
  aftermath.loser = flagshipOf(loser).ship.id;

  // Loot by outcome, times the fairness factor, times the Cradle halving, capped (8.7). The losing ships are one pool.
  // A Sunk fleet leaves its Wreck where its first sunk ship went down.
  const sunkShip = losers.find((m) => (record.final.find((f) => f.shipId === m.id)?.hullPoints ?? 1) <= 0) ?? flagshipOf(loser);
  const holdings = losers.map((m) => carriedBy(m.ship));
  const result = settleLoot({
    outcome: outcome.kind, loser: sunkShip.ship.id, carried: sumCarried(holdings), at: record.at, tide: record.tide,
    pvp, inCradle: input.inCradle, loserPR: input.powerRatings[loser], winnerPR: input.powerRatings[winner],
  });
  // The winners split it by the damage each dealt (equally if nobody dealt any).
  const weights = winners.map((m) => record.fleet?.dealtBy[m.id] ?? 1);
  const takenBy = splitCarried(result.taken, weights);
  const lostBy = splitByHolding(result.lost, holdings);
  losers.forEach((m, i) => removeCarried(m.ship, lostBy[i] as Carried));
  winners.forEach((m, i) => addCarried(m.ship, takenBy[i] as Carried));
  if (result.wreck) {
    state.wrecks[result.wreck.id] = result.wreck;
    aftermath.wreck = result.wreck;
  }
  aftermath.loot = summary(result);

  const bounties: { captain: CaptainId; added: number; collected: number }[] = winners.map((m) => ({ captain: m.captain.id, added: 0, collected: 0 }));
  if (pvp) {
    // Whoever beats a captain with a bounty collects it, paid by the Admiralty (v0.2 9 rule 2). Winners split it like the loot.
    const owed = losers.reduce((sum, m) => sum + m.captain.bounty, 0);
    if (owed > 0) {
      const paid = apportion(owed, weights);
      winners.forEach((m, i) => {
        m.ship.plunder += paid[i] as number;
        (bounties[i] as { collected: number }).collected = paid[i] as number;
      });
      for (const m of losers) m.captain.bounty = 0;
      aftermath.bounty.collected = owed;
    }
    // Hunting a side under two thirds of your own strength, or turning parley down, puts a bounty on each winner equal to
    // the loot that winner took.
    const winnerHunted = winner === "hunter" || input.mutual;
    const huntedWeaker = input.powerRatings[loser] < B.fairness.bountyBelowRatio * input.powerRatings[winner];
    if (winnerHunted && (huntedWeaker || input.refusedParley)) {
      winners.forEach((m, i) => {
        const value = cargoValue(takenBy[i] as Carried);
        if (value <= 0) return;
        m.captain.bounty += value;
        aftermath.bounty.added += value;
        (bounties[i] as { added: number }).added = value;
        applied.bounties.push({ captain: m.captain.id, amount: value });
      });
    }
    // A PvP loss shields every losing captain from players for a while (v0.2 9 rule 3).
    for (const m of losers) m.captain.shieldUntilTide = record.tide + B.shieldTidesAfterPvpLoss;
    aftermath.shieldUntil = record.tide + B.shieldTidesAfterPvpLoss;
  }

  // Beating a boss opens its gate for every player on the winning side (2.5, D105).
  const beatenBoss = losers.find((m) => isBoss(m.captain));
  if (beatenBoss) {
    const by = recordBossWin(winners.map((m) => m.captain), beatenBoss.captain);
    if (by.length > 0) aftermath.beaten = { boss: beatenBoss.captain.id, by };
  }

  // A boss that loses retreats into its shell where it lay, whole again next Tide: it is never towed (2.5, D104).
  if (TOWED.includes(outcome.kind)) {
    for (const m of losers) if (!isBoss(m.captain)) applied.tow.push(m.ship.id);
    aftermath.towed = applied.tow.length > 0;
  }
  if (record.fleet) {
    const fleet: FleetAftermath = {
      winners: winners.map((m) => m.ship.id),
      losers: losers.map((m) => m.ship.id),
      taken: Object.fromEntries(winners.map((m, i) => [m.ship.id, takenBy[i] as Carried])),
      lost: Object.fromEntries(losers.map((m, i) => [m.ship.id, lostBy[i] as Carried])),
      bounties: bounties.filter((b) => b.added > 0 || b.collected > 0),
      towed: [...applied.tow],
    };
    aftermath.fleet = fleet;
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

/** A whole side's Power Rating: its ships' added up, as the fairness factor and parley judge a fleet (D88). */
const sideRating = (ships: readonly EncounterSide[]): number => ships.reduce((sum, s) => sum + powerRating(s.ship), 0);

/**
 * Parley, then the escape roll, then battle (3.7 step 6). A parley paid or an escape lets the ships sail on (the hunter
 * freezes when the target slips away); a battle freezes everyone in it. Neither happens in a mutual encounter: both ships
 * chose the fight. Fleet mates who joined (v0.2 7.5) take no part in a parley or an escape, which are between the two
 * leads, but their strength counts in the parley offer and they fight and freeze with their side if a battle follows.
 */
export const combatEncounter: EncounterResolver = (ctx: EncounterContext): EncounterOutcome => {
  const { hunter, target, tide, t } = ctx;
  const events: ReplayEvent[] = [];
  const pair = { hunter: hunter.ship.id, target: target.ship.id };
  // Each side's ships, the lead first: the ship that started the hunt, and the ship it caught.
  const sides: Record<BattleSide, EncounterSide[]> = {
    hunter: [hunter, ...(ctx.joined?.hunter ?? [])],
    target: [target, ...(ctx.joined?.target ?? [])],
  };
  const powerRatings = { hunter: sideRating(sides.hunter), target: sideRating(sides.target) };

  if (hunter.captain.kind === "player" && target.captain.kind === "player") {
    endShield(hunter.captain, tide);
    if (ctx.mutual) endShield(target.captain, tide);
  }

  let refusedParley = false;
  // A boss that is hunted stands and fights: it offers no parley and never slips away (2.5, D104).
  if (!ctx.mutual && !isBoss(target.captain)) {
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
      sailsOf(target.ship), sailsOf(hunter.ship),
      target.stance === "quiet", ctx.terrain === "fog",
    );
    const roll = ctx.rng.stream("escape").next();
    const escaped = roll < chance;
    events.push({ t, kind: "escape", ...pair, chance, roll, escaped });
    if (escaped) return { result: "escaped", freeze: [hunter.ship.id], events };
  }

  // Battle. A fleet mate who joins has chosen the fight, so a player's shield ends when the other side has a player (v0.2 9 rule 3).
  for (const role of BATTLE_SIDES) {
    const foes = sides[role === "hunter" ? "target" : "hunter"];
    for (const mate of ctx.joined?.[role] ?? []) {
      if (mate.captain.kind === "player" && foes.some((f) => f.captain.kind === "player")) endShield(mate.captain, tide);
    }
  }

  // Each side's flagship is its highest Power Rating, a tie going to the lead (7.5).
  const flagship = (role: BattleSide): EncounterSide => {
    const id = pickFlagship(sides[role].map((s, i) => ({ id: s.ship.id, power: powerRating(s.ship), lead: i === 0 })));
    return sides[role].find((s) => s.ship.id === id) as EncounterSide;
  };
  const flagships = { hunter: flagship("hunter"), target: flagship("target") };
  const doctrines = new Map(BATTLE_SIDES.flatMap((role) => sides[role].map((s) => [s.ship.id, pickDoctrine(s.captain, s.doctrine)] as const)));
  // Every ship's doctrine reads the enemy flagship (7.5), so its "enemy type" is the flagship captain's.
  const chooserFor = (s: EncounterSide, role: BattleSide) =>
    doctrineChooser(doctrines.get(s.ship.id)!, { enemyType: enemyTypeOf(flagships[role === "hunter" ? "target" : "hunter"].captain) });
  const matesOf = (role: BattleSide): BattleMate[] =>
    sides[role].filter((s) => s !== flagships[role]).map((s) => ({
      ship: battleShipFor(s, role), doctrine: doctrines.get(s.ship.id)!.name, chooser: chooserFor(s, role),
    }));
  // A Lurker who springs the ambush picks the starting range (8.1).
  const input: BattleInput = {
    tide, seed: ctx.seed, at: ctx.at, terrain: ctx.terrain ?? "open", wind: ctx.wind.kind,
    hunter: battleShipFor(flagships.hunter, "hunter"),
    target: battleShipFor(flagships.target, "target"),
    doctrines: { hunter: doctrines.get(flagships.hunter.ship.id)!.name, target: doctrines.get(flagships.target.ship.id)!.name },
    choosers: { hunter: chooserFor(flagships.hunter, "hunter"), target: chooserFor(flagships.target, "target") },
    ...(hunter.lurking ? { ambush: hunter.ambushRange ?? AMBUSH_DEFAULT } : {}),
    ...(sides.hunter.length + sides.target.length > BATTLE_SIDES.length
      ? {
          mates: { hunter: matesOf("hunter"), target: matesOf("target") },
          playerSide: {
            hunter: sides.hunter.every((s) => s.captain.kind === "player"),
            target: sides.target.every((s) => s.captain.kind === "player"),
          },
        }
      : {}),
  };
  const record = runBattle(input);
  const asMates = (role: BattleSide) => sides[role].filter((s) => s !== flagships[role]).map((s) => ({ ship: s.ship, captain: s.captain }));
  const applied = applyBattle({
    state: ctx.state, record,
    ships: { hunter: flagships.hunter.ship, target: flagships.target.ship },
    captains: { hunter: flagships.hunter.captain, target: flagships.target.captain },
    ...(record.fleet ? { mates: { hunter: asMates("hunter"), target: asMates("target") } } : {}),
    powerRatings, mutual: ctx.mutual,
    inCradle: ctx.archipelago === SEASON_PRESETS[ctx.state.preset].startArchipelago,
    refusedParley,
  });
  events.push({ t, kind: "battle", record, aftermath: applied.aftermath });
  return {
    result: resultOf(record.outcome.kind),
    freeze: BATTLE_SIDES.flatMap((role) => sides[role].map((s) => s.ship.id)),
    events,
    tow: applied.tow,
    bounties: applied.bounties,
  };
};
