// Section 7.3: "6,000 simulated battles per row with random plans", run on the real engine.
// Both ships are sloops scaled by the power ratio (every stat and the hull), each plan is three
// maneuvers picked at random.

import { B, powerRating } from "@engine/balance.ts";
import { resolveBattle, type Combatant } from "@engine/combat.ts";
import { createRng, type Rng } from "@engine/rng.ts";
import type { Maneuver } from "@engine/types.ts";

const MANEUVERS: readonly Maneuver[] = ["broadside", "outmaneuver", "board"];

/** A sloop whose stats and hull are `scale` times a fresh sloop's. */
export function scaledShip(id: string, scale: number, plan: readonly Maneuver[], over: Partial<Combatant> = {}): Combatant {
  const stat = B.baseStat * scale, hull = B.baseHull * scale;
  return {
    id, kind: "player", cannons: stat, sails: stat, crew: stat, hullPoints: hull, maxHull: hull,
    pr: powerRating({ hull, cannons: stat, sails: stat, crew: stat }), plan, ...over,
  };
}

export const randomPlan = (rng: Rng): Maneuver[] =>
  Array.from({ length: B.combat.rounds }, () => rng.pick(MANEUVERS));

export interface RatioRow {
  ratio: number;
  battles: number;
  /** Shares of all battles, 0 to 1. For ratio 1 the "stronger" ship is simply the first one. */
  strongerWins: number;
  weakerWins: number;
  draws: number;
  decisive: number;
}

export function simulateRatio(ratio: number, battles: number, seed: number): RatioRow {
  const rng = createRng(seed);
  let strongerWins = 0, weakerWins = 0, draws = 0, decisive = 0;
  for (let i = 0; i < battles; i++) {
    const strong = scaledShip("strong", ratio, randomPlan(rng));
    const weak = scaledShip("weak", 1, randomPlan(rng));
    const result = resolveBattle([[strong], [weak]], rng);
    if (result.winner === 0) strongerWins++;
    else if (result.winner === 1) weakerWins++;
    else draws++;
    if (result.outcome === "decisive") decisive++;
  }
  return {
    ratio, battles,
    strongerWins: strongerWins / battles, weakerWins: weakerWins / battles,
    draws: draws / battles, decisive: decisive / battles,
  };
}

/** Section 9 rule 4: how often do `gang` equal ships beat one? */
export function simulateGang(gang: number, battles: number, seed: number): number {
  const rng = createRng(seed);
  let wins = 0;
  for (let i = 0; i < battles; i++) {
    const ganging = Array.from({ length: gang }, (_, k) => scaledShip(`g${k}`, 1, randomPlan(rng)));
    const result = resolveBattle([ganging, [scaledShip("solo", 1, randomPlan(rng))]], rng);
    if (result.winner === 0) wins++;
  }
  return wins / battles;
}
