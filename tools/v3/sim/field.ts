// Checks 1 and 3 of GAMEPLAY 8.9 (P3.1), and the battles that check 6 and check 7 read too (P3.B3): the six Fighting Styles
// (FIGHTING_STYLES) against each other, and equal ships in either seat.
//
// Check 1: no style wins more than 60% against the field of the others, and none wins less than 25%. The ships are equal fresh
// sloops that really have their style (the Bombardier's smaller crew, the Spotters, every trait) and play the style's template.
// Every style meets every other style in every scene, once as the hunter and once as the target. A win is a battle that style
// won; draws, escapes and losses are not wins. The share is of all those battles, averaged over the scenes, and a style passes
// when its share is from FIELD_FLOOR to FIELD_CAP. The largest and the smallest are reported.
//
// Check 3: equal ships split wins evenly. The same battles seen without the doctrines: of the battles somebody won, how many did
// the hunter win? Every pair of styles is played in both seats, so what the doctrines do cancels and only the seat is left. The
// pooled field and each mirror match (a style against itself) must not lean away from 50% by more than 5 points, allowing for the
// noise of a finite number of battles. Two identical Boarders, or two identical Skirmishers, always draw (the deck fight has no luck
// roll), so such a mirror has no decided battles and is fine.
//
// The wheel (check 6, wheel.ts) is read from the same battles, and equal spending (check 7, spending.ts) plays them again with
// upgrades.

import { SCENES, FIGHTING_STYLES, styleFighter } from "./arena.ts";
import type { Fighter, WheelStyle } from "./arena.ts";
import type { Effort } from "./effort.ts";
import { emptyDuels, mergeDuels } from "./jobs.ts";
import type { DuelsJob, DuelsResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { decidedShare, emptyTally, flipTally, mergeTally, share, wilson } from "./stats.ts";
import type { Tally } from "./stats.ts";
import { chunked } from "./chunks.ts";

export const FIELD_CAP = 0.6; // GAMEPLAY 8.9: no style wins more than 60% against the field
export const FIELD_FLOOR = 0.25; // and none wins less than 25% (fighting styles spec acceptance 1)
export const SEAT_BAND = 0.05; // equal ships split decided battles 50% plus or minus 5 points

export const WHEEL_STYLES: readonly WheelStyle[] = FIGHTING_STYLES.map((f) => f.style);

/** The hunter's tally of every ordered pair of styles in one scene. cells[a][b] is a hunting b. */
export type Cells = Record<WheelStyle, Record<WheelStyle, DuelsResult>>;

export interface FieldData {
  scenes: Record<string, Cells>;
  perCell: number;
}

export interface FieldOptions {
  scenes?: readonly string[];
  /** Names the experiment, so its seeds are its own. */
  label?: string;
  /** The captain of a style. The default is the style's fresh sloop with its template. */
  fighter?: (style: WheelStyle) => Fighter;
  perCell?: number;
}

export async function runField(pool: Pool, effort: Effort, options: FieldOptions = {}): Promise<FieldData> {
  const scenes = options.scenes ?? SCENES.map((s) => s.name);
  const label = options.label ?? "field";
  const fighter = options.fighter ?? ((style: WheelStyle) => styleFighter(style));
  const perCell = options.perCell ?? effort.fieldPerCell;
  const jobs: DuelsJob[] = [];
  const cellOf: { a: WheelStyle; b: WheelStyle }[] = [];
  for (const scene of scenes) {
    for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) {
      for (const part of chunked(perCell, 250)) {
        jobs.push({ a: fighter(a), b: fighter(b), scene, label: `${label}/${scene}/${a}/${b}`, from: part.from, count: part.count });
        cellOf.push({ a, b });
      }
    }
  }
  const results = await pool.run("duels", jobs);
  const out: FieldData = { scenes: {}, perCell };
  jobs.forEach((job, i) => {
    const cells = (out.scenes[job.scene] ??= emptyCells());
    mergeDuels(cells[cellOf[i]!.a][cellOf[i]!.b], results[i]!);
  });
  return out;
}

function emptyCells(): Cells {
  const row = (): Record<WheelStyle, DuelsResult> => Object.fromEntries(WHEEL_STYLES.map((s) => [s, emptyDuels()])) as Record<WheelStyle, DuelsResult>;
  return Object.fromEntries(WHEEL_STYLES.map((s) => [s, row()])) as Cells;
}

/** Style `a`'s tally against style `b` over every scene, both seats: a hunting b, and a hunted by b. */
export function pairTally(data: FieldData, a: WheelStyle, b: WheelStyle): Tally {
  const total = emptyTally();
  for (const cells of Object.values(data.scenes)) {
    mergeTally(total, cells[a][b].tally);
    mergeTally(total, flipTally(cells[b][a].tally));
  }
  return total;
}

// ---------- Check 1 ----------

