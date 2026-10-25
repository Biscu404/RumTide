// Check 10 (P3.B3): the Smuggler escapes (fighting styles spec acceptance 6). The Smuggler is the trader's style and sits outside
// the wheel, but it has one job: getting away with the cargo. Its fresh sloop, with its style and template, meets each of the six
// styles (fresh sloops with their styles and templates) in the 9 scenes and both seats. A battle counts when it ends Escaped and
// the Smuggler is the ship that got away. The record does not name who escaped, so the Smuggler got away when it played Open
// Range in the last round (jobs.ts countBattle); its template plays nothing else. The check passes when the Smuggler escapes at
// least SMUGGLER_MIN of its fights against every style.

import { FIGHTING_STYLES, SCENES, styleFighter } from "./arena.ts";
import type { WheelStyle } from "./arena.ts";
import { chunked } from "./chunks.ts";
import type { Effort } from "./effort.ts";
import { emptyDuels, mergeDuels } from "./jobs.ts";
import type { DuelsJob, DuelsResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { share, wilson } from "./stats.ts";

export const SMUGGLER_MIN = 0.3; // fighting styles spec acceptance 6

export interface SmugglerRow {
  against: WheelStyle;
  battles: number;
  escaped: number; // battles that ended Escaped with the Smuggler as the ship that got away
  /** Share of all the battles against this style. */
  share: number;
  range: [number, number];
  /** The battles the Smuggler won, lost and drew (an Escaped battle is none of these). */
  won: number;
  lost: number;
  drawn: number;
  /** Escaped battles in which the Smuggler did not play Open Range in the last round, so it did not get away. */
  other: number;
  ok: boolean;
}

export interface SmugglerData {
  rows: SmugglerRow[];
}

export async function runSmuggler(pool: Pool, effort: Effort): Promise<SmugglerData> {
  const jobs: DuelsJob[] = [];
  const meta: { style: WheelStyle; smugglerHunts: boolean }[] = [];
  for (const { style } of FIGHTING_STYLES) {
    for (const scene of SCENES) for (const smugglerHunts of [true, false]) {
      for (const part of chunked(effort.smugglerPerCell, 250)) {
        const smuggler = styleFighter("smuggler");
        const foe = styleFighter(style);
        jobs.push({
          a: smugglerHunts ? smuggler : foe, b: smugglerHunts ? foe : smuggler, scene: scene.name,
          label: `smuggler/${style}/${scene.name}/${smugglerHunts ? "h" : "t"}`, from: part.from, count: part.count,
        });
        meta.push({ style, smugglerHunts });
      }
    }
  }
  const results = await pool.run("duels", jobs);
  const totals = new Map<WheelStyle, { hunting: DuelsResult; hunted: DuelsResult }>();
  FIGHTING_STYLES.forEach(({ style }) => totals.set(style, { hunting: emptyDuels(), hunted: emptyDuels() }));
  results.forEach((r, i) => mergeDuels(meta[i]!.smugglerHunts ? totals.get(meta[i]!.style)!.hunting : totals.get(meta[i]!.style)!.hunted, r));
  const rows = FIGHTING_STYLES.map(({ style }): SmugglerRow => {
    const { hunting, hunted } = totals.get(style)!;
    const battles = hunting.tally.n + hunted.tally.n;
    const escaped = hunting.ran.hunter + hunted.ran.target; // the Smuggler's side: hunter when it hunts, target when it is hunted
    const escapes = hunting.tally.escape + hunted.tally.escape;
    const s = share(escaped, battles);
    return {
      against: style, battles, escaped, share: s, range: wilson(escaped, battles),
      won: hunting.tally.win + hunted.tally.loss, lost: hunting.tally.loss + hunted.tally.win, drawn: hunting.tally.draw + hunted.tally.draw,
      other: Math.max(0, escapes - escaped), ok: s >= SMUGGLER_MIN,
    };
  });
  return { rows };
}

export interface SmugglerVerdict {
  pass: boolean;
  rows: SmugglerRow[];
  lowest: SmugglerRow;
}

export function judgeSmuggler(data: SmugglerData): SmugglerVerdict {
  const lowest = data.rows.reduce((a, b) => (b.share < a.share ? b : a));
  return { pass: data.rows.every((r) => r.ok), rows: data.rows, lowest };
}
