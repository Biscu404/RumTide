// The table in section 7.3 of docs/GAME_DESIGN.md, and a check of simulated rows against it.
// If this check fails after a change to balance.ts or the combat code, the change was not neutral:
// re-tune it, or update the doc and docs/DECISIONS.md on purpose.

import { simulateRatio, type RatioRow } from "./combat.ts";

export const BATTLES_PER_ROW = 6000;
export const SEED = 73;

/** Stronger ship's win rate and the share of decisive results, from the doc (decisive is "about"). */
export const SECTION_7_3 = [
  { ratio: 1,    strongerWins: 0.40, decisive: 0.30 },   // "40% each, 20% draws"
  { ratio: 1.25, strongerWins: 0.64, decisive: 0.30 },
  { ratio: 1.5,  strongerWins: 0.79, decisive: 0.40 },
  { ratio: 2,    strongerWins: 0.92, decisive: 0.60 },
] as const;

/** Percentage points of slack. 6,000 battles give about 0.6 points of noise, the doc rounds. */
export const TOLERANCE = 0.03;

export function runSection73(): RatioRow[] {
  return SECTION_7_3.map((row) => simulateRatio(row.ratio, BATTLES_PER_ROW, SEED));
}

/** Empty when every row is within tolerance. */
export function section73Problems(rows: readonly RatioRow[]): string[] {
  const problems: string[] = [];
  SECTION_7_3.forEach((want, i) => {
    const got = rows[i]!;
    if (Math.abs(got.strongerWins - want.strongerWins) > TOLERANCE) {
      problems.push(`ratio ${want.ratio}: stronger ship wins ${pct(got.strongerWins)}, doc says ${pct(want.strongerWins)}`);
    }
    if (Math.abs(got.decisive - want.decisive) > TOLERANCE) {
      problems.push(`ratio ${want.ratio}: ${pct(got.decisive)} decisive, doc says about ${pct(want.decisive)}`);
    }
  });
  const equal = rows[0]!;
  if (Math.abs(equal.draws - 0.20) > TOLERANCE) problems.push(`ratio 1: ${pct(equal.draws)} draws, doc says 20%`);
  return problems;
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
