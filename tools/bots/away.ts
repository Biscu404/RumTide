// How much does a week away cost, now that Shore Leave and Fair Winds pay out? (sections 3.5, 5.5 and 12.4)
//
// Bob is the same careful trader in two seasons that share a seed: once at his desk every Tide, once
// away for Tides 5 to 7 (his standing orders sail him home and keep him there). The other five
// captains are the same bots in both. The doc says a solo trader who misses a week ends at about
// 85% (section 3.5) or 93% (section 5.5) of an unbroken captain's earnings.

import { sixCaptains, playSeason, type CaptainSummary } from "./season.ts";

export interface AwayResult {
  seasons: number;
  /** Bob away, as a share of Bob at his desk, over the same seeds (1 is the same). */
  legend: number;
  levels: number;
  /** Chest plus what the upgrades cost is not tracked, so Chest and levels are shown separately. */
  chest: number;
  /** How many Tides a stored Tide of Shore Leave was spent in, and the most ever stored, on average. */
  spent: number;
  peak: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function awayExperiment(seeds: readonly number[], away: readonly number[] = [5, 6, 7]): AwayResult {
  const bobs = (absent: readonly number[]) => seeds.map((seed): CaptainSummary =>
    playSeason(seed, sixCaptains(seed, absent)).captains.find((c) => c.id === "bob")!);
  const here = bobs([]), gone = bobs(away);
  const ratio = (pick: (c: CaptainSummary) => number) => mean(gone.map(pick)) / mean(here.map(pick));
  return {
    seasons: seeds.length,
    legend: ratio((c) => c.legend), levels: ratio((c) => c.levels), chest: ratio((c) => c.chestGold),
    spent: mean(gone.map((c) => c.shoreLeaveSpent)), peak: mean(gone.map((c) => c.shoreLeavePeak)),
  };
}
