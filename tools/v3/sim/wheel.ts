// Check 6 (P3.B3): the wheel. Each Fighting Style beats two, loses to two and is even with one (fighting styles spec section 5).
//
// Read from the battles of check 1, so it costs no new ones. For each of the 15 pairs, the share of decided battles (a win or a
// loss, pooled over every scene and both seats; draws and escapes are left out) that went the designed way. A designed win must
// land from WHEEL_WIN_LOW to WHEEL_WIN_HIGH, an even pair from WHEEL_EVEN_LOW to WHEEL_EVEN_HIGH. Every pair is printed with its
// 95% range (Wilson) and the number the scratch prototype measured, so the drift from the design is in view for P3.2.

import type { WheelStyle } from "./arena.ts";
import { pairTally } from "./field.ts";
import type { FieldData } from "./field.ts";
import { share, wilson } from "./stats.ts";

export const WHEEL_WIN_LOW = 0.55; // a designed win: the winner takes 55% to 80% of the decided battles
export const WHEEL_WIN_HIGH = 0.8;
export const WHEEL_EVEN_LOW = 0.35; // an even pair: either style takes 35% to 65%
export const WHEEL_EVEN_HIGH = 0.65;

/**
 * The 12 designed wins of docs/specs/fighting-styles.md section 5, each as the winner, the loser and the share of decided battles
 * the winner took in the scratch prototype (the "Beats" column of the table). D180 measured the same pairs on the real engine.
 */
export const WHEEL_WINS: readonly { winner: WheelStyle; loser: WheelStyle; spec: number }[] = [
  { winner: "bombardier", loser: "gunline", spec: 0.57 },
  { winner: "bombardier", loser: "firebrand", spec: 0.65 },
  { winner: "gunline", loser: "skirmisher", spec: 0.78 },
  { winner: "gunline", loser: "boarder", spec: 0.61 },
  { winner: "skirmisher", loser: "rammer", spec: 0.77 },
  { winner: "skirmisher", loser: "firebrand", spec: 0.57 },
  { winner: "rammer", loser: "gunline", spec: 0.7 },
  { winner: "rammer", loser: "bombardier", spec: 0.75 },
  { winner: "boarder", loser: "skirmisher", spec: 0.6 },
  { winner: "boarder", loser: "bombardier", spec: 0.57 },
  { winner: "firebrand", loser: "boarder", spec: 0.57 },
  { winner: "firebrand", loser: "rammer", spec: 0.68 },
];

/** The 3 even pairs of the same table (the "Even with" column), with the share of decided battles `a` took in the prototype. */
export const WHEEL_EVEN: readonly { a: WheelStyle; b: WheelStyle; spec: number }[] = [
  { a: "bombardier", b: "skirmisher", spec: 0.63 },
  { a: "gunline", b: "firebrand", spec: 0.4 },
  { a: "rammer", b: "boarder", spec: 0.6 },
];

export interface WheelRow {
  kind: "win" | "even";
  /** The designed winner of a win, the first style of an even pair. */
  a: WheelStyle;
  b: WheelStyle;
  aWins: number;
  bWins: number;
  decided: number;
  /** Share of decided battles `a` won. */
  share: number;
  /** The 95% range of that share. */
  range: [number, number];
  /** The prototype's share, from the spec. */
  spec: number;
  ok: boolean;
}

export interface WheelVerdict {
  pass: boolean;
  rows: WheelRow[];
  failing: WheelRow[];
}

function row(data: FieldData, kind: WheelRow["kind"], a: WheelStyle, b: WheelStyle, spec: number): WheelRow {
  const t = pairTally(data, a, b);
  const decided = t.win + t.loss;
  const s = share(t.win, decided);
  const [low, high] = kind === "win" ? [WHEEL_WIN_LOW, WHEEL_WIN_HIGH] : [WHEEL_EVEN_LOW, WHEEL_EVEN_HIGH];
  // With nothing decided there is nothing to show: a designed win fails and an even pair passes, as a share of 50% would.
  const shown = decided > 0 ? s : 0.5;
  return { kind, a, b, aWins: t.win, bWins: t.loss, decided, share: shown, range: wilson(t.win, decided), spec, ok: shown >= low && shown <= high };
}

export function judgeWheel(data: FieldData): WheelVerdict {
  const rows = [
    ...WHEEL_WINS.map((w) => row(data, "win", w.winner, w.loser, w.spec)),
    ...WHEEL_EVEN.map((e) => row(data, "even", e.a, e.b, e.spec)),
  ];
  const failing = rows.filter((r) => !r.ok);
  return { pass: failing.length === 0, rows, failing };
}

/** Every pair of the six styles appears once among the wins and the even pairs. Used by the tests. */
export function wheelPairs(): string[] {
  const key = (x: WheelStyle, y: WheelStyle): string => [x, y].sort().join("/");
  return [...WHEEL_WINS.map((w) => key(w.winner, w.loser)), ...WHEEL_EVEN.map((e) => key(e.a, e.b))];
}
