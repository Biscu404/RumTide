// runBattle (GAMEPLAY 8.3): one battle of up to five rounds between two ships.
// Pure: no network, no clock, no Math.random, and it never changes the ships it is given. Every roll comes from a
// labelled child of the round's stream rngFor(tideSeed, "battle", hunterId, targetId, round), so the same input
// always gives the same BattleRecord.
//
// What each ship does in a round is a Chooser: a function from what the ship can see to a Helm move and a Guns
// order (or Surrender). Doctrine evaluation (P2.3) builds the real Choosers; the tests here use scripted ones.
// One ship a side for now; fleets (P2.5) widen the sides.

import { B } from "../balance.ts";
import type { Terrain, WaterId, WindKind } from "../types.ts";
import { captureCheck, cutFree, grappleAttempts, meleeRound } from "./boarding.ts";
import { applyDamage, fireGuns, recordFiring } from "./guns.ts";
import type { GunsResult } from "./guns.ts";
import { battleRng, isCrippled, helmScore, resolveHelm, startingRange, windGauge } from "./helm.ts";
import { BATTLE_SIDES } from "./types.ts";
import type {
  AmbushRange, BattleOutcome, BattleRecord, BattleShip, BattleSide, ContestRecord, DamageTrack, GrappleRecord, GunsOrder,
  HelmMove, MeleeRecord, Range, RoundRecord, RoundShipRecord,
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
      jettison?: boolean; // also throw the cargo overboard; the Helm move and Guns order are whatever the doctrine gave (D48)
    }
  | { kind: "surrender"; rule: number; abilities: AbilityFire[] };

/** What the ship played last round, after the Crippled rule. */
export interface LastPlay {
  helm: HelmMove;
  guns: GunsOrder;
}

/** What a ship can see when it chooses: the state as the round begins. Choosers must not change it. */
export interface RoundView {
  round: number; // 1 to B.combat.rounds
  side: BattleSide; // the ship choosing
  range: Range;
  terrain: Terrain;
  wind: WindKind;
  gauge: BattleSide | null;
  ships: Record<BattleSide, BattleShip>;
  last: Record<BattleSide, LastPlay | null>; // null before round 1
}

export type Chooser = (view: RoundView) => RoundChoice;

// ---------- Input ----------

export interface BattleInput {
  tide: number;
  seed: number; // the Tide seed
  at: WaterId;
  terrain: Terrain;
  wind: WindKind;
  hunter: BattleShip;
  target: BattleShip;
  doctrines: Record<BattleSide, string>; // the names, for the record
  choosers: Record<BattleSide, Chooser>;
  ambush?: AmbushRange; // the range a Lurker who springs an ambush chose (8.1)
}

// ---------- Damage share (8.7 Victory on points) ----------

const trackMax = (ship: BattleShip, track: DamageTrack): number =>
  track === "hull" ? ship.maxHullPoints : track === "rigging" ? ship.maxRiggingPoints : ship.maxHands;

/** Hull, Rigging and Hands count alike, so a ship with no Rigging has two tracks (D56). */
const trackCount = (ship: BattleShip): number => (ship.maxRiggingPoints > 0 ? 3 : 2);

/**
 * How much of a ship's whole health `points` of damage on one track is, as a fraction between 0 and 1:
 * the share of that track's max, averaged over the ship's tracks. Victory on points compares these (D56).
 */
export function damageShare(victim: BattleShip, track: DamageTrack, points: number): number {
  const max = trackMax(victim, track);
  return max > 0 ? points / max / trackCount(victim) : 0;
}

// ---------- Helpers ----------

const copyShip = (ship: BattleShip, side: BattleSide): BattleShip => ({ ...ship, side, abilities: [...ship.abilities], guns: { ...ship.guns } });

const withHull = (ship: BattleShip, loss: number): BattleShip => ({
  ...ship,
  abilities: [...ship.abilities],
  guns: { ...ship.guns },
  hullPoints: Math.max(0, ship.hullPoints - loss),
});

