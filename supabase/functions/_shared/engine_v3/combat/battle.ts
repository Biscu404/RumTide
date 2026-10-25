// runBattle (GAMEPLAY 8.3): one battle of up to five rounds between two sides, each one ship or a fleet of several.
// Pure: no network, no clock, no Math.random, and it never changes the ships it is given. Every roll comes from a
// labelled child of the round's stream rngFor(tideSeed, "battle", hunterId, targetId, round), so the same input
// always gives the same BattleRecord.
//
// What each ship does in a round is a Chooser: a function from what the ship can see to a Helm move and a Guns
// order (or Surrender). Doctrine evaluation (P2.3) builds the real Choosers; the tests here use scripted ones.
//
// Fleets (P2.5, GAME_DESIGN 7.5): `hunter` and `target` are the two flagships and `mates` are the other ships. Each ship's
// Chooser sees its own state and the enemy flagship, and nothing else of the enemy. The flagships' Helm moves move the
// range. A side's damage is its ships' added up, times the fleet bonus and Desperate Defence, and shared out between the
// enemy ships by max Hull. A battle with one ship a side runs exactly as it did before fleets existed.
//
// Fighting Styles (docs/specs/fighting-styles.md): each ship's style trait counts in the rounds its own move or order is
// played (styles.ts). Spotters set the starting range, the Helm step holds Slippery, the chase, Dash, Kite, Braced and Steady
// Deck, the Ram lands after the Helm step and before the guns, and the guns hold the Mortar, Zeroing In, Long Nines and Hot
// Shot. A ship given an order its style cannot give (the Mortar, for anyone but a Bombardier, Hot Shot, for anyone but a
// Firebrand) plays Round shot, and the record says so.
//
// The deck fight (docs/specs/boarding.md): while Grappled the great guns are quiet and the order a rule gives is a Deck order
// (deck.ts). The guns of the round the ships grapple fire at Close, and then the grapple happens. The ship whose Board made the
// grapple holds the boarder's edge until the grapple ends: First over the rail in the grapple round, and Lashed fast in every
// Cut Free contest. A deck fight still going after the last round goes on for up to B.combat.overtime more rounds.
//
// Fire (fire.ts): Hot Shot, the Mortar, a Firebrand's Fire Pots, a Fireship's embers and a ram on a Firebrand set a ship alight.
// A burning ship loses Hull at the end of the round, after the deck fight and before the end checks. The fires belong to the
// battle and burn out with it.
//
// Old Shellback (shellback.ts, spec section 7): his shell turns a fifth of every hit on him aside, except in the round he rears up
// (guns, Rams and fire), and a Mortar shell does three times its damage. Each fight he rears up in one round picked by a roll from
// a stream of its own, closes in before it and grapples after it: the battle tells his Chooser his mood. A ship that crosses his
// bow while he Closes In is snatched into a grapple, and he retreats into his shell, beaten, when his Hull or his claws fall low.

import { B } from "../balance.ts";
import { rngFor } from "../rng.ts";
import type { ShipId, Terrain, WaterId, WindKind } from "../types.ts";
import { captureCheckBySide, cutFree, lashedScores } from "./boarding.ts";
import { crewOrder } from "./deck.ts";
import { blazeRounds, fireLoss, flashLoss, ignite } from "./fire.ts";
import type { Blazes } from "./fire.ts";
import {
  apportion, fleetGrapples, fleetMelee, grapnelRescue, mateCutFree, mateHelm, noLosses, shareDamage, sideBonus, strikeTotals, withLosses,
} from "./fleet.ts";
import type { Shot } from "./fleet.ts";
import { fireGuns, recordFiring, shotPoints } from "./guns.ts";
import type { GunsResult } from "./guns.ts";
import { battleRng, contestRecord, isCrippled, helmScore, resolveHelm, startingRange, windGauge } from "./helm.ts";
import { isShellback, moodOf, rearUpRoundFor, retreatCause, shellArmour, shellFactor, snatches } from "./shellback.ts";
import {
  emberChance, firesLongNines, hasGrapnels, hasStyle, isRam, playableOrder, ramHull, ramSelf, shotFireChance, spotters, zeroingFactor,
} from "./styles.ts";
import { BATTLE_SIDES, DAMAGE_TRACKS } from "./types.ts";
import type {
  AmbushRange, BattleOutcome, BattleRecord, BattleShip, BattleSide, BurnRecord, ContestRecord, DamageTrack, DeckOrder, DeckRecord,
  FireRecord, FireSource, FleetRecord, FleetRoundRecord, GrappleRecord, GunsOrder, HelmMove, MeleeRecord, Mood, PotRecord, RamRecord,
  Range, RoundRecord, RoundShipRecord,
} from "./types.ts";

const C = B.combat;
const EPSILON = 1e-9; // a lead of exactly the margin counts, whatever the floating point sum says
const NEUTRAL = 1; // a factor that changes nothing

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

// ---------- What a ship chooses ----------

/** An ability rule that fired above the rule that gave the Helm move and Guns order (8.8). */
export interface AbilityFire {
  rule: number;
  ability: string;
}

export type RoundChoice =
  | {
      kind: "fight";
      rule: number; // index of the doctrine rule that gave the Helm move and Guns order
      abilities: AbilityFire[];
      helm: HelmMove;
      guns: GunsOrder;
      jettison?: boolean; // also throw the cargo overboard; the Helm move and Guns order are whatever the Chooser gave (a doctrine plays Hold and Hold Fire, D65)
    }
  | { kind: "surrender"; rule: number; abilities: AbilityFire[] };

