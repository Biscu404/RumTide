// Check 8 (P3.B3): Drill matters without deciding alone (boarding spec acceptance 4).
//
// Between equal sloops, a Boarder with Drill against a Boarder with none, in the 9 scenes and both seats. The Boarder against the
// Boarder is the one fight where both crews board, so the deck fight is the whole battle.
//
//   Drill 5 against Drill 0: the Drill 5 ship must win most boarding fights without deciding them alone. It passes when it wins
//   DRILL5_LOW to DRILL5_HIGH of the decided battles (wins and losses, draws and escapes left out).
//
//   Drill 15 against Drill 0: it must stay inside the Power Rating line of check 4. A Drill 15 sloop rates about 1.38 times a
//   fresh one (D166), so its win share must lie between the shares check 4 measures for the two ratios on either side of that, in
//   the same run. Both are shares of the decided battles, wins over wins and losses (P3.2, D2xx): in check 4 a third of the fights
//   at a ratio of 1 to 1.25 are draws, in a boarding fight none are, so shares of the fought battles could not meet. The value
//   check 4's line gives at the Drill 15 rating, between its neighbours, is printed.
//
// Printed and not judged: the same Boarder at Drill 0, 5 and 15 against an undrilled Gunline, which D181 measured (a Gunline never
// boards, so Drill only helps the Boarder if it can grapple).

import { SCENES, ratingOf, styleFighter } from "./arena.ts";
import type { Fighter, ShipSpec } from "./arena.ts";
import { chunked } from "./chunks.ts";
import type { Effort } from "./effort.ts";
import { emptyDuels, mergeDuels } from "./jobs.ts";
import type { DuelsJob, DuelsResult } from "./jobs.ts";
import type { PowerData, PowerRow } from "./power.ts";
import type { Pool } from "./pool.ts";
import { decidedShare, flipTally, share, wilson } from "./stats.ts";
import type { Tally } from "./stats.ts";

export const DRILL5_LOW = 0.55; // "wins most boarding fights": more than half, with a margin for noise
export const DRILL5_HIGH = 0.8; // "without deciding alone": the same ceiling a designed win has in the wheel
export const DRILL_SHORT = 5; // the Drill levels of the check
export const DRILL_LONG = 15;

/** A Boarder of the given Drill. */
const boarder = (drill: number): Fighter => styleFighter("boarder", { levels: { drill } });
const gunline = (): Fighter => styleFighter("gunline");

/** One row of the check: a drilled Boarder against an opponent, from the drilled Boarder's point of view. */
export interface DrillRow {
  drill: number;
  against: "boarder" | "gunline";
  tally: Tally;
  kinds: Record<string, number>;
  /** Share of decided battles (wins and losses) the drilled Boarder won. */
  decided: number;
  /** The 95% range of that share. */
  range: [number, number];
  /** Wins as a share of the battles that were fought, the ones that did not end Escaped: the measure of check 4. */
  fought: number;
}

export interface DrillData {
  rows: DrillRow[];
  /** The Power Rating of a Drill 15 Boarder over a fresh sloop's. */
  ratio: number;
}

const rowOf = (drill: number, against: DrillRow["against"], r: DuelsResult): DrillRow => ({
  drill, against, tally: r.tally, kinds: r.kinds, decided: decidedShare(r.tally),
  range: wilson(r.tally.win, r.tally.win + r.tally.loss), fought: share(r.tally.win, r.tally.n - r.tally.escape),
});

/** The Power Rating of a Boarder with this much Drill over a fresh sloop's, from the engine (D166: about 1.38 at Drill 15). */
export const drillRatio = (drill: number): number => ratingOf({ style: "boarder", levels: { drill } } satisfies ShipSpec) / ratingOf();

