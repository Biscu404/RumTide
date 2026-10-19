// Counting and confidence for the combat simulator (P3.1). Plain numbers and plain objects, so a tally can cross
// from a worker thread to the main one as it is.

import type { Verdict } from "./arena.ts";

/** How a set of battles ended from one side's point of view. */
export interface Tally {
  n: number;
  win: number;
  loss: number;
  draw: number;
  escape: number;
}

export const emptyTally = (): Tally => ({ n: 0, win: 0, loss: 0, draw: 0, escape: 0 });

export function addVerdict(t: Tally, v: Verdict): void {
  t.n++;
  t[v]++;
}

export function mergeTally(into: Tally, from: Tally): Tally {
  into.n += from.n;
  into.win += from.win;
  into.loss += from.loss;
  into.draw += from.draw;
  into.escape += from.escape;
  return into;
}

/** The same tally seen from the other side: wins and losses swap. */
export const flipTally = (t: Tally): Tally => ({ n: t.n, win: t.loss, loss: t.win, draw: t.draw, escape: t.escape });

/** Share of all battles, 0 to 1. Zero battles give 0. */
export const share = (count: number, n: number): number => (n > 0 ? count / n : 0);

export const winShare = (t: Tally): number => share(t.win, t.n);

/** Of the battles that someone won, the share this side won: draws and escapes are left out. 0.5 when nobody won any. */
export const decidedShare = (t: Tally): number => (t.win + t.loss > 0 ? t.win / (t.win + t.loss) : 0.5);

/** The 95% Wilson interval for a share of n battles. */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** "62%" or "62.4%". */
export const pct = (x: number, digits = 0): string => `${(x * 100).toFixed(digits)}%`;

/** "62% (59 to 65)" for a count out of n. */
export function pctWithRange(count: number, n: number, digits = 0): string {
  const [lo, hi] = wilson(count, n);
  return `${pct(share(count, n), digits)} (${pct(lo, digits).replace("%", "")} to ${pct(hi, digits)})`;
}

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Standard error of the mean of the paired differences between series a and series b. */
export function pairedError(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return Infinity;
  const diffs = Array.from({ length: n }, (_, i) => a[i]! - b[i]!);
  const m = mean(diffs);
  const variance = diffs.reduce((s, d) => s + (d - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance / n);
}
