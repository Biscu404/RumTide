// Check 2 of GAMEPLAY 8.9 (P3.1): every Helm move and every Guns order is the best choice in at least one situation.
//
// A situation is a battle at the start of round k, reached by two captains who play their doctrines from round 1: any
// pair of the four templates, in a scene, with k from 1 to 4. In that situation all 24 plays (four Helm moves, each with
// six Guns orders) are tried for round k on the same seeds, and the captain goes on with its own doctrine afterwards.
// A play is worth the score of the battle (1 win, 0.5 draw or escape, 0 loss) plus a twentieth of the damage share lead.
//
// The best Helm move of a situation is the one in the best play, and it is "clearly best" if that play beats the best play
// of every other Helm move by more than two standard errors of the paired difference. The same goes for the Guns order.
// A situation only counts when the choice matters: its best and worst plays are at least 0.1 apart. The check passes
// when each of the 4 Helm moves and 6 Guns orders is clearly best in at least one situation.

import { GUNS_ORDERS, HELM_MOVES, TEMPLATE_NAMES, templateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { GunsOrder, HelmMove, TemplateName } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Effort } from "./effort.ts";
import type { Play, SituationJob, SituationResult } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { mean, pairedError } from "./stats.ts";

export const MATTERS = 0.1; // a situation counts when the best and worst play differ by at least this
export const CLEAR_ERRORS = 2; // clearly best: ahead by this many standard errors of the paired difference

export interface Situation {
  scene: string;
  me: TemplateName;
  foe: TemplateName;
  k: number;
}

export interface SituationRow extends Situation {
  /** The best play of the situation and what it was worth. */
  top: Play;
  topValue: number;
  /** Best play minus worst play. */
  spread: number;
  matters: boolean;
  /** The Helm move of the best play, set only when it is clearly best. */
  clearHelm: HelmMove | null;
  clearGuns: GunsOrder | null;
}

export interface SituationData {
  rows: SituationRow[];
  seeds: number;
}

export const describeSituation = (s: Situation): string => `${s.scene}, ${s.me} against ${s.foe}, round ${s.k}`;

export function listSituations(effort: Effort): Situation[] {
  const out: Situation[] = [];
  for (const scene of effort.situationScenes) {
    for (const me of TEMPLATE_NAMES) for (const foe of TEMPLATE_NAMES) for (const k of effort.situationRounds) out.push({ scene, me, foe, k });
  }
  return out;
}

/** Reads one situation's 24 plays: the best, whether the choice matters, and whether the Helm move and Guns order are clearly best. */
export function readSituation(s: Situation, result: SituationResult): SituationRow {
  const means = result.values.map(mean);
  let topAt = 0;
  means.forEach((m, i) => { if (m > means[topAt]!) topAt = i; });
  const worst = Math.min(...means);
  const top = result.plays[topAt]!;
  const margin = (otherAt: number): number => (means[topAt]! - means[otherAt]!) - CLEAR_ERRORS * pairedError(result.values[topAt]!, result.values[otherAt]!);
  // Is the best play clearly ahead of the best play of every other group, a group being a Helm move or a Guns order?
  const clear = (differs: (p: Play) => string): boolean => {
    const bestByGroup = new Map<string, number>();
    result.plays.forEach((p, i) => {
      const g = differs(p);
      const at = bestByGroup.get(g);
      if (at === undefined || means[i]! > means[at]!) bestByGroup.set(g, i);
    });
    const topGroup = differs(top);
    return [...bestByGroup.entries()].every(([g, at]) => g === topGroup || margin(at) > 0);
  };
  const spread = means[topAt]! - worst;
  const matters = spread >= MATTERS;
  return {
    ...s, top, topValue: means[topAt]!, spread, matters,
    clearHelm: matters && clear((p) => p.helm) ? top.helm : null,
    clearGuns: matters && clear((p) => p.guns) ? top.guns : null,
  };
}

export async function runSituations(pool: Pool, effort: Effort): Promise<SituationData> {
  const list = listSituations(effort);
  const jobs: SituationJob[] = list.map((s) => ({
    scene: s.scene, me: templateDoctrine(s.me), foe: templateDoctrine(s.foe), k: s.k, n: effort.situationSeeds,
    label: `situation/${s.scene}/${s.me}/${s.foe}/${s.k}`,
  }));
  const results = await pool.run("situation", jobs);
  return { rows: list.map((s, i) => readSituation(s, results[i]!)), seeds: effort.situationSeeds };
}

export interface Coverage<T extends string> {
  option: T;
  /** Situations where it is clearly the best. */
  clear: number;
  examples: string[];
}

export interface SituationVerdict {
  pass: boolean;
  situations: number;
  mattering: number;
  helm: Coverage<HelmMove>[];
  guns: Coverage<GunsOrder>[];
  missing: string[];
}

export function judgeSituations(data: SituationData): SituationVerdict {
  const cover = <T extends string>(options: readonly T[], pick: (r: SituationRow) => T | null): Coverage<T>[] =>
    options.map((option) => {
      const rows = data.rows.filter((r) => pick(r) === option);
      // The examples with the widest lead are the clearest ones to show.
      const examples = [...rows].sort((a, b) => b.spread - a.spread).slice(0, 3).map(describeSituation);
      return { option, clear: rows.length, examples };
    });
  const helm = cover(HELM_MOVES, (r) => r.clearHelm);
  const guns = cover(GUNS_ORDERS, (r) => r.clearGuns);
  const missing = [...helm.filter((c) => c.clear === 0).map((c) => c.option as string), ...guns.filter((c) => c.clear === 0).map((c) => c.option as string)];
  return { pass: missing.length === 0, situations: data.rows.length, mattering: data.rows.filter((r) => r.matters).length, helm, guns, missing };
}