/** What the ship played last round, after the Crippled rule. */
export interface LastPlay {
  helm: HelmMove;
  guns: GunsOrder;
}

/**
 * What a ship can see when it chooses: the state as the round begins. Choosers must not change it.
 * `ships[side]` is the choosing ship and `ships` of the other side is the enemy flagship, which is all a ship ever reads
 * of the enemy (7.5); in a one ship battle that is simply the two ships.
 */
export interface RoundView {
  round: number; // 1 to B.combat.rounds, and up to B.combat.overtime more while a deck fight is still going
  side: BattleSide; // the side of the ship choosing
  range: Range;
  terrain: Terrain;
  wind: WindKind;
  gauge: BattleSide | null;
  ships: Record<BattleSide, BattleShip>;
  last: Record<BattleSide, LastPlay | null>; // null before round 1
  jettisoned: Record<BattleSide, boolean>; // the ship has already thrown its cargo overboard in an earlier round (D66)
  mood?: Mood; // only in Old Shellback's own view, and not while he is Grappled: what he is doing this round (D202). A captain's Chooser never has one
}

export type Chooser = (view: RoundView) => RoundChoice;

// ---------- Input ----------

/** A fleet mate: a ship that fights beside its side's flagship, with its own doctrine (7.5). */
export interface BattleMate {
  ship: BattleShip;
  doctrine: string; // the name, for the record
  chooser: Chooser;
}

export interface BattleInput {
  tide: number;
  seed: number; // the Tide seed
  at: WaterId;
  terrain: Terrain;
  wind: WindKind;
  hunter: BattleShip; // the hunter side's flagship, or its only ship
  target: BattleShip; // the target side's flagship, or its only ship
  doctrines: Record<BattleSide, string>; // the names, for the record, of the two flagships' doctrines
  choosers: Record<BattleSide, Chooser>; // the two flagships' Choosers
  ambush?: AmbushRange; // the range a Lurker who springs an ambush chose (8.1)
  mates?: Record<BattleSide, BattleMate[]>; // the other ships of each side; absent means one ship a side (P2.5)
  playerSide?: Record<BattleSide, boolean>; // every ship of the side belongs to a player, so it may get Desperate Defence (7.5)
}

// ---------- Damage share (8.7 Victory on points) ----------

const trackMax = (ship: BattleShip, track: DamageTrack): number =>
  track === "hull" ? ship.maxHullPoints : track === "rigging" ? ship.maxRiggingPoints : ship.maxHands;

/** Hull, Rigging and Hands count alike, so a side with no Rigging at all has two tracks (D56). */
const trackCountOf = (ships: readonly BattleShip[]): number => (ships.some((s) => s.maxRiggingPoints > 0) ? 3 : 2);

/**
 * How much of a side's whole health `points` of damage on one track is, as a fraction between 0 and 1: the share of the
 * side's max on that track, averaged over its tracks (D56). A fleet's max is its ships' added up.
 */
export function sideShare(victims: readonly BattleShip[], track: DamageTrack, points: number): number {
  const max = victims.reduce((sum, s) => sum + trackMax(s, track), 0);
  return max > 0 ? points / max / trackCountOf(victims) : 0;
}

/** The share for one ship: how much of its whole health `points` of damage on one track is. */
export function damageShare(victim: BattleShip, track: DamageTrack, points: number): number {
  return sideShare([victim], track, points);
}

// ---------- Helpers ----------

const copyShip = (ship: BattleShip, side: BattleSide): BattleShip => ({ ...ship, side, abilities: [...ship.abilities], guns: { ...ship.guns } });

const withHands = (ship: BattleShip, hands: number): BattleShip => ({ ...ship, abilities: [...ship.abilities], guns: { ...ship.guns }, hands });

/** A ship after the abilities its doctrine fired this round: each one is used up, so "ability unused" turns false (D67). */
const spendAbilities = (ship: BattleShip, fired: AbilityFire[]): BattleShip => ({
  ...ship,
  abilities: ship.abilities.filter((a) => !fired.some((f) => f.ability === a)),
  guns: { ...ship.guns },
});

const NO_SHOT: Pick<GunsResult, "track" | "damage" | "powderUsed"> = { track: null, damage: 0, powderUsed: 0 };

function shipRecord(
  ship: BattleShip,
  choice: RoundChoice,
  helm: HelmMove,
  guns: GunsOrder,
  score: number,
  shot: Pick<GunsResult, "track" | "damage" | "powderUsed">,
  scrape: number,
  // the order the doctrine gave; the Mortar's shell; the deck fight; the fire that burned the ship; Old Shellback's mood; his shell's
  // effect on this ship's shot
  extra: {
    asked?: GunsOrder; mortar?: RoundShipRecord["mortar"] | undefined; deck?: DeckRecord | undefined; fire?: BurnRecord | undefined;
    mood?: Mood | undefined; shell?: number | undefined;
  } = {},
): RoundShipRecord {
  return {
    ship: ship.shipId,
    rule: choice.rule,
    abilities: choice.abilities.map((a) => ({ ...a })),
    helm,
    guns,
    ...(extra.asked !== undefined && extra.asked !== guns ? { asked: extra.asked } : {}),
    ...(extra.mortar ? { mortar: { ...extra.mortar } } : {}),
    ...(extra.mood ? { mood: extra.mood } : {}),
    ...(extra.shell !== undefined ? { shell: extra.shell } : {}),
    ...(extra.deck ? { deck: { ...extra.deck, ...(extra.deck.thrown ? { thrown: { ...extra.deck.thrown } } : {}) } } : {}),
    ...(extra.fire ? { fire: { ...extra.fire } } : {}),
    helmScore: score,
    shot: { track: shot.track, damage: shot.damage, powderUsed: shot.powderUsed },
    scrape,
    jettison: choice.kind === "fight" && choice.jettison === true,
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.powder,
    ...(ship.firePots !== undefined ? { firePots: ship.firePots } : {}),
  };
}

