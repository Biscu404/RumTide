// Check 4 of GAMEPLAY 8.9 (P3.1): a ship with twice the Power Rating wins about 85 to 90% of the time.
//
// This is the table of GAME_DESIGN 7.3 rebuilt for v0.3: "battles with random plans". Both captains play a random plan
// (plans.ts), nobody reads anybody, and the only difference is the ships. The weaker ship is a fresh sloop (Power Rating
// 10). The stronger is the balanced sloop whose Power Rating is closest to the ratio, in every scene and in both seats.
// "Wins" is a share of the battles that were fought, as in 7.3 where nobody could run: a battle that ends Escaped is left
// out, because a random plan flees by chance and about two in three of them do. A draw is fought and is not a win. At a
// ratio of 2 the check passes when the stronger ship's share is from 83% to 92%, and the shares must rise with the ratio.

import { SCENES, ratingOf, sloopForRatio } from "./arena.ts";
import type { Fighter, ShipSpec } from "./arena.ts";
import { chunked } from "./chunks.ts";
import type { Effort } from "./effort.ts";
import type { DuelsJob } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { emptyTally, flipTally, mergeTally, share } from "./stats.ts";
import type { Tally } from "./stats.ts";

export const POWER_RATIOS = [1, 1.25, 1.5, 2] as const;
export const POWER_LOW = 0.83; // "about 85 to 90%", two points either side
export const POWER_HIGH = 0.92;
export const POWER_CHECKED_RATIO = 2;

const FRESH_RATING = 10;

export interface PowerRow {
  ratio: number; // asked for
  actual: number; // the Power Rating of the stronger build over a fresh sloop's
  spec: ShipSpec;
  /** From the stronger ship's point of view. */
  tally: Tally;
  kinds: Record<string, number>;
  fought: number; // battles that did not end Escaped
  escaped: number; // share of all battles that ended Escaped
  /** Shares of the fought battles. */
  strongerWins: number;
  weakerWins: number;
  draws: number;
}

export interface PowerData {
  rows: PowerRow[];
}

export async function runPower(pool: Pool, effort: Effort): Promise<PowerData> {
  const jobs: DuelsJob[] = [];
  const meta: { row: number; strongIsHunter: boolean }[] = [];
  const specs = POWER_RATIOS.map((r) => (r === 1 ? ({} as ShipSpec) : sloopForRatio(r)));
  POWER_RATIOS.forEach((ratio, row) => {
    for (const scene of SCENES) for (const strongIsHunter of [true, false]) {
      const strong: Fighter = { name: "strong", ship: specs[row]! };
      const weak: Fighter = { name: "weak" };
      for (const part of chunked(effort.powerPerCell, 250)) {
        jobs.push({
          a: strongIsHunter ? strong : weak, b: strongIsHunter ? weak : strong, scene: scene.name,
          label: `power/${ratio}/${scene.name}/${strongIsHunter ? "h" : "t"}`, from: part.from, count: part.count,
        });
        meta.push({ row, strongIsHunter });
      }
    }
  });
  const results = await pool.run("duels", jobs);
  const rows: PowerRow[] = POWER_RATIOS.map((ratio, i) => ({
    ratio, actual: ratingOf(specs[i]!) / FRESH_RATING, spec: specs[i]!, tally: emptyTally(), kinds: {},
    fought: 0, escaped: 0, strongerWins: 0, weakerWins: 0, draws: 0,
  }));
  results.forEach((r, i) => {
    const m = meta[i]!;
    const row = rows[m.row]!;
    mergeTally(row.tally, m.strongIsHunter ? r.tally : flipTally(r.tally));
    for (const [k, v] of Object.entries(r.kinds)) row.kinds[k] = (row.kinds[k] ?? 0) + v;
  });
  for (const row of rows) {
    row.fought = row.tally.n - row.tally.escape;
    row.escaped = share(row.tally.escape, row.tally.n);
    row.strongerWins = share(row.tally.win, row.fought);
    row.weakerWins = share(row.tally.loss, row.fought);
    row.draws = share(row.tally.draw, row.fought);
  }
  return { rows };
}

export interface PowerVerdict {
  pass: boolean;
  checked: PowerRow;
  rising: boolean;
  rows: PowerRow[];
}

export function judgePower(data: PowerData): PowerVerdict {
  const checked = data.rows.find((r) => r.ratio === POWER_CHECKED_RATIO)!;
  const rising = data.rows.every((r, i) => i === 0 || r.strongerWins > data.rows[i - 1]!.strongerWins);
  const inBand = checked.strongerWins >= POWER_LOW && checked.strongerWins <= POWER_HIGH;
  return { pass: inBand && rising, checked, rising, rows: data.rows };
}
