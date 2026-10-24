// Runs the ten checks and writes the report (P3.1, P3.B3): the five of GAMEPLAY 8.9, and five for the Fighting Styles and the deck fight.

import { EFFORTS } from "./effort.ts";
import type { Effort } from "./effort.ts";
import { BOSS_HIGH, BOSS_LOW, judgeBoss, runBoss } from "./boss.ts";
import type { BossData, BossVerdict } from "./boss.ts";
import { DRILL5_HIGH, DRILL5_LOW, DRILL_LONG, DRILL_SHORT, judgeDrill, runDrill } from "./drill.ts";
import type { DrillData, DrillVerdict } from "./drill.ts";
import { FIELD_CAP, FIELD_FLOOR, judgeField, judgeSeats, runField } from "./field.ts";
import type { FieldData, FieldVerdict, SeatVerdict } from "./field.ts";
import { LASHED_MAX, LASHED_MIN_TRIES, judgeLashed, runLashed } from "./lashed.ts";
import type { LashedData, LashedVerdict } from "./lashed.ts";
import { patchText } from "./patch.ts";
import type { Patch } from "./patch.ts";
import { POWER_HIGH, POWER_LOW, judgePower, runPower } from "./power.ts";
import type { PowerData, PowerVerdict } from "./power.ts";
import { doctrineLines } from "./plans.ts";
import type { Pool } from "./pool.ts";
import { judgeSituations, runSituations } from "./situations.ts";
import type { SituationData, SituationVerdict } from "./situations.ts";
import { SMUGGLER_MIN, judgeSmuggler, runSmuggler } from "./smuggler.ts";
import type { SmugglerData, SmugglerVerdict } from "./smuggler.ts";
import { SPENT_ON, judgeSpending, runSpending, spendingLevels } from "./spending.ts";
import type { SpendingData, SpendingVerdict } from "./spending.ts";
import { pct, pctWithRange } from "./stats.ts";
import { WHEEL_EVEN_HIGH, WHEEL_EVEN_LOW, WHEEL_WIN_HIGH, WHEEL_WIN_LOW, judgeWheel } from "./wheel.ts";
import type { WheelVerdict } from "./wheel.ts";

export const CHECK_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export const CHECK_TITLES: Record<CheckId, string> = {
  1: "No style wins more than 60% against the field of the others, and none less than 25%",
  2: "Every Helm move, Guns order and style play is the best choice somewhere",
  3: "Equal ships split wins evenly",
  4: "Twice the Power Rating wins 85 to 90% of the time",
  5: "Old Shellback falls to a fresh sloop with a good doctrine about half the time, for every style",
  6: "The wheel: each style beats two, loses to two and is even with one",
  7: "Equal spending: no style goes above 60% of the field at 5 or 10 levels",
  8: "Drill matters without deciding alone",
  9: "Lashed fast: an equal ship cutting free from its boarder wins about a third of its tries",
  10: "The Smuggler escapes at least 30% of its fights against every style",
};

export interface Results {
  effort: Effort["name"];
  /** Numbers of balance.ts changed for this run with --set. */
  patch: Patch;
  seconds: Partial<Record<CheckId, number>>;
  field?: { data: FieldData; verdict: FieldVerdict };
  seats?: { verdict: SeatVerdict };
  situations?: { data: SituationData; verdict: SituationVerdict };
  power?: { data: PowerData; verdict: PowerVerdict };
  boss?: { data: BossData; verdict: BossVerdict };
  wheel?: { verdict: WheelVerdict };
  spending?: { data: SpendingData; verdict: SpendingVerdict };
  drill?: { data: DrillData; verdict: DrillVerdict };
  lashed?: { data: LashedData; verdict: LashedVerdict };
  smuggler?: { data: SmugglerData; verdict: SmugglerVerdict };
}

/**
 * Runs the chosen checks. Checks 1, 3 and 6 share their battles, so asking for any of them runs the field once. Check 8 compares
 * Drill 15 with the line of check 4, so it runs check 4's battles too, and only keeps them as check 4 if check 4 was asked for.
 */
