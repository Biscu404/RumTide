// Check 2 of GAMEPLAY 8.9 (P3.1, P3.B3): every Helm move and every Guns order is the best choice in at least one situation, and
// so are the plays the Fighting Styles and the deck fight added.
//
// A situation is a battle at the start of round k, reached by two captains who play their doctrines from round 1: any pair of
// the seven Fighting Styles (ships that really have the style, playing its template), in a scene, with k from 1 to 4 in an open
// fight or from 3 to 7 in a Grappled one (overtime included). The battles that reach round k are grouped by the distance round k
// begins at, found by playing the pair through first (jobs.ts runStarts), and each group of enough battles is one situation, with
// that distance recorded. In a situation every play the acting ship (the hunter) can give is tried for round k on the same
// seeds, and the captain goes on with its own doctrine afterwards.
//
// What a ship can try is one rule, plays.ts: the six Guns orders for everyone, the Mortar for a Bombardier, Hot Shot for a
// Firebrand, and in a Grappled situation Charge, Volley and (for a ship that can throw one) Fire Pots. Fire Pots only count in a
// third set of situations between ships at Drill 5, which each carry the Fire Pots of a Firebrand's start. Those pots are a test
// setup: a Drill 5 ship in the game buys them (P5 sets the prices), and Drill 5 is what unlocks throwing them for every style.
//
// A play is worth the score of the battle (1 win, 0.5 draw or escape, 0 loss) plus a twentieth of the damage share lead.
// The best Helm move of a situation is the one in the best play, and it is "clearly best" if that play beats the best play
// of every other Helm move by more than two standard errors of the paired difference. The same goes for the Guns order, among the
// orders that ship could give. A situation only counts when the choice matters: its best and worst plays are at least 0.1 apart.
//
// The check passes when each of the 4 Helm moves, the 11 Guns orders and the 2 special plays is clearly best at least once:
//   Round shot, Chain shot, Grapeshot, Hold Fire, Board, Mortar and Hot Shot in an open fight;
//   Repel, Charge and Volley in a Grappled one, and Fire Pots in a Grappled one between ships at Drill 5;
//   Ram: a Rammer's round that begins at Close, with Close In the clearly best Helm move;
//   Board from Short: a Boarder's round that begins at Short, with Board the clearly best Guns order.
// Fists is a fallback and not a choice, so it is not checked.

