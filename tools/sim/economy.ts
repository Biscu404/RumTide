// Sections 3.5 and 5.5: what a solo trader earns, run on the real engine with the bot trader.
//
// The tables were made by a separate simulation we do not have, so they cannot be reproduced
// to the doubloon. Two bots bracket them instead. The careful trader plans a loop (a leg and the
// best leg back); the casual trader only looks at one leg and can be left in a port with nothing
// good to carry away. The documented trader should earn between the two.

import { seasonSettings } from "@engine/season.ts";
import { median } from "./stats.ts";
import { DEFAULT_POLICY, runTrader, type TraderPolicy, type TraderRun } from "./trader.ts";

/** Section 3.5, Season 0, solo trader: income per Tide, total upgrade levels, and the headline numbers. */
export const SECTION_3_5 = {
  income: [97, 113, 130, 134, 150, 158, 163, 186, 280, 313, 324, 352, 362, 374],
  levels: [5.0, 6.9, 9.2, 10.8, 11.6, 12.0, 12.8, 14.5, 17.4, 20.3, 21.1, 21.9, 22.7, 23.6],
  brigantineMedianTide: 8,
  earnedByTide14: 3100,
} as const;

/** Section 5.5, full costs, solo trader, 28 Tides: the Brigantine median Tide and the season total. */
export const SECTION_5_5 = { brigantineMedianTide: 11, earnedBySeasonEnd: 10_400 } as const;

export const CAREFUL: TraderPolicy = { ...DEFAULT_POLICY, route: "careful" };
export const CASUAL: TraderPolicy = { ...DEFAULT_POLICY, route: "casual" };

export const RUNS = 40;

export interface Summary {
  policy: TraderPolicy;
  runs: number;
  /** Mean income of each Tide over the runs. */
  income: number[];
  /** Mean total upgrade levels after each Tide. */
  levels: number[];
  /** Mean total earned by the end. */
  earned: number;
  /** Median Tide the Brigantine was finished, or null if fewer than half the runs got there. */
  brigantineTide: number | null;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function summarise(policy: TraderPolicy, runs: readonly TraderRun[]): Summary {
  const tides = runs[0]!.tides.length;
  const col = (pick: (t: TraderRun["tides"][number]) => number) =>
    Array.from({ length: tides }, (_, i) => mean(runs.map((r) => pick(r.tides[i]!))));
  const income = col((t) => t.income);
  const got = runs.map((r) => r.brigantineTide).filter((t): t is number => t !== null);
  return {
    policy, runs: runs.length, income, levels: col((t) => t.levels),
    earned: income.reduce((a, b) => a + b, 0),
    brigantineTide: got.length * 2 > runs.length ? median(got) : null,
  };
}

/** Both bots in Season 0 (14 Tides, costs 0.67 times). */
export function runSeason0() {
  const settings = seasonSettings("season0");
  const run = (policy: TraderPolicy) =>
    summarise(policy, Array.from({ length: RUNS }, (_, seed) => runTrader(policy, seed, settings)));
  return { careful: run(CAREFUL), casual: run(CASUAL) };
}

/** Both bots over a full 28 Tide season at full costs (section 5.5). */
export function runFullSeason() {
  const settings = seasonSettings("full");
  const run = (policy: TraderPolicy) =>
    summarise(policy, Array.from({ length: RUNS }, (_, seed) => runTrader(policy, seed, settings)));
  return { careful: run(CAREFUL), casual: run(CASUAL) };
}

export const cumulative = (xs: readonly number[], upTo: number) =>
  xs.slice(0, upTo).reduce((a, b) => a + b, 0);

/** Does the documented figure lie between the two bots, and are both within a believable distance of it? */
export function economyProblems(season0: ReturnType<typeof runSeason0>, full: ReturnType<typeof runFullSeason>): string[] {
  const problems: string[] = [];
  const { careful, casual } = season0;
  const doc = SECTION_3_5.earnedByTide14;
  if (!(casual.earned < doc && doc < careful.earned)) {
    problems.push(`Section 3.5 earned ${doc} is not between the casual ${Math.round(casual.earned)} and the careful ${Math.round(careful.earned)} trader`);
  }
  for (const s of [careful, casual]) {
    if (Math.abs(s.earned / doc - 1) > 0.4) {
      problems.push(`The ${s.policy.route} trader earned ${Math.round(s.earned)}, more than 40% from the documented ${doc}`);
    }
  }
  const doc8 = SECTION_3_5.brigantineMedianTide;
  if (careful.brigantineTide === null || casual.brigantineTide === null
      || !(careful.brigantineTide <= doc8 && doc8 <= casual.brigantineTide)) {
    problems.push(`Brigantine median Tide ${doc8} is not between careful (${careful.brigantineTide}) and casual (${casual.brigantineTide})`);
  }
  const doc11 = SECTION_5_5.brigantineMedianTide;
  if (full.careful.brigantineTide === null || full.casual.brigantineTide === null
      || !(full.careful.brigantineTide <= doc11 && doc11 <= full.casual.brigantineTide)) {
    problems.push(`Full cost Brigantine median Tide ${doc11} is not between careful (${full.careful.brigantineTide}) and casual (${full.casual.brigantineTide})`);
  }
  return problems;
}
