// Check 7 (P3.B3): equal spending. The same total upgrade levels N, spent the way each style would: the Boarder all on Drill, the
// Rammer all on Hull, the other four all on Cannons (fighting styles spec, "Upgrades"). Every style meets every other in the
// field of check 1 (9 scenes, both seats, each playing its template) with its own N levels. It passes when no style is above 60%
// of the field (FIELD_CAP, no floor) at any N.
//
// N is 5 and 10, and 15 only if all three stats allow 15 levels: Hull and Cannons stop at B.upgrade.maxLevel (10), Drill at the
// season's drillMaxLevel (15), so with the numbers as they are N = 15 is not played. A style sails with its own N levels and with
// its trait, so what this finds is whether one stat is worth more to its style than the others.

import { B, SEASON_PRESETS } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Stat } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { styleFighter } from "./arena.ts";
import type { ShipSpec, WheelStyle } from "./arena.ts";
import type { Effort } from "./effort.ts";
import { judgeCap, runField } from "./field.ts";
import type { CapVerdict, FieldData } from "./field.ts";
import type { Pool } from "./pool.ts";

/** The stat each style puts all its levels on. */
export const SPENT_ON: Record<WheelStyle, Stat> = {
  bombardier: "cannons", gunline: "cannons", skirmisher: "cannons", rammer: "hull", boarder: "drill", firebrand: "cannons",
};

/** The totals of levels to try: 5, 10 and 15, as far as every stat in SPENT_ON allows. Read when the check runs, so a patch counts. */
export function spendingLevels(): number[] {
  const stats = new Set(Object.values(SPENT_ON));
  const most = Math.min(...[...stats].map((s) => (s === "drill" ? SEASON_PRESETS.season0.drillMaxLevel : B.upgrade.maxLevel)));
  return [5, 10, 15].filter((n) => n <= most);
}

/** A fresh sloop of this style with `n` levels on the stat the style would buy. */
export const spentLike = (style: WheelStyle, n: number): ShipSpec => ({ levels: { [SPENT_ON[style]]: n } });

export interface SpendingRow {
  levels: number;
  data: FieldData;
  verdict: CapVerdict;
}

export interface SpendingData {
  rows: SpendingRow[];
}

export async function runSpending(pool: Pool, effort: Effort): Promise<SpendingData> {
  const rows: SpendingRow[] = [];
  for (const levels of spendingLevels()) {
    const data = await runField(pool, effort, {
      label: `spend${levels}`, perCell: effort.spendPerCell, fighter: (style) => styleFighter(style, spentLike(style, levels)),
    });
    rows.push({ levels, data, verdict: judgeCap(data) });
  }
  return { rows };
}

export interface SpendingVerdict {
  pass: boolean;
  rows: { levels: number; verdict: CapVerdict }[];
}

export function judgeSpending(data: SpendingData): SpendingVerdict {
  return { pass: data.rows.every((r) => r.verdict.pass), rows: data.rows.map((r) => ({ levels: r.levels, verdict: r.verdict })) };
}
