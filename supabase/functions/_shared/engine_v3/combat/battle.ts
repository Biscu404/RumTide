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

import { B } from "../balance.ts";
import type { ShipId, Terrain, WaterId, WindKind } from "../types.ts";
import { captureCheckBySide, cutFree } from "./boarding.ts";
import {
  apportion, fleetGrapples, fleetMelee, mateCutFree, mateHelm, noLosses, shareDamage, sideBonus, strikeTotals, withLosses,
} from "./fleet.ts";
import type { Shot } from "./fleet.ts";
import { fireGuns, recordFiring, shotPoints } from "./guns.ts";
import type { GunsResult } from "./guns.ts";
import { battleRng, isCrippled, helmScore, resolveHelm, startingRange, windGauge } from "./helm.ts";
import { BATTLE_SIDES, DAMAGE_TRACKS } from "./types.ts";
import type {
  AmbushRange, BattleOutcome, BattleRecord, BattleShip, BattleSide, ContestRecord, DamageTrack, FleetRecord, FleetRoundRecord,
  GrappleRecord, GunsOrder, HelmMove, MeleeRecord, Range, RoundRecord, RoundShipRecord,
} from "./types.ts";

const C = B.combat;
const EPSILON = 1e-9; // a lead of exactly 10 points counts, whatever the floating point sum says

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
      exposed?: number; // a monster rears up: Round shot does this many times the damage to it this round (D102)
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
  round: number; // 1 to B.combat.rounds
  side: BattleSide; // the side of the ship choosing
  range: Range;
  terrain: Terrain;
  wind: WindKind;
  gauge: BattleSide | null;
  ships: Record<BattleSide, BattleShip>;
  last: Record<BattleSide, LastPlay | null>; // null before round 1
  jettisoned: Record<BattleSide, boolean>; // the ship has already thrown its cargo overboard in an earlier round (D66)
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
): RoundShipRecord {
  return {
    ship: ship.shipId,
    rule: choice.rule,
    abilities: choice.abilities.map((a) => ({ ...a })),
    helm,
    guns,
    ...(choice.kind === "fight" && choice.exposed !== undefined && choice.exposed !== 1 ? { exposed: choice.exposed } : {}),
    helmScore: score,
    shot: { track: shot.track, damage: shot.damage, powderUsed: shot.powderUsed },
    scrape,
    jettison: choice.kind === "fight" && choice.jettison === true,
    hullPoints: ship.hullPoints,
    riggingPoints: ship.riggingPoints,
    hands: ship.hands,
    powder: ship.powder,
  };
}