import {
  B, FIGHTING_STYLES as ALL_STYLES, HELM_MOVES, styleTemplate,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { FightingStyle, GunsOrder, HelmMove, Range } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { styleFighter } from "./arena.ts";
import type { Fighter, ShipSpec } from "./arena.ts";
import type { Effort } from "./effort.ts";
import type { SituationJob, SituationResult, StartsJob, StartsResult } from "./jobs.ts";
import { canTry, playsFor } from "./plays.ts";
import type { Play, Setting } from "./plays.ts";
import { gunsWord, helmWord } from "./plans.ts";
import type { Pool } from "./pool.ts";
import { mean, pairedError } from "./stats.ts";

export const MATTERS = 0.1; // a situation counts when the best and worst play differ by at least this
export const CLEAR_ERRORS = 2; // clearly best: ahead by this many standard errors of the paired difference

/** A ship of this style at the Drill that unlocks Fire Pots, with a Firebrand's starting pots. A test setup for the Drill 5 situations. */
export const drilledShip = (style: FightingStyle): ShipSpec => ({
  style, levels: { drill: B.drill.unlocks.firePots }, pots: B.styles.firebrand.startPots,
});

/** The ship the acting captain sails in a situation: the style's fresh sloop, or the Drill 5 setup. */
export const situationShip = (style: FightingStyle, drill: number): ShipSpec => (drill > 0 ? drilledShip(style) : { style });

const fighterOf = (style: FightingStyle, drill: number): Fighter => styleFighter(style, drill > 0 ? drilledShip(style) : {});

export interface Situation {
  scene: string;
  me: FightingStyle; // the acting captain, the hunter
  foe: FightingStyle;
  k: number;
  /** The distance round k begins at, read from the Chooser's view. */
  range: Range;
  /** The Drill both ships have (0 for fresh sloops, or the Drill that unlocks Fire Pots, with pots in the hold). */
  drill: number;
  /** How many battles begin round k like this. */
  seeds: number;
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
  /** Battles played through to find where each round begins, per pair and scene. */
  seeds: number;
}

export const setting = (s: Pick<Situation, "range">): Setting => (s.range === "grappled" ? "grappled" : "open");

const RANGE_WORDS: Record<Range, string> = { far: "Far", long: "Long", medium: "Medium", short: "Short", close: "Close", grappled: "Grappled" };

export const describeSituation = (s: Situation): string =>
  `${s.scene}, ${styleTemplate(s.me)} against ${styleTemplate(s.foe)}, round ${s.k} at ${RANGE_WORDS[s.range]}${s.drill > 0 ? `, Drill ${s.drill}` : ""}`;

// ---------- Finding the situations ----------

/** One pair of captains in one scene and the rounds to look at, before the battles say where those rounds begin. */
export interface Pairing {
  set: "plain" | "drilled";
  scene: string;
  me: FightingStyle;
  foe: FightingStyle;
  drill: number;
  open: number[]; // rounds to look at in an open fight
  grappled: number[]; // rounds to look at in a Grappled one
}

export function listPairings(effort: Effort): Pairing[] {
  const out: Pairing[] = [];
  for (const scene of effort.situationScenes) {
    for (const me of ALL_STYLES) for (const foe of ALL_STYLES) {
      out.push({ set: "plain", scene, me, foe, drill: 0, open: effort.situationRounds, grappled: effort.grappledRounds });
    }
  }
  for (const scene of effort.drilledScenes) {
    for (const me of ALL_STYLES) for (const foe of ALL_STYLES) {
      out.push({ set: "drilled", scene, me, foe, drill: B.drill.unlocks.firePots, open: [], grappled: effort.grappledRounds });
    }
  }
  return out;
}

const labelOf = (p: Pairing): string => `situation/${p.set}/${p.scene}/${p.me}/${p.foe}`;

/**
 * The situations of one pair: for each round, the battles that begin it at the same distance. An open round keeps the groups that
 * are not Grappled, a Grappled round the Grappled group, and a group needs `minSeeds` battles to be a situation.
 */
export function situationsOf(p: Pairing, starts: readonly (readonly Range[])[], minSeeds: number): { situation: Situation; samples: number[] }[] {
  const out: { situation: Situation; samples: number[] }[] = [];
  const rounds = [...new Set([...p.open, ...p.grappled])].sort((a, b) => a - b);
  for (const k of rounds) {
    const groups = new Map<Range, number[]>();
    starts.forEach((s, i) => {
      const range = s[k - 1];
      if (range !== undefined) groups.set(range, [...(groups.get(range) ?? []), i]);
    });
    for (const [range, samples] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const wanted = range === "grappled" ? p.grappled.includes(k) : p.open.includes(k);
      if (!wanted || samples.length < minSeeds) continue;
      out.push({ situation: { scene: p.scene, me: p.me, foe: p.foe, k, range, drill: p.drill, seeds: samples.length }, samples });
    }
  }
  return out;
}

/** Reads one situation's plays: the best, whether the choice matters, and whether the Helm move and Guns order are clearly best. */
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
  const pairings = listPairings(effort);
  const startJobs: StartsJob[] = pairings.map((p) => ({
    a: fighterOf(p.me, p.drill), b: fighterOf(p.foe, p.drill), scene: p.scene, label: labelOf(p), count: effort.situationSeeds,
  }));
  const started: StartsResult[] = await pool.run("starts", startJobs);
  const jobs: SituationJob[] = [];
  const found: Situation[] = [];
  pairings.forEach((p, i) => {
    for (const { situation, samples } of situationsOf(p, started[i]!.starts, effort.situationMinSeeds)) {
      jobs.push({
        scene: p.scene, me: fighterOf(p.me, p.drill), foe: fighterOf(p.foe, p.drill), k: situation.k, samples, range: situation.range,
        label: labelOf(p), plays: playsFor(situationShip(p.me, p.drill), setting(situation)),
      });
      found.push(situation);
    }
  });
  const results = await pool.run("situation", jobs);
  return { rows: found.map((s, i) => readSituation(s, results[i]!)), seeds: effort.situationSeeds };
}

// ---------- Judging ----------