export async function runChecks(pool: Pool, effort: Effort, which: readonly CheckId[] = CHECK_IDS, patch: Patch = {}): Promise<Results> {
  const out: Results = { effort: effort.name, patch, seconds: {} };
  const seconds = (since: number): number => (Date.now() - since) / 1000;
  const timed = async <T>(id: CheckId, work: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    const r = await work();
    out.seconds[id] = seconds(t0);
    return r;
  };
  if (which.includes(1) || which.includes(3) || which.includes(6)) {
    const t0 = Date.now();
    const data = await runField(pool, effort);
    const took = seconds(t0);
    if (which.includes(1)) { out.field = { data, verdict: judgeField(data) }; out.seconds[1] = took; }
    if (which.includes(3)) { out.seats = { verdict: judgeSeats(data) }; out.seconds[3] = took; }
    if (which.includes(6)) { out.wheel = { verdict: judgeWheel(data) }; out.seconds[6] = took; }
  }
  if (which.includes(2)) {
    const data = await timed(2, () => runSituations(pool, effort));
    out.situations = { data, verdict: judgeSituations(data) };
  }
  let powerSeconds = 0;
  let power: PowerData | undefined;
  if (which.includes(4) || which.includes(8)) {
    const t0 = Date.now();
    power = await runPower(pool, effort);
    powerSeconds = seconds(t0);
    if (which.includes(4)) { out.power = { data: power, verdict: judgePower(power) }; out.seconds[4] = powerSeconds; }
  }
  if (which.includes(5)) {
    const data = await timed(5, () => runBoss(pool, effort));
    out.boss = { data, verdict: judgeBoss(data) };
  }
  if (which.includes(7)) {
    const data = await timed(7, () => runSpending(pool, effort));
    out.spending = { data, verdict: judgeSpending(data) };
  }
  if (which.includes(8)) {
    const t0 = Date.now();
    const data = await runDrill(pool, effort);
    out.drill = { data, verdict: judgeDrill(data, power!) };
    out.seconds[8] = seconds(t0) + (which.includes(4) ? 0 : powerSeconds);
  }
  if (which.includes(9)) {
    const data = await timed(9, () => runLashed(pool, effort));
    out.lashed = { data, verdict: judgeLashed(data) };
  }
  if (which.includes(10)) {
    const data = await timed(10, () => runSmuggler(pool, effort));
    out.smuggler = { data, verdict: judgeSmuggler(data) };
  }
  return out;
}

/** The ids of the checks that ran and did not pass. */
export function failedChecks(r: Results): CheckId[] {
  const verdicts: [CheckId, { pass: boolean } | undefined][] = [
    [1, r.field?.verdict], [2, r.situations?.verdict], [3, r.seats?.verdict], [4, r.power?.verdict], [5, r.boss?.verdict],
    [6, r.wheel?.verdict], [7, r.spending?.verdict], [8, r.drill?.verdict], [9, r.lashed?.verdict], [10, r.smuggler?.verdict],
  ];
  return verdicts.filter(([, v]) => v !== undefined && !v.pass).map(([id]) => id);
}

// ---------- The report ----------

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const mark = (pass: boolean): string => (pass ? "PASS" : "FAIL");
const points = (x: number): string => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;