const withHands = (ship: BattleShip, hands: number): BattleShip => ({ ...ship, abilities: [...ship.abilities], guns: { ...ship.guns }, hands });

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
  // Both ships went down in the same round: whoever dealt more damage in the battle wins (D54).
  if (dealt.hunter === dealt.target) return { kind: "draw", winner: null, loser: null, round };
  const winner: BattleSide = dealt.hunter > dealt.target ? "hunter" : "target";
  return { kind: "sunk", winner, loser: other(winner), round };
};

// ---------- The battle ----------

/** Runs a battle to its end: up to B.combat.rounds rounds, then Victory on points or a Draw. */
export function runBattle(input: BattleInput): BattleRecord {
  const { tide, seed, at, terrain, wind } = input;
  let ships: Record<BattleSide, BattleShip> = { hunter: copyShip(input.hunter, "hunter"), target: copyShip(input.target, "target") };
  const gauge = windGauge(ships.hunter, ships.target, terrain, wind);
  const startRange = startingRange(terrain, input.ambush);
  const initial = [copyShip(ships.hunter, "hunter"), copyShip(ships.target, "target")];

  let range: Range = startRange;
  let last: Record<BattleSide, LastPlay | null> = { hunter: null, target: null };
  const dealt: Record<BattleSide, number> = { hunter: 0, target: 0 };
  const jettisoned = new Set<BattleSide>();
  const rounds: RoundRecord[] = [];
  let outcome: BattleOutcome | null = null;

  for (let round = 1; round <= C.rounds && outcome === null; round++) {
    const rng = battleRng(seed, ships.hunter.shipId, ships.target.shipId, round);
    const view = (side: BattleSide): RoundView => ({ round, side, range, terrain, wind, gauge, ships, last });
    const choices: Record<BattleSide, RoundChoice> = {
      hunter: input.choosers.hunter(view("hunter")),
      target: input.choosers.target(view("target")),
    };
    const scoresNow = {
      hunter: helmScore(ships.hunter, ships.target, terrain, gauge === "hunter"),
      target: helmScore(ships.target, ships.hunter, terrain, gauge === "target"),
    };

    // Surrender comes first: the colours come down and nothing else happens this round (D53).
    const struck = BATTLE_SIDES.filter((s) => choices[s].kind === "surrender");
    if (struck.length > 0) {
      rounds.push({
        round, rangeBefore: range, rangeAfter: range, escaped: false, row: range === "grappled" ? "grappled" : "holdHold",
        contests: [], grapples: [], melee: null, crippled: [], struck,
        ships: BATTLE_SIDES.map((s) => shipRecord(ships[s], choices[s], "hold", "holdFire", scoresNow[s], NO_SHOT, 0)),
      });
      outcome = struck.length === 2
        ? { kind: "draw", winner: null, loser: null, round }
        : { kind: "struckColours", winner: other(struck[0]!), loser: struck[0]!, round };
      break;
    }

    const fights = choices as Record<BattleSide, Extract<RoundChoice, { kind: "fight" }>>;
    const orders: Record<BattleSide, GunsOrder> = { hunter: fights.hunter.guns, target: fights.target.guns };

    // 3. Helm resolves: range changes, rakes and flank shots, terrain overrides (8.4).
    const helm = resolveHelm(
      { range, terrain, hunter: ships.hunter, target: ships.target, moves: { hunter: fights.hunter.helm, target: fights.target.helm }, gauge },
      rng,
    );
    const contests: ContestRecord[] = [...helm.contests];
    let after: Range = helm.range;
    if (range === "grappled") {
      const free = cutFree(rng, helm.moves, helm.scores);
      contests.push(...free.contests);
      if (free.freed) after = "close";
    }
    const working: Record<BattleSide, BattleShip> = {
      hunter: withHull(ships.hunter, helm.scrape.hunter),
      target: withHull(ships.target, helm.scrape.target),
    };

    let next = working;
    let grapples: GrappleRecord[] = [];
    let melee: MeleeRecord | null = null;
    const shots: Record<BattleSide, Pick<GunsResult, "track" | "damage" | "powderUsed">> = { hunter: NO_SHOT, target: NO_SHOT };

    if (!helm.escaped) {
      // A Board order at Close tries to grapple, once the range is known (8.5).
      grapples = grappleAttempts(after, orders, helm.moves, helm.scores);
      if (grapples.some((g) => g.ok)) after = "grappled";

      // 4. Guns fire at the same time, at the new range (8.5). Both fire from the state the round began with.
      const fired = {
        hunter: fireGuns(working.hunter, working.target, after, orders.hunter, rng, { terrain, helmMod: helm.gunsMod.hunter }),
        target: fireGuns(working.target, working.hunter, after, orders.target, rng, { terrain, helmMod: helm.gunsMod.target }),
      };
      next = {
        hunter: recordFiring(applyDamage(working.hunter, fired.target), orders.hunter, fired.hunter),
        target: recordFiring(applyDamage(working.target, fired.hunter), orders.target, fired.target),
      };
      for (const side of BATTLE_SIDES) {
        shots[side] = fired[side];
        if (fired[side].track) dealt[side] += damageShare(working[other(side)], fired[side].track, fired[side].damage);
      }

      // 5. Boarding melee if Grappled (8.6).
      if (after === "grappled") {
        melee = meleeRound(next, orders, terrain);
        for (const side of BATTLE_SIDES) {
          next[side] = withHands(next[side], melee.hands[side]);
          dealt[other(side)] += damageShare(next[side], "hands", melee.lost[side]);
        }
      }
    }

    const crippled = BATTLE_SIDES.filter((s) => isCrippled(next[s]) && !isCrippled(ships[s]));
    for (const side of BATTLE_SIDES) if (fights[side].jettison) jettisoned.add(side);

    rounds.push({
      round, rangeBefore: range, rangeAfter: after, escaped: helm.escaped, row: helm.row,
      contests, grapples, melee, crippled, struck: [],
      ships: BATTLE_SIDES.map((s) => shipRecord(next[s], fights[s], helm.moves[s], orders[s], helm.scores[s], shots[s], helm.scrape[s])),
    });

    // 6. End checks: Sunk, Captured, Escaped (8.7). Struck Colours was settled at the top of the round.
    const sunk = BATTLE_SIDES.filter((s) => next[s].hullPoints <= 0);
    if (sunk.length > 0) {
      outcome = sinkOutcome(sunk, dealt, round);
    } else if (melee) {
      const capture = captureCheck(next, melee.hands);
      if (capture.draw) outcome = { kind: "draw", winner: null, loser: null, round };
      else if (capture.loser) outcome = { kind: "captured", winner: other(capture.loser), loser: capture.loser, round };
    }
    if (outcome === null && helm.escaped) outcome = { kind: "escaped", winner: null, loser: null, round };

    ships = next;
    range = after;
    last = {
      hunter: { helm: helm.moves.hunter, guns: orders.hunter },
      target: { helm: helm.moves.target, guns: orders.target },
    };
  }

  // After the last round: Victory on points or a Draw (8.7).
  if (outcome === null) outcome = pointsOutcome(dealt, rounds.length);

  return {
    tide, seed, at, terrain, wind,
    hunter: ships.hunter.shipId,
    target: ships.target.shipId,
    doctrines: { ...input.doctrines },
    startRange, gauge,
    ships: initial,
    rounds,
    outcome,
    final: [copyShip(ships.hunter, "hunter"), copyShip(ships.target, "target")],
    dealt,
    jettisoned: BATTLE_SIDES.filter((s) => jettisoned.has(s)),
  };
}