/**
 * After the last round: one side leads by the margin (10 points) in damage share and wins Victory on points,
 * exactly 10 included. Otherwise it is a Draw (8.7).
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

  const gauge = windGauge(ships[flag.hunter]!, ships[flag.target]!, terrain, wind);
  const startRange = startingRange(terrain, input.ambush);
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

  for (let round = 1; round <= C.rounds && outcome === null; round++) {
    const rng = battleRng(seed, flag.hunter, flag.target, round);

    // A ship sees itself and the enemy flagship (7.5).
    const viewFor = (id: ShipId): RoundView => {
      const side = sideOf(id);
      const foe = flag[other(side)];
      return {
        round, side, range, terrain, wind, gauge,
        ships: { [side]: ships[id], [other(side)]: ships[foe] } as Record<BattleSide, BattleShip>,
        last: { [side]: last[id] ?? null, [other(side)]: last[foe] ?? null } as Record<BattleSide, LastPlay | null>,
        jettisoned: { [side]: jettisoned.has(id), [other(side)]: jettisoned.has(foe) } as Record<BattleSide, boolean>,
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
    const orders: Record<ShipId, GunsOrder> = Object.fromEntries(all.map((id) => [id, fights[id]!.guns]));

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
        ships[id]!, fights[id]!.helm, scoresNow[id]!, { move: helm.moves[other(side)], score: helm.scores[other(side)] },
        range, terrain, rng,
      );
      moves[id] = m.move;
      scores[id] = scoresNow[id]!;
      gunsMod[id] = m.gunsMod;
      scrape[id] = m.scrape;
      if (m.contest) contests.push(m.contest);
    }
    if (range === "grappled") {
      const free = cutFree(rng, helm.moves, helm.scores);
      contests.push(...free.contests);
      let freed = free.freed;
      for (const id of all) {
        if (id === flag.hunter || id === flag.target) continue;
        const side = sideOf(id);
        const c = mateCutFree(ships[id]!, moves[id]!, scores[id]!, helm.scores[other(side)], rng);
        if (!c) continue;
        contests.push(c);
        if (c.winner === c.side) freed = true;
      }
      if (freed) after = "close";
    }
    const working: Record<ShipId, BattleShip> = Object.fromEntries(
      all.map((id) => [id, withLosses(ships[id]!, { ...noLosses(), hull: scrape[id]! })]),
    );

    let next = working;
    let grapples: GrappleRecord[] = [];
    let melee: MeleeRecord | null = null;
    const shots: Record<ShipId, Pick<GunsResult, "track" | "damage" | "powderUsed">> = Object.fromEntries(all.map((id) => [id, NO_SHOT]));
    const taken: Record<ShipId, Record<DamageTrack, number>> = Object.fromEntries(all.map((id) => [id, noLosses()]));
    const sideDamage: Record<BattleSide, Record<DamageTrack, number>> = { hunter: noLosses(), target: noLosses() };

    if (!helm.escaped) {
      // A Board order at Close tries to grapple, once the range is known (8.5).
      grapples = fleetGrapples({ range: after, ids, flagships: flag, orders, moves, scores });
      if (grapples.some((g) => g.ok)) after = "grappled";

      // 4. Guns fire at the same time, at the new range (8.5). Every ship fires from the state the round began with.
      // A monster that reared up this round takes more from Round shot (D102); only the enemy flagship is ever the aim.
      const exposure: Record<BattleSide, number> = {
        hunter: fights[flag.hunter]!.exposed ?? 1,
        target: fights[flag.target]!.exposed ?? 1,
      };
      const fired: Record<ShipId, GunsResult> = {};
      for (const id of all) {
        const foe = other(sideOf(id));
        fired[id] = fireGuns(working[id]!, working[flag[foe]!]!, after, orders[id]!, rng, { terrain, helmMod: gunsMod[id]!, exposed: exposure[foe] });
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

      // 5. Boarding melee if Grappled (8.6): side against side.
      if (after === "grappled") {
        const m = fleetMelee(ids, next, orders, terrain, bonus);
        melee = m.record;
        for (const id of all) next[id] = withHands(next[id]!, next[id]!.hands - m.lost[id]!);
        for (const side of BATTLE_SIDES) {
          const credit = sideShare(shipsOf(side, next), "hands", m.record.lost[side]);
          dealt[other(side)] += credit;
          for (const id of ids[other(side)]) dealtBy[id]! += credit * m.credit[id]!;
        }
      }
    }

    const crippled = BATTLE_SIDES.filter((s) => ids[s].some((id) => isCrippled(next[id]!) && !isCrippled(ships[id]!)));
    for (const id of all) if (fights[id]!.jettison) jettisoned.add(id);

    const fleetRound: FleetRoundRecord | null = isFleet
      ? {
          damage: sideDamage, taken,
          crippled: all.filter((id) => isCrippled(next[id]!) && !isCrippled(ships[id]!)),
          struck: [],
        }
      : null;
    rounds.push({
      round, rangeBefore: range, rangeAfter: after, escaped: helm.escaped, row: helm.row,
      contests, grapples, melee, crippled, struck: [],
      ships: all.map((id) => shipRecord(next[id]!, fights[id]!, moves[id]!, orders[id]!, scores[id]!, shots[id]!, scrape[id]!)),
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
    if (outcome === null && helm.escaped) outcome = { kind: "escaped", winner: null, loser: null, round };

    ships = next;
    range = after;
    last = Object.fromEntries(all.map((id) => [id, { helm: moves[id]!, guns: orders[id]! }]));
  }

  // After the last round: Victory on points or a Draw (8.7).
  if (outcome === null) outcome = pointsOutcome(dealt, rounds.length);

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