export interface FieldShare {
  style: WheelStyle;
  wins: number;
  battles: number;
  share: number;
  /** The same share in each scene. */
  byScene: Record<string, number>;
  /** How its battles ended against each other style, as a share of all of them: wins, draws, escapes and losses. */
  against: Record<string, { win: number; draw: number; escape: number; loss: number }>;
  /** The same over all its battles. */
  draws: number;
  escapes: number;
}

/** One style's wins against the field of the other five in one scene, as the hunter and as the target. */
function sceneShare(cells: Cells, t: WheelStyle): { wins: number; battles: number } {
  let wins = 0;
  let battles = 0;
  for (const o of WHEEL_STYLES) {
    if (o === t) continue;
    wins += cells[t][o].tally.win + cells[o][t].tally.loss; // hunting o, and hunted by o
    battles += cells[t][o].tally.n + cells[o][t].tally.n;
  }
  return { wins, battles };
}

export function fieldShares(data: FieldData): FieldShare[] {
  return WHEEL_STYLES.map((t) => {
    let wins = 0;
    let battles = 0;
    const byScene: Record<string, number> = {};
    const against: FieldShare["against"] = {};
    const all = emptyTally();
    for (const [scene, cells] of Object.entries(data.scenes)) {
      const s = sceneShare(cells, t);
      byScene[scene] = share(s.wins, s.battles);
      wins += s.wins;
      battles += s.battles;
    }
    for (const o of WHEEL_STYLES) {
      if (o === t) continue;
      const total = pairTally(data, t, o);
      mergeTally(all, total);
      against[o] = { win: share(total.win, total.n), draw: share(total.draw, total.n), escape: share(total.escape, total.n), loss: share(total.loss, total.n) };
    }
    // Every scene has the same number of battles, so the mean of the scene shares is the pooled share.
    const mean = Object.values(byScene).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(byScene).length);
    return { style: t, wins, battles, share: mean, byScene, against, draws: share(all.draw, all.n), escapes: share(all.escape, all.n) };
  });
}

export interface FieldVerdict {
  pass: boolean;
  largest: FieldShare;
  smallest: FieldShare;
  shares: FieldShare[];
}

const extremes = (shares: FieldShare[]): { largest: FieldShare; smallest: FieldShare } => ({
  largest: shares.reduce((a, b) => (b.share > a.share ? b : a)),
  smallest: shares.reduce((a, b) => (b.share < a.share ? b : a)),
});

/** Check 1: every style from FIELD_FLOOR to FIELD_CAP. */
export function judgeField(data: FieldData): FieldVerdict {
  const shares = fieldShares(data);
  return { pass: shares.every((s) => s.share <= FIELD_CAP && s.share >= FIELD_FLOOR), ...extremes(shares), shares };
}

export interface CapVerdict {
  pass: boolean;
  largest: FieldShare;
  shares: FieldShare[];
}

/** Check 7: no style above FIELD_CAP, with no floor. */
export function judgeCap(data: FieldData): CapVerdict {
  const shares = fieldShares(data);
  return { pass: shares.every((s) => s.share <= FIELD_CAP), largest: extremes(shares).largest, shares };
}

// ---------- Check 3 ----------

export interface SeatRow {
  name: string; // "pooled field" or "<style> mirror"
  scene: string;
  hunterWins: number;
  targetWins: number;
  decided: number;
  hunterShare: number;
  /** The 95% range of the hunter's share of decided battles. */
  range: [number, number];
  /** The range reaches into 45% to 55%. */
  ok: boolean;
}

const seatRow = (name: string, scene: string, t: Tally): SeatRow => {
  const decided = t.win + t.loss;
  const range = wilson(t.win, decided);
  return {
    name, scene, hunterWins: t.win, targetWins: t.loss, decided, hunterShare: decidedShare(t), range,
    ok: decided === 0 || (range[1] >= 0.5 - SEAT_BAND && range[0] <= 0.5 + SEAT_BAND),
  };
};

/** The pooled field and each mirror match, in every scene. */
export function seatRows(data: FieldData): SeatRow[] {
  const rows: SeatRow[] = [];
  for (const [scene, cells] of Object.entries(data.scenes)) {
    const pooled = emptyTally();
    for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) mergeTally(pooled, cells[a][b].tally);
    rows.push(seatRow("pooled field", scene, pooled));
    for (const t of WHEEL_STYLES) rows.push(seatRow(`${t} mirror`, scene, cells[t][t].tally));
  }
  return rows;
}

export interface SeatVerdict {
  pass: boolean;
  rows: SeatRow[];
  /** The pooled field over every scene. */
  overall: SeatRow;
  failing: SeatRow[];
}

export function judgeSeats(data: FieldData): SeatVerdict {
  const rows = seatRows(data);
  const pooled = emptyTally();
  for (const cells of Object.values(data.scenes)) for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) mergeTally(pooled, cells[a][b].tally);
  const overall = seatRow("pooled field", "all scenes", pooled);
  const failing = rows.filter((r) => !r.ok);
  return { pass: overall.ok && failing.length === 0, rows, overall, failing };
}