/**
 * After the last round: one side leads by the margin (5 points, D132) in damage share and wins Victory on points,
 * exactly the margin included. Otherwise it is a Draw (8.7).
 */
export function pointsOutcome(dealt: Record<BattleSide, number>, round: number): BattleOutcome {
  const lead = dealt.hunter - dealt.target;
  const winner: BattleSide = lead > 0 ? "hunter" : "target";
  return Math.abs(lead) >= C.victoryMargin - EPSILON
    ? { kind: "victory", winner, loser: other(winner), round }
    : { kind: "draw", winner: null, loser: null, round };
}

const sinkOutcome = (sunk: BattleSide[], dealt: Record<BattleSide, number>, round: number): BattleOutcome => {
  if (sunk.length === 1) return { kind: "sunk", winner: other(sunk[0]!), loser: sunk[0]!, round };
  // Both sides lost a ship in the same round: whoever dealt more damage in the battle wins (D54).
  if (dealt.hunter === dealt.target) return { kind: "draw", winner: null, loser: null, round };
  const winner: BattleSide = dealt.hunter > dealt.target ? "hunter" : "target";
  return { kind: "sunk", winner, loser: other(winner), round };
};

const byShipId = (a: BattleShip, b: BattleShip): number => (a.shipId < b.shipId ? -1 : a.shipId > b.shipId ? 1 : 0);

interface Member {
  ship: BattleShip;
  doctrine: string;
  chooser: Chooser;
}

// ---------- The battle ----------

