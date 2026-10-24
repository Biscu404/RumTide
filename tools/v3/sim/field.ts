// Checks 1 and 3 of GAMEPLAY 8.9 (P3.1): the templates (TEMPLATE_NAMES) against each other, and equal ships in either seat.
// The ships have no Fighting Style yet, so no trait counts: the simulator learns the styles in P3.B3.
//
// Check 1: no template doctrine wins more than 60% against the field of the others. The ships are equal fresh sloops.
// Every template meets every other template in every scene, once as the hunter and once as the target. A win is a
// battle that template won; draws, escapes and losses are not wins. The share is of all those battles, and a template
// passes when its share, averaged over the scenes, is at most 60%.
//
// Check 3: equal ships split wins evenly. The same battles seen without the doctrines: of the battles somebody won,
// how many did the hunter win? Every pair of templates is played in both seats, so what the doctrines do cancels and
// only the seat is left. The pooled field and each mirror match (a template against itself) must not lean away from
// 50% by more than 5 points, allowing for the noise of a finite number of battles.

import { TEMPLATE_NAMES, templateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { TemplateName } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES } from "./arena.ts";
import type { Fighter } from "./arena.ts";
import type { Effort } from "./effort.ts";
import type { DuelsJob, DuelsResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { decidedShare, emptyTally, flipTally, mergeTally, share, wilson } from "./stats.ts";
import type { Tally } from "./stats.ts";
import { chunked } from "./chunks.ts";

export const FIELD_CAP = 0.6; // GAMEPLAY 8.9: no template wins more than 60% against the field
export const SEAT_BAND = 0.05; // equal ships split decided battles 50% plus or minus 5 points

const template = (name: TemplateName): Fighter => ({ name, doctrine: templateDoctrine(name) });

/** The hunter's tally of every ordered pair of templates in one scene. cells[a][b] is a hunting b. */
export type Cells = Record<TemplateName, Record<TemplateName, DuelsResult>>;

export interface FieldData {
  scenes: Record<string, Cells>;
  perCell: number;
}

export async function runField(pool: Pool, effort: Effort, scenes: readonly string[] = SCENES.map((s) => s.name)): Promise<FieldData> {
  const jobs: DuelsJob[] = [];
  const cellOf: { a: TemplateName; b: TemplateName }[] = [];
  for (const scene of scenes) {
    for (const a of TEMPLATE_NAMES) for (const b of TEMPLATE_NAMES) {
      for (const part of chunked(effort.fieldPerCell, 250)) {
        jobs.push({ a: template(a), b: template(b), scene, label: `field/${scene}/${a}/${b}`, from: part.from, count: part.count });
        cellOf.push({ a, b });
      }
    }
  }
  const results = await pool.run("duels", jobs);
  const out: FieldData = { scenes: {}, perCell: effort.fieldPerCell };
  jobs.forEach((job, i) => {
    const cells = (out.scenes[job.scene] ??= emptyCells());
    const into = cells[cellOf[i]!.a][cellOf[i]!.b];
    mergeTally(into.tally, results[i]!.tally);
    into.lead += results[i]!.lead;
    into.rounds += results[i]!.rounds;
    for (const [k, v] of Object.entries(results[i]!.kinds)) into.kinds[k] = (into.kinds[k] ?? 0) + v;
  });
  return out;
}

function emptyCells(): Cells {
  const row = (): Record<TemplateName, DuelsResult> =>
    Object.fromEntries(TEMPLATE_NAMES.map((n) => [n, { tally: emptyTally(), kinds: {}, lead: 0, rounds: 0 }])) as Record<TemplateName, DuelsResult>;
  return Object.fromEntries(TEMPLATE_NAMES.map((n) => [n, row()])) as Cells;
}

// ---------- Check 1 ----------

export interface FieldShare {
  template: TemplateName;
  wins: number;
  battles: number;
  share: number;
  /** The same share in each scene. */
  byScene: Record<string, number>;
  /** How its battles ended against each other template, as a share of all of them: wins, draws, escapes and losses. */
  against: Record<string, { win: number; draw: number; escape: number; loss: number }>;
}

/** One template's wins against the field of the other three in one scene, as the hunter and as the target. */
function sceneShare(cells: Cells, t: TemplateName): { wins: number; battles: number } {
  let wins = 0;
  let battles = 0;
  for (const o of TEMPLATE_NAMES) {
    if (o === t) continue;
    wins += cells[t][o].tally.win + cells[o][t].tally.loss; // hunting o, and hunted by o
    battles += cells[t][o].tally.n + cells[o][t].tally.n;
  }
  return { wins, battles };
}

export function fieldShares(data: FieldData): FieldShare[] {
  return TEMPLATE_NAMES.map((t) => {
    let wins = 0;
    let battles = 0;
    const byScene: Record<string, number> = {};
    const against: FieldShare["against"] = {};
    for (const [scene, cells] of Object.entries(data.scenes)) {
      const s = sceneShare(cells, t);
      byScene[scene] = share(s.wins, s.battles);
      wins += s.wins;
      battles += s.battles;
    }
    for (const o of TEMPLATE_NAMES) {
      if (o === t) continue;
      const total = emptyTally();
      for (const cells of Object.values(data.scenes)) {
        mergeTally(total, cells[t][o].tally);
        mergeTally(total, flipTally(cells[o][t].tally));
      }
      against[o] = { win: share(total.win, total.n), draw: share(total.draw, total.n), escape: share(total.escape, total.n), loss: share(total.loss, total.n) };
    }
    // Every scene has the same number of battles, so the mean of the scene shares is the pooled share.
    const mean = Object.values(byScene).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(byScene).length);
    return { template: t, wins, battles, share: mean, byScene, against };
  });
}

export interface FieldVerdict {
  pass: boolean;
  worst: FieldShare;
  shares: FieldShare[];
}

export function judgeField(data: FieldData): FieldVerdict {
  const shares = fieldShares(data);
  const worst = shares.reduce((a, b) => (b.share > a.share ? b : a));
  return { pass: shares.every((s) => s.share <= FIELD_CAP), worst, shares };
}

// ---------- Check 3 ----------

export interface SeatRow {
  name: string; // "pooled field" or "<template> mirror"
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
    for (const a of TEMPLATE_NAMES) for (const b of TEMPLATE_NAMES) mergeTally(pooled, cells[a][b].tally);
    rows.push(seatRow("pooled field", scene, pooled));
    for (const t of TEMPLATE_NAMES) rows.push(seatRow(`${t} mirror`, scene, cells[t][t].tally));
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
  for (const cells of Object.values(data.scenes)) for (const a of TEMPLATE_NAMES) for (const b of TEMPLATE_NAMES) mergeTally(pooled, cells[a][b].tally);
  const overall = seatRow("pooled field", "all scenes", pooled);
  const failing = rows.filter((r) => !r.ok);
  return { pass: overall.ok && failing.length === 0, rows, overall, failing };
}