export async function runDrill(pool: Pool, effort: Effort): Promise<DrillData> {
  const experiments: { drill: number; against: DrillRow["against"]; foe: Fighter }[] = [
    { drill: DRILL_SHORT, against: "boarder", foe: boarder(0) },
    { drill: DRILL_LONG, against: "boarder", foe: boarder(0) },
    { drill: 0, against: "gunline", foe: gunline() },
    { drill: DRILL_SHORT, against: "gunline", foe: gunline() },
    { drill: DRILL_LONG, against: "gunline", foe: gunline() },
  ];
  const jobs: DuelsJob[] = [];
  const meta: { row: number; drilledHunts: boolean }[] = [];
  experiments.forEach((e, row) => {
    for (const scene of SCENES) for (const drilledHunts of [true, false]) {
      for (const part of chunked(effort.drillPerCell, 250)) {
        const label = `drill/${e.against}/${e.drill}/${scene.name}/${drilledHunts ? "h" : "t"}`;
        jobs.push({ a: drilledHunts ? boarder(e.drill) : e.foe, b: drilledHunts ? e.foe : boarder(e.drill), scene: scene.name, label, from: part.from, count: part.count });
        meta.push({ row, drilledHunts });
      }
    }
  });
  const results = await pool.run("duels", jobs);
  // From the drilled Boarder's point of view: a job where it was the target is flipped.
  const totals = experiments.map(() => emptyDuels());
  results.forEach((r, i) => mergeDuels(totals[meta[i]!.row]!, meta[i]!.drilledHunts ? r : { ...r, tally: flipTally(r.tally) }));
  return { rows: experiments.map((e, i) => rowOf(e.drill, e.against, totals[i]!)), ratio: drillRatio(DRILL_LONG) };
}

/** The share of the decided battles (wins and losses, draws and escapes left out) that the stronger ship won in a row of check 4. */
export const strongerDecided = (row: PowerRow): number => (row.strongerWins + row.weakerWins > 0 ? row.strongerWins / (row.strongerWins + row.weakerWins) : 0.5);

/** The line of check 4 at one rating: the share of the decided battles the stronger ship wins, between the two rows either side. */
export interface PowerLine {
  ratio: number;
  below: PowerRow;
  above: PowerRow;
  /** The straight line between the two rows, at `ratio`. */
  interpolated: number;
  low: number;
  high: number;
}

export function powerLineAt(power: PowerData, ratio: number): PowerLine {
  const rows = [...power.rows].sort((a, b) => a.actual - b.actual);
  const below = [...rows].reverse().find((r) => r.actual <= ratio) ?? rows[0]!;
  const above = rows.find((r) => r.actual >= ratio) ?? rows[rows.length - 1]!;
  const t = above.actual > below.actual ? (ratio - below.actual) / (above.actual - below.actual) : 0;
  const [lo, hi] = [strongerDecided(below), strongerDecided(above)];
  const interpolated = lo + (hi - lo) * Math.min(1, Math.max(0, t));
  return { ratio, below, above, interpolated, low: Math.min(lo, hi), high: Math.max(lo, hi) };
}

export interface DrillVerdict {
  pass: boolean;
  drill5: { row: DrillRow; pass: boolean };
  drill15: { row: DrillRow; line: PowerLine; pass: boolean };
  /** The Boarder against the Gunline at Drill 0, 5 and 15. Not judged. */
  gunline: DrillRow[];
}

export function judgeDrill(data: DrillData, power: PowerData): DrillVerdict {
  const find = (drill: number, against: DrillRow["against"]): DrillRow => data.rows.find((r) => r.drill === drill && r.against === against)!;
  const five = find(DRILL_SHORT, "boarder");
  const fifteen = find(DRILL_LONG, "boarder");
  const line = powerLineAt(power, data.ratio);
  const fivePass = five.decided >= DRILL5_LOW && five.decided <= DRILL5_HIGH;
  const fifteenPass = fifteen.decided >= line.low && fifteen.decided <= line.high;
  return {
    pass: fivePass && fifteenPass,
    drill5: { row: five, pass: fivePass },
    drill15: { row: fifteen, line, pass: fifteenPass },
    gunline: data.rows.filter((r) => r.against === "gunline"),
  };
}
