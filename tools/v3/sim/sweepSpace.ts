// The space the Old Shellback sweep searches (P3.2b), and how a combination is scored. Pure: plain numbers in, plain numbers out,
// with every draw from the seeded Rng, so a sweep can be run again and gives the same combinations.
//
// Every number of B.shellback is a cliff for check 5 on its own, so the sweep moves several at once. A combination is a Patch
// (patch.ts) that names every number of the grid, so two combinations compare key by key.

import { B, Rng } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Patch } from "./patch.ts";

/** The values from `from` to `to` in steps of `step`, rounded so 0.1 + 0.2 style noise never makes two keys of one value. */
export function steps(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) out.push(Math.round((from + i * step) * 1000) / 1000);
  return out;
}

/** The numbers the sweep may move and the values each may take. His Sails, his decay and his rear up rounds stay as they are. */
export const GRID: Readonly<Record<string, readonly number[]>> = {
  "shellback.hull": steps(240, 600, 30),
  "shellback.clawHands": steps(40, 90, 2),
  "shellback.cannons": steps(16, 44, 2),
  "shellback.helm": steps(6, 20, 2),
  "shellback.armour": steps(0.5, 1, 0.05),
  "shellback.mortarFactor": steps(1.5, 6, 0.5),
  "shellback.retreatHull": steps(0.2, 0.7, 0.05),
  "shellback.retreatClaws": steps(0.1, 0.5, 0.025),
};

export const GRID_KEYS: readonly string[] = Object.keys(GRID).sort();

/** The number balance.ts has at a dotted path. */
export function balanceAt(path: string): number {
  let at: unknown = B;
  for (const key of path.split(".")) at = (at as Record<string, unknown>)[key];
  if (typeof at !== "number") throw new Error(`There is no number at B.${path}.`);
  return at;
}

/** The combination balance.ts holds now. */
export const baseline = (): Patch => Object.fromEntries(GRID_KEYS.map((k) => [k, balanceAt(k)]));

/** Fills a partial patch up with the numbers of balance.ts, so it names every number of the grid. */
export const complete = (partial: Patch): Patch => ({ ...baseline(), ...partial });

/** One key for a combination, whatever order its numbers were written in. */
export const keyOf = (patch: Patch): string => Object.keys(patch).sort().map((k) => `${k}=${patch[k]}`).join(",");

/** Only the numbers that differ from balance.ts, for a report and for `--set`. */
export const changesOf = (patch: Patch): Patch => Object.fromEntries(Object.entries(patch).filter(([k, v]) => balanceAt(k) !== v));

/**
 * A random combination. Each number stays where balance.ts has it with a chance of `stay`, and is otherwise any value of its grid,
 * so the sample holds combinations near the game as it is as well as far ones.
 */
export function randomCombination(rng: Rng, stay = 0.4): Patch {
  const out: Patch = {};
  for (const key of GRID_KEYS) {
    const values = GRID[key]!;
    out[key] = rng.next() < stay ? balanceAt(key) : values[Math.min(values.length - 1, Math.floor(rng.next() * values.length))]!;
  }
  return out;
}

/** Every combination one grid step away in one number. A number that is off its grid steps to the grid values either side of it. */
export function neighbours(patch: Patch): Patch[] {
  const out: Patch[] = [];
  for (const key of GRID_KEYS) {
    const values = GRID[key]!;
    const now = patch[key]!;
    const below = values.filter((v) => v < now).pop();
    const above = values.find((v) => v > now);
    for (const v of [below, above]) if (v !== undefined) out.push({ ...patch, [key]: v });
  }
  return out;
}

// The sweep aims inside the band of check 5 (35% to 80%), because it scores a fixed library of doctrines on a few hundred fights
// and the real search finds a doctrine at least as good: the top of the aim is well under 80% and the bottom a little over 35%.
export const AIM_LOW = 0.42;
export const AIM_HIGH = 0.72;
const AIM_MIDDLE = (AIM_LOW + AIM_HIGH) / 2;

export interface Score {
  /** How far the styles are outside the aim, summed. 0 when every style is inside it. */
  loss: number;
  /** How far the styles are from the middle of the aim, summed: breaks ties between combinations with the same loss. */
  spread: number;
}

export function scoreOf(rates: readonly number[]): Score {
  let loss = 0;
  let spread = 0;
  for (const r of rates) {
    loss += Math.max(0, AIM_LOW - r, r - AIM_HIGH);
    spread += Math.abs(r - AIM_MIDDLE);
  }
  return { loss, spread };
}

/** One number to sort by: the loss, then the spread. */
export const rank = (s: Score): number => s.loss + 0.02 * s.spread;