/** The kinds of play check 2 requires, in the order the report lists them. */
export type PlayId = HelmMove | GunsOrder | "ram" | "boardFromShort";
export type PlayGroup = "Helm moves" | "Guns orders" | "Deck orders" | "Style plays";

export interface Requirement {
  id: PlayId;
  name: string;
  group: PlayGroup;
  /** Where it counts, in words for the report. */
  where: string;
}

export const REQUIRED: readonly Requirement[] = [
  ...HELM_MOVES.map((m): Requirement => ({ id: m, name: helmWord(m), group: "Helm moves", where: "any situation" })),
  ...(["roundShot", "chainShot", "grapeshot", "holdFire", "board"] as const).map((g): Requirement => ({ id: g, name: gunsWord(g), group: "Guns orders", where: "an open fight" })),
  { id: "mortar", name: gunsWord("mortar"), group: "Guns orders", where: "an open fight, a Bombardier" },
  { id: "hotShot", name: gunsWord("hotShot"), group: "Guns orders", where: "an open fight, a Firebrand" },
  { id: "repel", name: gunsWord("repel"), group: "Deck orders", where: "a Grappled situation" },
  { id: "charge", name: gunsWord("charge"), group: "Deck orders", where: "a Grappled situation" },
  { id: "volley", name: gunsWord("volley"), group: "Deck orders", where: "a Grappled situation" },
  { id: "firePots", name: gunsWord("firePots"), group: "Deck orders", where: "a Grappled situation, both ships at Drill 5" },
  { id: "ram", name: "Ram", group: "Style plays", where: "a Rammer's round at Close, Close In clearly best" },
  { id: "boardFromShort", name: "Board from Short", group: "Style plays", where: "a Boarder's round at Short, Board clearly best" },
];

const DECK_ORDERS: readonly GunsOrder[] = ["repel", "charge", "volley", "firePots"];

/** Does this situation show that `id` is clearly best? The one place that says where each play counts. */
export function showsClearly(id: PlayId, row: SituationRow): boolean {
  switch (id) {
    case "ram": return row.me === "rammer" && row.range === "close" && row.clearHelm === "closeIn";
    case "boardFromShort": return row.me === "boarder" && row.range === "short" && row.clearGuns === "board";
    default: break;
  }
  if ((HELM_MOVES as readonly string[]).includes(id)) return row.clearHelm === id;
  const order = id as GunsOrder;
  if (row.clearGuns !== order) return false;
  // A Deck order counts in a Grappled round and a great gun or Board in an open one; Fire Pots only between ships at Drill 5.
  if (DECK_ORDERS.includes(order) ? setting(row) !== "grappled" : setting(row) !== "open") return false;
  if (order === "firePots" && row.drill < B.drill.unlocks.firePots) return false;
  return canTry(situationShip(row.me, row.drill), setting(row), order); // the ship could really give it
}

export interface Coverage extends Requirement {
  /** Situations where it is clearly the best. */
  clear: number;
  examples: string[];
}

export interface SituationVerdict {
  pass: boolean;
  situations: number;
  /** Situations by kind: an open fight, a Grappled one, a Grappled one between ships at Drill 5. */
  kinds: { open: number; grappled: number; drilled: number };
  mattering: number;
  coverage: Coverage[];
  missing: string[];
}

export function judgeSituations(data: SituationData): SituationVerdict {
  const coverage = REQUIRED.map((req): Coverage => {
    const rows = data.rows.filter((r) => showsClearly(req.id, r));
    // The examples with the widest lead are the clearest ones to show.
    const examples = [...rows].sort((a, b) => b.spread - a.spread).slice(0, 3).map(describeSituation);
    return { ...req, clear: rows.length, examples };
  });
  const missing = coverage.filter((c) => c.clear === 0).map((c) => c.name);
  const kinds = {
    open: data.rows.filter((r) => setting(r) === "open").length,
    grappled: data.rows.filter((r) => setting(r) === "grappled" && r.drill === 0).length,
    drilled: data.rows.filter((r) => setting(r) === "grappled" && r.drill > 0).length,
  };
  return { pass: missing.length === 0, situations: data.rows.length, kinds, mattering: data.rows.filter((r) => r.matters).length, coverage, missing };
}
