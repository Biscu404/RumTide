// Boarding (GAMEPLAY 8.6): grappling, boarding strength, the melee, Capture, Cut Free, Repel.
// Pure: no network, no clock, no Math.random. The one roll, Cut Free, comes from a labelled child of the round's stream.
//
// runBattle (battle.ts) calls these in the order of 8.3: Cut Free belongs to the Helm step, a Board order is tried
// once the range is known, and the melee runs after the guns of a Grappled round.

import { B } from "../balance.ts";
import type { Rng } from "../rng.ts";
import type { Terrain } from "../types.ts";
import { contestRecord } from "./helm.ts";
import { BATTLE_SIDES } from "./types.ts";
import type { BattleShip, BattleSide, ContestRecord, GrappleRecord, GunsOrder, HelmMove, MeleeRecord, Range } from "./types.ts";

const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

// ---------- Boarding strength and the melee ----------

/**
 * Boarding strength = Hands x (1 + Bosun, trait and Background bonuses), x 1.3 for a ship that plays Repel (8.6).
 * Kelp adds 15% to every ship (2.2). A ship with no Hands has none.
 */
export function boardingStrength(ship: BattleShip, order: GunsOrder, terrain: Terrain): number {
  let strength = ship.hands * (NEUTRAL + ship.boardingBonus);
  if (order === "repel") strength *= C.boarding.repel;
  if (terrain === "kelp") strength *= C.kelpBoarding;
  return strength;
}

/** One Grappled round, both sides at once: each removes Hands equal to 20% of its own boarding strength from the other (8.6). */
export function meleeRound(
  ships: Record<BattleSide, BattleShip>,
  orders: Record<BattleSide, GunsOrder>,
  terrain: Terrain,
): MeleeRecord {
  const strength = {
    hunter: boardingStrength(ships.hunter, orders.hunter, terrain),
    target: boardingStrength(ships.target, orders.target, terrain),
  };
  const lost = { hunter: 0, target: 0 };
  const hands = { hunter: ships.hunter.hands, target: ships.target.hands };
  for (const side of BATTLE_SIDES) {
    // `side` loses what the other ship's strength removes, never more than it has.
    lost[side] = Math.min(ships[side].hands, Math.round(C.boarding.killShare * strength[other(side)]));
    hands[side] = ships[side].hands - lost[side];
  }
  return { strength, lost, hands };
}

// ---------- Capture ----------

/** Hands fell below 40% of the other side's, or below 20% of the side's own max: the side surrenders (8.6). */
export const lacksHands = (maxHands: number, hands: number, enemyHands: number): boolean =>
  hands < C.boarding.captureRatio * enemyHands || hands < C.boarding.captureOwnShare * maxHands;

/** The same test for one ship (8.6). */
export const surrenders = (ship: BattleShip, hands: number, enemyHands: number): boolean => lacksHands(ship.maxHands, hands, enemyHands);

export interface CaptureResult {
  loser: BattleSide | null; // the side that surrenders
  draw: boolean; // both fell below the line with the same number of Hands left
}

/**
 * Who surrenders after a melee. If both fall below the line the side with fewer Hands is captured,
 * and equal Hands is a draw (D55). `hands` are the Hands left after the melee.
 */
export function captureCheck(ships: Record<BattleSide, BattleShip>, hands: Record<BattleSide, number>): CaptureResult {
  return captureCheckBySide({ hunter: ships.hunter.maxHands, target: ships.target.maxHands }, hands);
}

/** captureCheck for whole sides: a fleet is captured when its crews together fall below the line (P2.5). */
export function captureCheckBySide(maxHands: Record<BattleSide, number>, hands: Record<BattleSide, number>): CaptureResult {
  const out = {
    hunter: lacksHands(maxHands.hunter, hands.hunter, hands.target),
    target: lacksHands(maxHands.target, hands.target, hands.hunter),
  };
  if (out.hunter && out.target) {
    if (hands.hunter === hands.target) return { loser: null, draw: true };
    return { loser: hands.hunter < hands.target ? "hunter" : "target", draw: false };
  }
  if (out.hunter) return { loser: "hunter", draw: false };
  if (out.target) return { loser: "target", draw: false };
  return { loser: null, draw: false };
}

// ---------- Grappling ----------

/**
 * Board orders played at Close (8.5): "Succeeds if your Helm score is at least theirs, or if they also Board or Hold".
 * Hold is the other ship's Helm move, Board its Guns order. Only a ship that plays Board tries, and only at Close.
 * Returns one record per ship that tried, hunter first.
 */
export function grappleAttempts(
  range: Range,
  orders: Record<BattleSide, GunsOrder>,
  moves: Record<BattleSide, HelmMove>,
  scores: Record<BattleSide, number>,
): GrappleRecord[] {
  if (range !== "close") return [];
  const attempts: GrappleRecord[] = [];
  for (const side of BATTLE_SIDES) {
    if (orders[side] !== "board") continue;
    const them = other(side);
    const why = grappleReason(scores[side], scores[them], orders[them], moves[them]);
    attempts.push({ side, ok: why !== "failed", why });
  }
  return attempts;
}

/** Why a Board order at Close succeeds, or "failed": a Helm score at least theirs, or they also Board, or they Hold (8.5). */
export function grappleReason(mine: number, theirs: number, theirOrder: GunsOrder, theirMove: HelmMove): GrappleRecord["why"] {
  return mine >= theirs ? "helm" : theirOrder === "board" ? "theyBoard" : theirMove === "hold" ? "theyHold" : "failed";
}

// ---------- Cut Free ----------

export interface CutFreeResult {
  freed: boolean; // some ship won its contest, so the range returns to Close
  contests: ContestRecord[]; // one per ship that played Open Range, hunter first
}

/**
 * A Grappled ship can play Open Range; if it wins a Helm contest, range returns to Close (8.6).
 * `moves` are the moves as played, after the Crippled rule, so a Crippled ship cannot try. Each ship that tries
 * rolls its own contest against the other, from the child stream "helm/cutFree/<side>". If both try, either win frees them.
 */
export function cutFree(
  rng: Rng,
  moves: Record<BattleSide, HelmMove>,
  scores: Record<BattleSide, number>,
): CutFreeResult {
  const contests: ContestRecord[] = [];
  for (const side of BATTLE_SIDES) {
    if (moves[side] !== "openRange") continue;
    contests.push(contestRecord(rng.stream("helm", "cutFree", side), "cutFree", side, scores));
  }
  return { freed: contests.some((c) => c.winner === c.side), contests };
}
