// Runs the five checks of GAMEPLAY 8.9 and writes the report (P3.1).

import { EFFORTS } from "./effort.ts";
import type { Effort } from "./effort.ts";
import { BOSS_HIGH, BOSS_LOW, judgeBoss, runBoss } from "./boss.ts";
import type { BossData, BossVerdict } from "./boss.ts";
import { FIELD_CAP, judgeField, judgeSeats, runField } from "./field.ts";
import type { FieldData, FieldVerdict, SeatVerdict } from "./field.ts";
import { POWER_HIGH, POWER_LOW, judgePower, runPower } from "./power.ts";
import type { PowerData, PowerVerdict } from "./power.ts";
import { doctrineLines, gunsWord, helmWord } from "./plans.ts";
import type { Pool } from "./pool.ts";
import { judgeSituations, runSituations } from "./situations.ts";
import type { SituationData, SituationVerdict } from "./situations.ts";
import { pct, pctWithRange } from "./stats.ts";

export const CHECK_IDS = [1, 2, 3, 4, 5] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export const CHECK_TITLES: Record<CheckId, string> = {
  1: "No template wins more than 60% against the field of the others",
  2: "Every Helm move and Guns order is the best choice somewhere",
  3: "Equal ships split wins evenly",
  4: "Twice the Power Rating wins 85 to 90% of the time",
  5: "Old Shellback falls to a fresh sloop with a good doctrine about half the time",
};

export interface Results {
  effort: Effort["name"];
  seconds: Partial<Record<CheckId, number>>;
  field?: { data: FieldData; verdict: FieldVerdict };
  seats?: { verdict: SeatVerdict };
  situations?: { data: SituationData; verdict: SituationVerdict };
  power?: { data: PowerData; verdict: PowerVerdict };
  boss?: { data: BossData; verdict: BossVerdict };
}

/** Runs the chosen checks. Checks 1 and 3 share their battles, so asking for either runs the field once. */
export async function runChecks(pool: Pool, effort: Effort, which: readonly CheckId[] = CHECK_IDS): Promise<Results> {
  const out: Results = { effort: effort.name, seconds: {} };
  const timed = async <T>(id: CheckId, work: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    const r = await work();
    out.seconds[id] = (Date.now() - t0) / 1000;
    return r;
  };
  if (which.includes(1) || which.includes(3)) {
    const seconds0 = Date.now();
    const data = await runField(pool, effort);
    const took = (Date.now() - seconds0) / 1000;
    if (which.includes(1)) { out.field = { data, verdict: judgeField(data) }; out.seconds[1] = took; }
    if (which.includes(3)) { out.seats = { verdict: judgeSeats(data) }; out.seconds[3] = took; }
  }
  if (which.includes(2)) {
    const data = await timed(2, () => runSituations(pool, effort));
    out.situations = { data, verdict: judgeSituations(data) };
  }
  if (which.includes(4)) {
    const data = await timed(4, () => runPower(pool, effort));
    out.power = { data, verdict: judgePower(data) };
  }
  if (which.includes(5)) {
    const data = await timed(5, () => runBoss(pool, effort));
    out.boss = { data, verdict: judgeBoss(data) };
  }
  return out;
}

/** The ids of the checks that ran and did not pass. */
export function failedChecks(r: Results): CheckId[] {
  const failed: CheckId[] = [];
  if (r.field && !r.field.verdict.pass) failed.push(1);
  if (r.situations && !r.situations.verdict.pass) failed.push(2);
  if (r.seats && !r.seats.verdict.pass) failed.push(3);
  if (r.power && !r.power.verdict.pass) failed.push(4);
  if (r.boss && !r.boss.verdict.pass) failed.push(5);
  return failed;
}

// ---------- The report ----------

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const mark = (pass: boolean): string => (pass ? "PASS" : "FAIL");

