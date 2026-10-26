// Boarding (GAMEPLAY 8.6): grappling, boarding strength, Capture, Cut Free.
// Pure: no network, no clock, no Math.random. The rolls, Cut Free and the grapnels, come from labelled children of the round's
// stream. The deck fight itself, the Deck orders and the melee, is deck.ts and fleet.ts.
//
// runBattle (battle.ts) calls these in the order of 8.3: Cut Free belongs to the Helm step, a Board order is tried
// once the range is known, and the melee runs after the guns of a Grappled round.

import { B } from "../balance.ts";
import type { Rng } from "../rng.ts";
import { drillFactor } from "../ship.ts";
import type { Terrain } from "../types.ts";
import { contestRecord } from "./helm.ts";
import { fightersFactor, grapnelBonus, tinderboxFactor } from "./styles.ts";
import { BATTLE_SIDES } from "./types.ts";
import type { BattleShip, BattleSide, ContestRecord, GrappleRecord, GunsOrder, HelmMove, Range } from "./types.ts";

const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

// ---------- Boarding strength ----------

export interface StrengthOptions {
  /** First over the rail: this crew is the boarder's, in the round it grapples. Its strength counts `edge.firstOverTheRail` times. */
  firstOver?: boolean;
  /** The ships of the other side, for Tinderbox: a crew fighting a Firebrand on deck fights at less than its strength. */
  foes?: readonly Pick<BattleShip, "style">[];
  /** How much of its Drill bonus the crew brings this round (deck.ts drillLuck). 1 when the draw is not asked for. */
  drillLuck?: number;
}

/**
 * Boarding strength = Hands x (1 + Bosun, trait and Background bonuses) x Drill x Kelp x First over the rail (8.6, boarding
 * spec section 2). Kelp adds 15% to every ship (2.2). A Boarder's Fighters add 20% and Tinderbox takes 20% off a crew
 * fighting a Firebrand. A ship with no Hands has none. The Deck order is not part of the strength: it is the hit, pairing
 * and guard of the deck fight (deck.ts).
 */
export function boardingStrength(ship: BattleShip, terrain: Terrain, opts: StrengthOptions = {}): number {
  let strength = ship.hands * (NEUTRAL + ship.boardingBonus) * drillFactor(ship.drill ?? 0, opts.drillLuck ?? NEUTRAL);
  if (terrain === "kelp") strength *= C.kelpBoarding;
  if (opts.firstOver) strength *= C.edge.firstOverTheRail;
  return strength * fightersFactor(ship) * tinderboxFactor(opts.foes ?? []);
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
 *
 * Lashed fast: the Helm score of a side marked in `lashed` counts `edge.lashedFast` times in the contest of the ship that tries to
 * get away from it, because it made the grapple or has Grapnels (boarding spec sections 3 and 4). The record shows the scores
 * as the contest used them.
 */
export function cutFree(
  rng: Rng,
  moves: Record<BattleSide, HelmMove>,
  scores: Record<BattleSide, number>,
  lashed: Record<BattleSide, boolean> = { hunter: false, target: false },
): CutFreeResult {
  const contests: ContestRecord[] = [];
  for (const side of BATTLE_SIDES) {
    if (moves[side] !== "openRange") continue;
    contests.push(contestRecord(rng.stream("helm", "cutFree", side), "cutFree", side, lashedScores(scores, side, lashed)));
  }
  return { freed: contests.some((c) => c.winner === c.side), contests };
}

/** The scores a ship that tries to cut free faces: the other ship's counts `lashedFast` times when it is lashed fast to it. */
export function lashedScores(scores: Record<BattleSide, number>, side: BattleSide, lashed: Record<BattleSide, boolean>): Record<BattleSide, number> {
  const foe = other(side);
  return lashed[foe] ? ({ ...scores, [foe]: scores[foe] * C.edge.lashedFast } as Record<BattleSide, number>) : scores;
}

// ---------- Grapnels ----------

/**
 * A Board that failed on Helm score gets a Helm contest instead (Grapnels, Drill 10, or a Boarder's grapnel lines). The ship's
 * score counts `grapnelBonus` times for a Boarder, once for any other ship. The roll comes from the child stream "grapnel/<id>".
 */
export function grapnelContest(
  rng: Rng, ship: Pick<BattleShip, "shipId" | "style">, side: BattleSide, mine: number, theirs: number,
): ContestRecord {
  const scores = { [side]: mine * grapnelBonus(ship), [other(side)]: theirs } as Record<BattleSide, number>;
  return contestRecord(rng.stream("grapnel", ship.shipId), "grapnel", side, scores);
}