/** Runs a battle to its end: up to B.combat.rounds rounds, then Victory on points or a Draw. */
export function runBattle(input: BattleInput): BattleRecord {
  const { tide, seed, at, terrain, wind } = input;
  const matesOf = input.mates ?? { hunter: [], target: [] };

  // The roster: each side's ships in ship id order, the flagship among them. Every ship is copied.
  const flag: Record<BattleSide, ShipId> = { hunter: input.hunter.shipId, target: input.target.shipId };
  const roster: Record<BattleSide, Member[]> = { hunter: [], target: [] };
  for (const side of BATTLE_SIDES) {
    const members: Member[] = [
      { ship: copyShip(input[side], side), doctrine: input.doctrines[side], chooser: input.choosers[side] },
      ...matesOf[side].map((m) => ({ ship: copyShip(m.ship, side), doctrine: m.doctrine, chooser: m.chooser })),
    ];
    roster[side] = members.sort((a, b) => byShipId(a.ship, b.ship));
  }
  const ids: Record<BattleSide, ShipId[]> = {
    hunter: roster.hunter.map((m) => m.ship.shipId),
    target: roster.target.map((m) => m.ship.shipId),
  };
  const all: ShipId[] = [...ids.hunter, ...ids.target];
  if (new Set(all).size !== all.length) throw new Error("A ship is in the battle twice");
  const isFleet = all.length > BATTLE_SIDES.length;
  const chooserOf: Record<ShipId, Chooser> = {};
  const doctrineOf: Record<ShipId, string> = {};
  let ships: Record<ShipId, BattleShip> = {};
  for (const member of [...roster.hunter, ...roster.target]) {
    chooserOf[member.ship.shipId] = member.chooser;
    doctrineOf[member.ship.shipId] = member.doctrine;
    ships[member.ship.shipId] = member.ship;
  }
  const shipsOf = (side: BattleSide, state: Record<ShipId, BattleShip>): BattleShip[] => ids[side].map((id) => state[id] as BattleShip);
  const sideOf = (id: ShipId): BattleSide => (ids.hunter.includes(id) ? "hunter" : "target");

  // Old Shellback's moods: the round he rears up is the one roll of his fights, drawn once from a stream of its own, and only when
  // he is in the battle, so no other roll moves (D16, D202).
  const shellbacks = all.filter((id) => isShellback(ships[id]!));
  const rearUp = shellbacks.length > 0 ? rearUpRoundFor(rngFor(seed, "battle", flag.hunter, flag.target, "rearUp").next()) : 0;

  const gauge = windGauge(ships[flag.hunter]!, ships[flag.target]!, terrain, wind);
  // Spotters: a battle with a Bombardier flagship starts at Far.
  const startRange = startingRange(terrain, input.ambush, spotters([ships[flag.hunter]!, ships[flag.target]!]));
  const initial = all.map((id) => copyShip(ships[id]!, sideOf(id)));
  const bonus = {
    hunter: sideBonus(ids.hunter.length, ids.target.length, input.playerSide?.hunter ?? false),
    target: sideBonus(ids.target.length, ids.hunter.length, input.playerSide?.target ?? false),
  };

  let range: Range = startRange;
  let last: Record<ShipId, LastPlay | null> = Object.fromEntries(all.map((id) => [id, null]));
  const dealt: Record<BattleSide, number> = { hunter: 0, target: 0 };
  const dealtBy: Record<ShipId, number> = Object.fromEntries(all.map((id) => [id, 0]));
  const jettisoned = new Set<ShipId>();
  const rounds: RoundRecord[] = [];
  let outcome: BattleOutcome | null = null;
  // Zeroing In: the rounds in a row each Bombardier has fired the Mortar with the range unchanged.
  let zeroing: Record<ShipId, number> = Object.fromEntries(all.map((id) => [id, 0]));
  // The side that holds the boarder's edge while the grapple lasts: the one whose Board made it. Nobody if both Boarded, or the
  // grapple came from Close In against Close In (boarding spec section 3).
  let edge: BattleSide | null = null;
  // The fires burning on each ship.
  let blazes: Blazes = {};

  // A deck fight still going after the last round goes on for up to C.overtime more (D127).
  for (let round = 1; (round <= C.rounds || (range === "grappled" && round <= C.rounds + C.overtime)) && outcome === null; round++) {
    const rng = battleRng(seed, flag.hunter, flag.target, round);

    // What Old Shellback is doing this round: none while the ships are Grappled, when his claws Charge (D175).
    const mood: Record<ShipId, Mood | undefined> = {};
    for (const id of shellbacks) mood[id] = range === "grappled" ? undefined : moodOf(round, rearUp);
    const rearing = (id: ShipId): boolean => mood[id] === "rearing";
    // The tell: in the round before he rears up he shows it, and only when he really does (D204).
    if (rounds.length > 0 && shellbacks.some(rearing)) {
      const before = rounds[rounds.length - 1]!;
      rounds[rounds.length - 1] = { ...before, ships: before.ships.map((s) => (rearing(s.ship) ? { ...s, tell: true as const } : s)) };
    }

    // A ship sees itself and the enemy flagship (7.5).
    const viewFor = (id: ShipId): RoundView => {
      const side = sideOf(id);
      const foe = flag[other(side)];
      return {
        round, side, range, terrain, wind, gauge,
        ships: { [side]: ships[id], [other(side)]: ships[foe] } as Record<BattleSide, BattleShip>,
        last: { [side]: last[id] ?? null, [other(side)]: last[foe] ?? null } as Record<BattleSide, LastPlay | null>,
        jettisoned: { [side]: jettisoned.has(id), [other(side)]: jettisoned.has(foe) } as Record<BattleSide, boolean>,
        ...(mood[id] ? { mood: mood[id] } : {}),
      };
    };
    const choices: Record<ShipId, RoundChoice> = {};
    for (const id of all) choices[id] = chooserOf[id]!(viewFor(id));

    // Abilities the doctrines fired are used up from here on. Resolving what they do is crew work (P8.4, D50).
    ships = Object.fromEntries(all.map((id) => [id, spendAbilities(ships[id]!, choices[id]!.abilities)]));
    const scoresNow: Record<ShipId, number> = {};
    for (const id of all) {
      const side = sideOf(id);
      scoresNow[id] = helmScore(ships[id]!, ships[flag[other(side)]]!, terrain, gauge === side);
    }

    // Surrender comes first: the colours come down and nothing else happens this round (D53). One ship striking
    // takes its whole side out of the fight.
    const struck = BATTLE_SIDES.filter((s) => ids[s].some((id) => choices[id]!.kind === "surrender"));
    if (struck.length > 0) {
      rounds.push({
        round, rangeBefore: range, rangeAfter: range, escaped: false, row: range === "grappled" ? "grappled" : "holdHold",
        contests: [], grapples: [], melee: null, crippled: [], struck,
        ships: all.map((id) => shipRecord(ships[id]!, choices[id]!, "hold", "holdFire", scoresNow[id]!, NO_SHOT, 0)),
        ...(isFleet
          ? { fleet: { damage: { hunter: noLosses(), target: noLosses() }, taken: {}, crippled: [], struck: all.filter((id) => choices[id]!.kind === "surrender") } }
          : {}),
      });
      outcome = struck.length === 2
        ? { kind: "draw", winner: null, loser: null, round }
        : { kind: "struckColours", winner: other(struck[0]!), loser: struck[0]!, round };
      break;
    }

    const fights = choices as Record<ShipId, Extract<RoundChoice, { kind: "fight" }>>;
    // The order each ship really gives: a doctrine copied from another style may name an order this ship cannot give.
    const orders: Record<ShipId, GunsOrder> = Object.fromEntries(all.map((id) => [id, playableOrder(ships[id]!, fights[id]!.guns)]));
    // Old Shellback's shell turns a fifth of a hit on him aside, except in the round he rears up, and a Mortar shell does three
    // times its damage (D201). The factor of each ship's shot is against the enemy flagship; against any other ship it is 1.
    const armour: Record<ShipId, number> = Object.fromEntries(
      all.map((id) => [id, shellFactor(ships[flag[other(sideOf(id))]]!, orders[id]!, rearing(flag[other(sideOf(id))]))]),
    );

    // 3. Helm resolves: range changes, rakes and flank shots, terrain overrides (8.4). The flagships move the range.
    const helm = resolveHelm(
      {
        range, terrain, hunter: ships[flag.hunter]!, target: ships[flag.target]!,
        moves: { hunter: fights[flag.hunter]!.helm, target: fights[flag.target]!.helm }, gauge,
      },
      rng,
    );
    const contests: ContestRecord[] = [...helm.contests];
    let after: Range = helm.range;
    const moves: Record<ShipId, HelmMove> = {};
    const scores: Record<ShipId, number> = {};
    const gunsMod: Record<ShipId, number> = {};
    const scrape: Record<ShipId, number> = {};
    const outrun = new Set<ShipId>(); // fleet mates that lost their chase of the enemy flagship this round
    for (const side of BATTLE_SIDES) {
      moves[flag[side]] = helm.moves[side];
      scores[flag[side]] = helm.scores[side];
      gunsMod[flag[side]] = helm.gunsMod[side];
      scrape[flag[side]] = helm.scrape[side];
    }
    // A fleet mate is judged against the enemy flagship: its own rake or flank shot, its own Reef scrape (7.5).
    for (const id of all) {
      if (id === flag.hunter || id === flag.target) continue;
      const side = sideOf(id);
      const m = mateHelm(
        ships[id]!, fights[id]!.helm, scoresNow[id]!,
        { move: helm.moves[other(side)], score: helm.scores[other(side)], ship: ships[flag[other(side)]]! },
        range, terrain, rng,
      );
      moves[id] = m.move;
      scores[id] = m.score;
      gunsMod[id] = m.gunsMod;
      scrape[id] = m.scrape;
      if (m.contest) {
        contests.push(m.contest);
        if (m.contest.winner !== side) outrun.add(id);
      }
    }
    // The edge in force this round, for the record: the one held coming in, or the one the grapple of this round makes.
    let roundEdge: BattleSide | null = range === "grappled" ? edge : null;
    let freedNow = false; // some ship cut free this round: the ships do not grapple again in it (D61)
    if (range === "grappled") {
      // Lashed fast: the Helm score of the boarder counts lashedFast times in every Cut Free contest while the grapple lasts, and
      // a ship with Grapnels is lashed fast in every grapple it is in (boarding spec sections 3 and 4).
      const lashed: Record<BattleSide, boolean> = {
        hunter: edge === "hunter" || hasGrapnels(ships[flag.hunter]!),
        target: edge === "target" || hasGrapnels(ships[flag.target]!),
      };
      const free = cutFree(rng, helm.moves, helm.scores, lashed);
      contests.push(...free.contests);
      let freed = free.freed;
      for (const id of all) {
        if (id === flag.hunter || id === flag.target) continue;
        const side = sideOf(id);
        const c = mateCutFree(ships[id]!, moves[id]!, scores[id]!, lashedScores(helm.scores, side, lashed)[other(side)], rng);
        if (!c) continue;
        contests.push(c);
        if (c.winner === c.side) freed = true;
      }
      if (freed) {
        after = "close";
        freedNow = true;
        edge = null; // the edge ends with the grapple (D61)
      }
    }

    // The claw snatch (spec section 7): a ship that crosses Old Shellback's bow at Short or Close while he Closes In is caught in his
    // claws, and the ships are Grappled. Only the flagships' moves count, the pair that moves the range (D91, D206).
    let snatchedBy: BattleSide | null = null;
    if (!helm.escaped && range !== "grappled") {
      for (const side of BATTLE_SIDES) {
        if (isShellback(ships[flag[side]]!) && snatches(helm.moves[side], helm.moves[other(side)], after)) snatchedBy = side;
      }
      if (snatchedBy !== null) after = "grappled";
    }

    // Fires lit this round, in the order they were lit.
    const fires: FireRecord[] = [];
    const light = (ship: ShipId, by: ShipId, source: FireSource, rounds: number): void => {
      blazes = ignite(blazes, ship, by, rounds);
      fires.push({ source, ship, by, rounds });
    };

    // The Ram (spec section 3): at Close, a Rammer's Close In strikes the enemy flagship (D91), after the Helm step and
    // before the guns. It misses when the flagship crossed its bow or got away (it won the chase, or the range opened), and
    // otherwise a Helm contest from "ram/<ship id>" decides. On a hit the flagship loses ramHull (less against a Braced
    // Gunline) and the Rammer ramSelf. Two Rammers can both Ram. A Ram that lands never grapples, but a Board can still.
    const rams: RamRecord[] = [];
    const ramLoss: Record<ShipId, number> = Object.fromEntries(all.map((id) => [id, 0]));
    if (!helm.escaped && range === "close") {
      const hullLeft = (id: ShipId): number => Math.max(0, ships[id]!.hullPoints - scrape[id]! - ramLoss[id]!);
      for (const id of all) {
        if (!isRam(ships[id]!, moves[id]!, range)) continue;
        const side = sideOf(id);
        const foeSide = other(side);
        const foe = flag[foeSide];
        const mate = id === flag[side] ? {} : { ship: id };
        const theirMove = helm.moves[foeSide];
        if (theirMove === "crossTheirBow") {
          rams.push({ side, ...mate, hit: false, why: "crossed", hull: 0, self: 0 });
          continue;
        }
        if ((after !== "close" && after !== "grappled") || outrun.has(id)) {
          rams.push({ side, ...mate, hit: false, why: "outrun", hull: 0, self: 0 });
          continue;
        }
        const contest = contestRecord(rng.stream("ram", id), "ram", side, { [side]: scores[id]!, [foeSide]: helm.scores[foeSide] } as Record<BattleSide, number>);
        contests.push({ ...contest, ...mate });
        if (contest.winner !== side) {
          rams.push({ side, ...mate, hit: false, why: "contest", hull: 0, self: 0 });
          continue;
        }
        const hull = Math.min(ramHull(ships[foe]!, theirMove, orders[foe], shellArmour(ships[foe]!, rearing(foe))), hullLeft(foe));
        const self = Math.min(ramSelf(), hullLeft(id));
        ramLoss[foe]! += hull;
        ramLoss[id]! += self;
        // The struck hull counts for the Rammer's side, and the Rammer's own hull for the other side, as the prototype did.
        const blow = sideShare(shipsOf(foeSide, ships), "hull", hull);
        const recoil = sideShare(shipsOf(side, ships), "hull", self);
        dealt[side] += blow;
        dealtBy[id]! += blow;
        dealt[foeSide] += recoil;
        dealtBy[foe]! += recoil;
        rams.push({ side, ...mate, hit: true, why: "contest", hull, self });
        // Fireship: a ship that Rams a Firebrand catches a blaze.
        if (hasStyle(ships[foe]!, "firebrand")) light(id, foe, "ram", blazeRounds("ram", ships[foe]!));
      }
      if (after === "grappled" && rams.some((r) => r.hit && r.ship === undefined)) after = "close";
    }
    const working: Record<ShipId, BattleShip> = Object.fromEntries(
      all.map((id) => [id, withLosses(ships[id]!, { ...noLosses(), hull: scrape[id]! + ramLoss[id]! })]),
    );

    let next = working;
    let grapples: GrappleRecord[] = [];
    const fired: Record<ShipId, GunsResult> = {};
    const zeroingNext: Record<ShipId, number> = {};
    let melee: MeleeRecord | null = null;
    const deckOf: Record<ShipId, DeckRecord> = {}; // what every crew did in the deck fight of this round
    const shots: Record<ShipId, Pick<GunsResult, "track" | "damage" | "powderUsed">> = Object.fromEntries(all.map((id) => [id, NO_SHOT]));
    const taken: Record<ShipId, Record<DamageTrack, number>> = Object.fromEntries(all.map((id) => [id, noLosses()]));
    const sideDamage: Record<BattleSide, Record<DamageTrack, number>> = { hunter: noLosses(), target: noLosses() };

    if (!helm.escaped) {
      // A Board order at Close (at Short too for a Boarder) tries to grapple, once the range is known (8.5). A Board that failed on
      // Helm score gets a Helm contest instead when the ship has Grapnels.
      const grappleIn = { range: after, ids, flagships: flag, orders, moves, scores, ships };
      grapples = freedNow ? [] : snatchedBy !== null ? [{ side: snatchedBy, ok: true, why: "snatch" }] : fleetGrapples(grappleIn);
      if (after === "short") grapples = grapples.map((g) => ({ ...g, from: "short" as const })); // only a Boarder's grapnel lines Board from Short
      if (grapples.some((g) => !g.ok && hasGrapnels(ships[g.ship ?? flag[g.side]]!))) {
        const rescued = grapnelRescue(grappleIn, grapples, rng);
        grapples = rescued.grapples;
        contests.push(...rescued.contests);
      }
      if (grapples.some((g) => g.ok)) after = "grappled";
      // The boarder is the side whose Board made the grapple. If both Boarded, or the grapple came from Close In against Close
      // In at Close, nobody has the edge.
      const grappleRound = range !== "grappled" && after === "grappled";
      if (grappleRound) {
        const boarders = BATTLE_SIDES.filter((s) => grapples.some((g) => g.ok && g.side === s));
        edge = boarders.length === 1 ? boarders[0]! : null;
        roundEdge = edge;
      }
      const boarded = (id: ShipId): boolean => grapples.some((g) => g.ok && (g.ship ?? flag[g.side]) === id);

      // 4. Guns fire at the same time, at the new range (8.5). Every ship fires from the state the round began with.
      // Only the enemy flagship is ever the aim, so Old Shellback's shell (`armour`, worked out above) counts only against him.
      // The Mortar takes the rake, flank and weakened factors (D137), and Zeroing In grows while the range holds. A Gunline
      // that Holds fires Long Nines. While Grappled the great guns are quiet, and also in the round a ship cuts free (D135). The
      // guns of the round the ships grapple fire at Close, as they come together, and then the grapple happens.
      const quiet = range === "grappled" && (after === "grappled" || C.quietCutFree);
      const gunRange: Range = quiet ? "grappled" : after === "grappled" ? "close" : after;
      for (const id of all) {
        const foe = other(sideOf(id));
        const mortar = orders[id] === "mortar" && !quiet;
        zeroingNext[id] = mortar && range === after ? zeroing[id]! + 1 : 0;
        fired[id] = fireGuns(working[id]!, working[flag[foe]!]!, gunRange, orders[id]!, rng, {
          terrain,
          helmMod: mortar && !B.styles.bombardier.mortarTakesRakes ? NEUTRAL : gunsMod[id]!,
          armour: armour[id]!,
          ...(mortar ? { zeroing: zeroingFactor(zeroingNext[id]!) } : {}),
          ...(firesLongNines(ships[id]!, moves[id]!) ? { longNines: true } : {}),
        });
      }
      // A side's guns are added up per track, times the fleet bonus and Desperate Defence, and shared out between the
      // enemy ships by max Hull (7.5). With one ship a side this is just each ship's shot against the other.
      for (const side of BATTLE_SIDES) {
        const foes = shipsOf(other(side), working);
        const sideShots: Shot[] = ids[side].map((id) => ({ ship: id, track: fired[id]!.track, points: shotPoints(fired[id]!.track, fired[id]!.raw) }));
        const totals = strikeTotals(sideShots, bonus[side].total);
        for (const track of DAMAGE_TRACKS) {
          const parts = shareDamage(foes, track, totals[track]);
          const dealtOnTrack = parts.reduce((sum, p) => sum + p, 0);
          foes.forEach((foe, i) => { taken[foe.shipId]![track] += parts[i]!; });
          sideDamage[side][track] = dealtOnTrack;
          const firing = sideShots.filter((s) => s.track === track);
          if (firing.length === 0) continue;
          const credit = sideShare(foes, track, dealtOnTrack);
          const split = apportion(dealtOnTrack, firing.map((s) => s.points));
          const weight = firing.reduce((sum, s) => sum + s.points, 0);
          dealt[side] += credit;
          firing.forEach((s, i) => {
            shots[s.ship] = { track, damage: split[i]!, powderUsed: fired[s.ship]!.powderUsed };
            dealtBy[s.ship]! += weight > 0 ? credit * (s.points / weight) : credit / firing.length;
          });
        }
      }
      for (const id of all) {
        if (fired[id]!.track === null) shots[id] = { track: null, damage: 0, powderUsed: fired[id]!.powderUsed };
      }
      next = Object.fromEntries(all.map((id) => [id, recordFiring(withLosses(working[id]!, taken[id]!), orders[id]!, fired[id]!)]));

      // A hit of Hot Shot or of the Mortar may set the enemy flagship alight. Each ship rolls from its own stream.
      for (const id of all) {
        const chance = shotFireChance(orders[id]!);
        if (chance <= 0 || fired[id]!.damage <= 0) continue;
        const source: FireSource = orders[id] === "mortar" ? "mortar" : "hotShot";
        if (rng.stream("fire", source, id).next() < chance) light(flag[other(sideOf(id))], id, source, blazeRounds(source, ships[id]!));
      }

      // 5. The deck fight if Grappled (8.6, boarding spec): side against side, each crew with its Deck order, judged against the
      // enemy flagship's. In the round the ships grapple only the crews whose Board made the grapple charge; the others fight with
      // Fists. First over the rail goes to the boarder's Boards.
      if (after === "grappled") {
        const decks: Record<ShipId, DeckOrder> = Object.fromEntries(
          all.map((id) => [id, crewOrder(ships[id]!, orders[id]!, { grappleRound, boarded: boarded(id) })]),
        );
        const firstOver = grappleRound && edge !== null ? all.filter((id) => sideOf(id) === edge && boarded(id)) : [];
        const m = fleetMelee({ ids, flagships: flag, ships: next, decks, terrain, bonus, firstOver });
        melee = { ...m.record, ...(firstOver.length > 0 ? { firstOver: edge! } : {}) };
        for (const id of all) next[id] = withHands(next[id]!, next[id]!.hands - m.lost[id]!);
        for (const side of BATTLE_SIDES) {
          const credit = sideShare(shipsOf(side, next), "hands", m.record.lost[side]);
          dealt[other(side)] += credit;
          for (const id of ids[other(side)]) dealtBy[id]! += credit * m.credit[id]!;
        }

        // A Volley burns Powder like a round of guns.
        for (const id of all) {
          if (decks[id] !== "volley") continue;
          const used = Math.min(next[id]!.powder, B.hulls[next[id]!.hull].powderPerRound);
          next[id] = { ...next[id]!, abilities: [...next[id]!.abilities], guns: { ...next[id]!.guns }, powder: next[id]!.powder - used };
          shots[id] = { ...shots[id]!, powderUsed: used };
        }

        // A Fire Pot is used up when it is thrown, and each throw rolls for a fire. A Firebrand's fire burns the enemy flagship. Any
        // other ship's fire is a flash that costs the throwing ship and the enemy flagship Hull at once, and never takes one below 1.
        const pots: Record<ShipId, PotRecord> = {};
        for (const id of all) {
          if (decks[id] !== "firePots") continue;
          const roll = rng.stream("fire", "pots", id).next();
          const fire = roll < C.deck.fireChance;
          pots[id] = { roll, fire };
          next[id] = { ...next[id]!, abilities: [...next[id]!.abilities], guns: { ...next[id]!.guns }, firePots: Math.max(0, (next[id]!.firePots ?? 0) - 1) };
          if (!fire) continue;
          const side = sideOf(id);
          const foe = flag[other(side)];
          if (hasStyle(next[id]!, "firebrand")) {
            light(foe, id, "firePots", blazeRounds("firePots", next[id]!));
            continue;
          }
          const blow = flashLoss(next[foe]!.hullPoints);
          const recoil = flashLoss(next[id]!.hullPoints);
          next[foe] = withLosses(next[foe]!, { ...noLosses(), hull: blow });
          next[id] = withLosses(next[id]!, { ...noLosses(), hull: recoil });
          const struck = sideShare(shipsOf(other(side), ships), "hull", blow);
          const hurt = sideShare(shipsOf(side, ships), "hull", recoil);
          dealt[side] += struck;
          dealtBy[id]! += struck;
          dealt[other(side)] += hurt;
          dealtBy[foe]! += hurt;
          fires.push({ source: "firePots", ship: foe, by: id, rounds: 0, hull: blow }, { source: "firePots", ship: id, by: foe, rounds: 0, hull: recoil });
        }

        // Fireship: while Grappled with a Firebrand, the embers may catch on the enemy deck.
        for (const id of all) {
          const chance = emberChance(ships[id]!);
          if (chance > 0 && rng.stream("fire", "embers", id).next() < chance) light(flag[other(sideOf(id))], id, "embers", blazeRounds("embers", ships[id]!));
        }

        for (const id of all) {
          deckOf[id] = { order: decks[id]!, pairing: m.pairings[id]!, ...(pots[id] ? { thrown: pots[id]! } : {}) };
        }
      }
    }

    // Fire: every burning ship loses Hull at the end of the round, after the deck fight. A fire can sink a ship. The damage
    // counts for the side that did not burn, and for the ship that lit the fire.
    const burns: Record<ShipId, BurnRecord> = {};
    for (const id of all) {
      const blaze = blazes[id];
      if (!blaze) continue;
      const loss = Math.min(next[id]!.hullPoints, fireLoss(next[id]!, shellArmour(next[id]!, rearing(id))));
      next[id] = withLosses(next[id]!, { ...noLosses(), hull: loss });
      const credit = sideShare(shipsOf(sideOf(id), ships), "hull", loss);
      dealt[other(sideOf(id))] += credit;
      dealtBy[blaze.by]! += credit;
      burns[id] = { hull: loss, left: blaze.rounds - 1 };
    }
    blazes = Object.fromEntries(Object.entries(blazes).filter(([, b]) => b.rounds > 1).map(([id, b]) => [id, { ...b, rounds: b.rounds - 1 }]));

    const crippled = BATTLE_SIDES.filter((s) => ids[s].some((id) => isCrippled(next[id]!) && !isCrippled(ships[id]!)));
    for (const id of all) if (fights[id]!.jettison) jettisoned.add(id);

    const fleetRound: FleetRoundRecord | null = isFleet
      ? {
          damage: sideDamage, taken,
          crippled: all.filter((id) => isCrippled(next[id]!) && !isCrippled(ships[id]!)),
          struck: [],
        }
      : null;
    const shellOf = (id: ShipId): RoundShipRecord["mortar"] | undefined => {
      const shell = fired[id]?.shell;
      return shell ? { roll: shell.roll, hit: shell.hit, zeroing: fired[id]!.factors?.zeroing ?? NEUTRAL } : undefined;
    };
    rounds.push({
      round, rangeBefore: range, rangeAfter: after, escaped: helm.escaped, row: helm.row,
      contests, grapples, ...(rams.length > 0 ? { rams } : {}), ...(roundEdge !== null ? { edge: roundEdge } : {}),
      ...(fires.length > 0 ? { fires } : {}), ...(round > C.rounds ? { overtime: true as const } : {}), melee, crippled, struck: [],
      ships: all.map((id) => shipRecord(next[id]!, fights[id]!, moves[id]!, orders[id]!, scores[id]!, shots[id]!, scrape[id]!, {
        asked: fights[id]!.guns, mortar: shellOf(id), deck: deckOf[id], fire: burns[id], mood: mood[id],
        ...(armour[id] !== NEUTRAL && fired[id]?.track ? { shell: armour[id]! } : {}),
      })),
      ...(fleetRound ? { fleet: fleetRound } : {}),
    });

    // 6. End checks: Sunk, Captured, Escaped (8.7). Struck Colours was settled at the top of the round.
    const sunk = BATTLE_SIDES.filter((s) => ids[s].some((id) => next[id]!.hullPoints <= 0));
    if (sunk.length > 0) {
      outcome = sinkOutcome(sunk, dealt, round);
    } else if (melee) {
      const capture = captureCheckBySide(
        { hunter: shipsOf("hunter", next).reduce((n, s) => n + s.maxHands, 0), target: shipsOf("target", next).reduce((n, s) => n + s.maxHands, 0) },
        melee.hands,
      );
      if (capture.draw) outcome = { kind: "draw", winner: null, loser: null, round };
      else if (capture.loser) outcome = { kind: "captured", winner: other(capture.loser), loser: capture.loser, round };
    }
    // Old Shellback retreats into his shell once his Hull or his claws fall low. He is driven off: a Struck Colours the other side
    // wins, so the Tide loop, the loot and `bossesBeaten` treat it like any other (D105, D205).
    if (outcome === null) {
      for (const side of BATTLE_SIDES) {
        const crab = next[flag[side]]!;
        const cause = isShellback(crab) ? retreatCause(crab) : null;
        if (cause) outcome = { kind: "struckColours", winner: other(side), loser: side, round, drivenOff: cause };
      }
    }
    if (outcome === null && helm.escaped) outcome = { kind: "escaped", winner: null, loser: null, round };

    ships = next;
    range = after;
    zeroing = Object.fromEntries(all.map((id) => [id, zeroingNext[id] ?? 0]));
    last = Object.fromEntries(all.map((id) => [id, { helm: moves[id]!, guns: orders[id]! }]));
  }


  // After the last round: Victory on points or a Draw (8.7). A Victory on points never beats Old Shellback: with him in the battle
  // it is a Draw, whoever led, and he has to be sunk, captured or driven off (D105, D205).
  if (outcome === null) {
    const points = pointsOutcome(dealt, rounds.length);
    outcome = points.kind === "victory" && !B.shellback.pointsBeatHim && shellbacks.length > 0
      ? { kind: "draw", winner: null, loser: null, round: points.round }
      : points;
  }

  const fleet: FleetRecord | null = isFleet
    ? {
        sides: { hunter: [...ids.hunter], target: [...ids.target] },
        doctrines: { ...doctrineOf },
        bonus,
        dealtBy: { ...dealtBy },
        jettisoned: all.filter((id) => jettisoned.has(id)),
      }
    : null;
  return {
    tide, seed, at, terrain, wind,
    hunter: flag.hunter,
    target: flag.target,
    doctrines: { ...input.doctrines },
    startRange, gauge,
    ships: initial,
    rounds,
    outcome,
    final: all.map((id) => copyShip(ships[id]!, sideOf(id))),
    dealt,
    jettisoned: BATTLE_SIDES.filter((s) => ids[s].some((id) => jettisoned.has(id))),
    ...(fleet ? { fleet } : {}),
  };
}