export function render(r: Results): string[] {
  const out: string[] = [];
  const effort = EFFORTS[r.effort];
  out.push(`Rumtide combat simulator, ${r.effort} run. The ten checks: the five of GAMEPLAY 8.9 and five for the Fighting Styles, on engine_v3.`);
  out.push(`With: ${patchText(r.patch)}.`, "");

  if (r.field) {
    const { verdict } = r.field;
    out.push(`1. ${CHECK_TITLES[1]}: ${mark(verdict.pass)}`);
    out.push(`   Equal fresh sloops that really have their style and play its template, ${effort.fieldPerCell} battles per scene and pair of styles in each seat. Wins as a share of all battles, mean of ${Object.keys(r.field.data.scenes).length} scenes. Pass: ${pct(FIELD_FLOOR)} to ${pct(FIELD_CAP)}.`);
    out.push(`   Largest ${verdict.largest.style} ${pct(verdict.largest.share, 1)}, smallest ${verdict.smallest.style} ${pct(verdict.smallest.share, 1)}.`);
    out.push(`   ${pad("Style", 12)}${pad("Field", 8)}${pad("Draws", 8)}${pad("Escapes", 9)}${pad("Worst scene", 20)}Best scene`);
    for (const s of verdict.shares) {
      const scenes = Object.entries(s.byScene).sort((a, b) => a[1] - b[1]);
      const worst = scenes[0]!;
      const best = scenes[scenes.length - 1]!;
      out.push(`   ${pad(s.style, 12)}${pad(pct(s.share, 1), 8)}${pad(pct(s.draws), 8)}${pad(pct(s.escapes), 9)}${pad(`${worst[0]} ${pct(worst[1])}`, 20)}${best[0]} ${pct(best[1])}`);
    }
    out.push("");
  }

  if (r.situations) {
    const { verdict, data } = r.situations;
    const k = verdict.kinds;
    out.push(`2. ${CHECK_TITLES[2]}: ${mark(verdict.pass)}`);
    out.push(`   ${verdict.situations} situations (${k.open} open, ${k.grappled} Grappled, ${k.drilled} Grappled between ships at Drill 5), ${verdict.mattering} where the choice matters. Every pair of the seven styles, ${data.seeds} battles per pair and scene.`);
    out.push(`   Every play the acting ship can give is tried for one round; clearly best means it beats the best play of every other Helm move or order by 2 standard errors.`);
    let group = "";
    for (const c of verdict.coverage) {
      if (c.group !== group) {
        group = c.group;
        out.push(`   ${group}`);
      }
      out.push(`      ${pad(c.name, 18)}${pad(c.clear, 6)}${c.clear > 0 ? c.examples.slice(0, 2).join("; ") : `never (counts in ${c.where})`}`);
    }
    out.push(verdict.missing.length > 0 ? `   Never clearly best: ${verdict.missing.join(", ")}.` : "   Every play is clearly best somewhere.");
    out.push("");
  }

  if (r.seats) {
    const { verdict } = r.seats;
    out.push(`3. ${CHECK_TITLES[3]}: ${mark(verdict.pass)}`);
    out.push(`   Of the battles somebody won, the hunter's share. It should be 50%, and the 95% range must reach into 45% to 55%.`);
    const o = verdict.overall;
    out.push(`   Pooled field, all scenes: hunter ${pct(o.hunterShare, 1)} of ${o.decided} decided (${pct(o.range[0], 1)} to ${pct(o.range[1], 1)}).`);
    if (verdict.failing.length === 0) out.push("   No scene or mirror match leans away from 50%.");
    for (const f of verdict.failing) out.push(`   ${pad(f.name, 20)}${pad(f.scene, 14)}hunter ${pct(f.hunterShare, 1)} of ${f.decided} (${pct(f.range[0], 1)} to ${pct(f.range[1], 1)})`);
    out.push("");
  }

  if (r.power) {
    const { verdict } = r.power;
    out.push(`4. ${CHECK_TITLES[4]}: ${mark(verdict.pass)}`);
    out.push(`   Random plans (the 7.3 method), a fresh sloop against a balanced stronger sloop, ${effort.powerPerCell * 18} battles per row over 9 scenes and both seats. Escaped battles are left out. Pass at ratio 2: ${pct(POWER_LOW)} to ${pct(POWER_HIGH)}, and rising.`);
    out.push(`   ${pad("Ratio", 8)}${pad("Power Rating", 14)}${pad("Stronger wins", 15)}${pad("Weaker wins", 13)}${pad("Draws", 8)}Escaped (share of all)`);
    for (const row of verdict.rows) {
      out.push(`   ${pad(row.ratio, 8)}${pad(`${(row.actual * 10).toFixed(1)} to 10`, 14)}${pad(pct(row.strongerWins, 1), 15)}${pad(pct(row.weakerWins, 1), 13)}${pad(pct(row.draws, 1), 8)}${pct(row.escaped, 1)}`);
    }
    if (!verdict.rising) out.push("   The stronger ship's share does not rise with the ratio.");
    out.push("");
  }

  if (r.boss) {
    const { verdict, data } = r.boss;
    out.push(`5. ${CHECK_TITLES[5]}: ${mark(verdict.pass)}`);
    out.push(`   A fresh sloop of each style on Tide 6 against Old Shellback. The best doctrine each search found (3 rules and an Otherwise, writing only the orders that style can give), judged on fights it never saw. Pass: every style ${pct(BOSS_LOW)} to ${pct(BOSS_HIGH)}.`);
    out.push(`   ${pad("Style", 12)}${pad("Beaten (95% range)", 24)}Result`);
    for (const row of verdict.rows) {
      out.push(`   ${pad(row.style, 12)}${pad(pctWithRange(row.best.result.beaten, row.best.seeds), 24)}${row.judged ? mark(row.ok) : "not judged"}`);
    }
    for (const s of data.styles) {
      out.push(`   ${s.style}${s.judged ? "" : " (not judged)"}, best doctrine:`);
      for (const line of doctrineLines(s.best.doctrine)) out.push(`      ${line}`);
      out.push(`      References (${s.references[0]!.seeds} fights each): ${s.references.map((ref) => `${ref.doctrine.name} ${pct(ref.rate)}`).join(", ")}`);
    }
    out.push(`   Win chance by Tide (best doctrine of ${data.paceStyle}, then its own template): ${data.pace.map((p) => `T${p.tide} ${pct(p.best)}/${pct(p.starter)}`).join("  ")}`);
    const g = data.gate;
    out.push(`   The gate (D108, one fight a Tide), for the best doctrine of ${data.paceStyle}: ${g.captains} captains at his door from Tide ${g.firstTide}. The median captain passes on Tide ${g.medianTide.toFixed(1)} (target 7 to 9), the last on Tide ${g.lastTide.toFixed(1)}, by Tide 12 in ${pct(g.lastByTwelve)} of seasons (target: nobody later).`);
    out.push("");
  }

  if (r.wheel) {
    const { verdict } = r.wheel;
    out.push(`6. ${CHECK_TITLES[6]}: ${mark(verdict.pass)}`);
    out.push(`   Read from the battles of check 1. The share of decided battles (a win or a loss, both seats, every scene) that went the designed way. A designed win passes at ${pct(WHEEL_WIN_LOW)} to ${pct(WHEEL_WIN_HIGH)}, an even pair at ${pct(WHEEL_EVEN_LOW)} to ${pct(WHEEL_EVEN_HIGH)}. Spec is the scratch prototype's number.`);
    out.push(`   ${pad("Pair", 34)}${pad("Share", 8)}${pad("95% range", 16)}${pad("Spec", 7)}${pad("Drift", 8)}${pad("Decided", 9)}Result`);
    for (const row of verdict.rows) {
      const name = row.kind === "win" ? `${row.a} over ${row.b}` : `${row.a} and ${row.b} (even)`;
      out.push(`   ${pad(name, 34)}${pad(pct(row.share, 1), 8)}${pad(`${pct(row.range[0], 1).replace("%", "")} to ${pct(row.range[1], 1)}`, 16)}${pad(pct(row.spec), 7)}${pad(points(row.share - row.spec), 8)}${pad(row.decided, 9)}${row.ok ? "ok" : "OUTSIDE"}`);
    }
    out.push("");
  }

  if (r.spending) {
    const { verdict } = r.spending;
    out.push(`7. ${CHECK_TITLES[7]}: ${mark(verdict.pass)}`);
    const spent = Object.entries(SPENT_ON).map(([style, stat]) => `${style} on ${stat}`).join(", ");
    out.push(`   The same levels for every style, spent the way it would (${spent}), in the field of check 1 (${effort.spendPerCell} battles per scene and pair in each seat). Levels played: ${spendingLevels().join(" and ")}. Level 15 is played only if Hull and Cannons allow it. Pass: none above ${pct(FIELD_CAP)}.`);
    out.push(`   ${pad("Levels", 8)}${verdict.rows[0]!.verdict.shares.map((s) => pad(s.style, 12)).join("")}Largest`);
    for (const row of verdict.rows) {
      out.push(`   ${pad(row.levels, 8)}${row.verdict.shares.map((s) => pad(pct(s.share, 1), 12)).join("")}${row.verdict.largest.style} ${pct(row.verdict.largest.share, 1)} ${mark(row.verdict.pass)}`);
    }
    out.push("");
  }

  if (r.drill) {
    const { verdict, data } = r.drill;
    out.push(`8. ${CHECK_TITLES[8]}: ${mark(verdict.pass)}`);
    out.push(`   A Boarder with Drill against an undrilled Boarder, both crews boarding, 9 scenes and both seats (${effort.drillPerCell * 18} battles per row).`);
    const five = verdict.drill5.row;
    out.push(`   Drill ${DRILL_SHORT}: wins ${pctWithRange(five.tally.win, five.tally.win + five.tally.loss, 1)} of the decided battles. Pass: ${pct(DRILL5_LOW)} to ${pct(DRILL5_HIGH)}. ${mark(verdict.drill5.pass)}`);
    const fifteen = verdict.drill15.row;
    const line = verdict.drill15.line;
    out.push(`   Drill ${DRILL_LONG}: wins ${pct(fifteen.fought, 1)} of the fought battles (the measure of check 4). A Drill ${DRILL_LONG} Boarder rates ${(data.ratio * 10).toFixed(1)} to 10, ${data.ratio.toFixed(2)} times a fresh sloop. Check 4 gives ${pct(line.below.strongerWins, 1)} at ${line.below.actual.toFixed(2)} and ${pct(line.above.strongerWins, 1)} at ${line.above.actual.toFixed(2)}, so ${pct(line.interpolated, 1)} here. Pass: ${pct(line.low, 1)} to ${pct(line.high, 1)}. ${mark(verdict.drill15.pass)}`);
    out.push(`   Not judged, the same Boarder against an undrilled Gunline (share of decided battles won): ${verdict.gunline.map((g) => `Drill ${g.drill} ${pct(g.decided)}`).join(", ")}.`);
    out.push("");
  }

  if (r.lashed) {
    const { verdict } = r.lashed;
    out.push(`9. ${CHECK_TITLES[9]}: ${mark(verdict.pass)}`);
    out.push(`   A Boarder against an equal sloop that opens range whenever it is Grappled, 9 scenes and both seats (${verdict.battles} battles). Pass: at most ${pct(LASHED_MAX)} of the tries won, from at least ${LASHED_MIN_TRIES} tries.`);
    out.push(`   The ship held fast tried ${verdict.tries} Cut Free contests and won ${verdict.wins}: ${pctWithRange(verdict.wins, verdict.tries, 1)}.${verdict.enough ? "" : " Too few tries to judge."}`);
    const c = verdict.control;
    out.push(`   Control, two sloops that both Board so nobody holds the edge (not judged): ${c.tries} tries, ${pctWithRange(c.wins, c.tries, 1)} won. About half is expected, so the doubling is what moved the share.`);
    out.push("");
  }

  if (r.smuggler) {
    const { verdict } = r.smuggler;
    out.push(`10. ${CHECK_TITLES[10]}: ${mark(verdict.pass)}`);
    out.push(`   A fresh Smuggler sloop against each style, 9 scenes and both seats (${effort.smugglerPerCell * 18} battles each). A battle counts when it ends Escaped and the Smuggler played Open Range in the last round. Pass: at least ${pct(SMUGGLER_MIN)} against every style.`);
    out.push(`   ${pad("Against", 12)}${pad("Escaped (95% range)", 24)}${pad("Won", 7)}${pad("Lost", 7)}${pad("Drawn", 7)}Result`);
    for (const row of verdict.rows) {
      out.push(`   ${pad(row.against, 12)}${pad(pctWithRange(row.escaped, row.battles, 1), 24)}${pad(pct(row.won / row.battles), 7)}${pad(pct(row.lost / row.battles), 7)}${pad(pct(row.drawn / row.battles), 7)}${mark(row.ok)}`);
    }
    out.push("");
  }

  const failed = failedChecks(r);
  const ran = CHECK_IDS.filter((id) => r.seconds[id] !== undefined).length;
  out.push(failed.length === 0 ? `All ${ran} checks run passed.` : `${failed.length} of ${ran} checks run failed: ${failed.join(", ")}.`);
  out.push(`Time: ${Object.entries(r.seconds).map(([id, s]) => `check ${id} ${s!.toFixed(1)}s`).join(", ")}.`);
  return out;
}