export function render(r: Results): string[] {
  const out: string[] = [];
  const effort = EFFORTS[r.effort];
  out.push(`Rumtide combat simulator, ${r.effort} run. The five checks of GAMEPLAY 8.9, on engine_v3.`, "");

  if (r.field) {
    const { verdict } = r.field;
    out.push(`1. ${CHECK_TITLES[1]}: ${mark(verdict.pass)}`);
    out.push(`   Equal fresh sloops, ${effort.fieldPerCell} battles per scene and pair of templates in each seat. Wins as a share of all battles, mean of ${Object.keys(r.field.data.scenes).length} scenes. Cap ${pct(FIELD_CAP)}.`);
    out.push(`   ${pad("Template", 11)}${pad("Field", 8)}${pad("Best scene", 20)}${pad("Worst scene", 20)}Against (win/draw/escape/loss)`);
    for (const s of verdict.shares) {
      const scenes = Object.entries(s.byScene).sort((a, b) => a[1] - b[1]);
      const worst = scenes[scenes.length - 1]!;
      const best = scenes[0]!;
      const against = Object.entries(s.against).map(([o, a]) => `${o} ${pct(a.win)}/${pct(a.draw)}/${pct(a.escape)}/${pct(a.loss)}`).join("  ");
      out.push(`   ${pad(s.template, 11)}${pad(pct(s.share, 1), 8)}${pad(`${best[0]} ${pct(best[1])}`, 20)}${pad(`${worst[0]} ${pct(worst[1])}`, 20)}${against}`);
    }
    out.push("");
  }

  if (r.situations) {
    const { verdict, data } = r.situations;
    out.push(`2. ${CHECK_TITLES[2]}: ${mark(verdict.pass)}`);
    out.push(`   ${verdict.situations} situations (${data.seeds} seeds per play, 24 plays each), ${verdict.mattering} where the choice matters. A move is clearly best when it beats every other by 2 standard errors.`);
    out.push(`   ${pad("Helm move", 18)}${pad("Clearly best in", 17)}Examples`);
    for (const c of verdict.helm) out.push(`   ${pad(helmWord(c.option), 18)}${pad(c.clear, 17)}${c.examples.join("; ")}`);
    out.push(`   ${pad("Guns order", 18)}${pad("Clearly best in", 17)}Examples`);
    for (const c of verdict.guns) out.push(`   ${pad(gunsWord(c.option), 18)}${pad(c.clear, 17)}${c.examples.join("; ")}`);
    if (verdict.missing.length > 0) out.push(`   Never clearly best: ${verdict.missing.join(", ")}.`);
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
    out.push(`   A fresh sloop on Tide 6 against Old Shellback. The best doctrine the search found (3 rules and an Otherwise), judged on fights it never saw: ${pctWithRange(data.best.result.beaten, data.best.seeds)} beaten. Pass: ${pct(BOSS_LOW)} to ${pct(BOSS_HIGH)}.`);
    for (const line of doctrineLines(data.best.doctrine)) out.push(`      ${line}`);
    out.push(`   Reference doctrines (${data.references[0]!.seeds} fights each):`);
    for (const ref of data.references) out.push(`      ${pad(ref.doctrine.name, 12)}${pctWithRange(ref.result.beaten, ref.seeds)} beaten  ${Object.entries(ref.result.kinds).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    out.push(`   Win chance by Tide (best doctrine, starting doctrine): ${data.pace.map((p) => `T${p.tide} ${pct(p.best)}/${pct(p.starter)}`).join("  ")}`);
    const g = data.gate;
    out.push(`   The gate (D108, one fight a Tide): ${g.captains} captains at his door from Tide ${g.firstTide}. The median captain passes on Tide ${g.medianTide.toFixed(1)} (target 7 to 9), the last on Tide ${g.lastTide.toFixed(1)}, by Tide 12 in ${pct(g.lastByTwelve)} of seasons (target: nobody later).`);
    out.push("");
  }

  const failed = failedChecks(r);
  const ran = [r.field && 1, r.situations && 2, r.seats && 3, r.power && 4, r.boss && 5].filter(Boolean).length;
  out.push(failed.length === 0 ? `All ${ran} checks run passed.` : `${failed.length} of ${ran} checks run failed: ${failed.join(", ")}.`);
  out.push(`Time: ${Object.entries(r.seconds).map(([id, s]) => `check ${id} ${s!.toFixed(1)}s`).join(", ")}.`);
  return out;
}
