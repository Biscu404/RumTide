// Section 8.2 rule 4: "a lone ship never wins; two ships that play against the galleon's printed habit
// win 75 to 87% of the time, but only 22 to 32% with careless plans; three ships win 99% with good
// reads and about 80% without." Run on the real engine with the real NPC.

import { B, npcPR } from "@engine/balance.ts";
import { resolveBattle } from "@engine/combat.ts";
import { npcCombatant } from "@engine/npc.ts";
import { createRng } from "@engine/rng.ts";
import type { Maneuver, Npc } from "@engine/types.ts";
import { randomPlan, scaledShip } from "./combat.ts";

/** What beats broadside, board, broadside: outmaneuver, broadside, outmaneuver. */
export const GALLEON_COUNTER: readonly Maneuver[] = ["outmaneuver", "broadside", "outmaneuver"];

export interface GalleonRow {
  ships: number;
  plans: "counter" | "random";
  battles: number;
  /** Shares of all battles, 0 to 1. */
  decisive: number;
  victory: number;
  /** Decisive or Victory. */
  win: number;
}

/**
 * `ships` sloops at the median Power Rating `medianPR` fight the galleon. "counter" plays the
 * galleon's printed habit; "random" picks three maneuvers at random.
 */
export function simulateGalleon(ships: number, plans: GalleonRow["plans"], battles: number, seed: number, medianPR = 12): GalleonRow {
  const rng = createRng(seed);
  const galleon: Npc = {
    id: "galleon", seasonId: "sim", kind: "galleon", nodeId: "sea01", pr: npcPR("galleon", medianPR),
    habit: [...B.npc.galleon.plan], cargoUnits: 0, spawnedTide: 7, status: "active",
  };
  let decisive = 0, victory = 0;
  for (let i = 0; i < battles; i++) {
    const side = Array.from({ length: ships }, (_, k) =>
      scaledShip(`c${k}`, medianPR / 10, plans === "counter" ? GALLEON_COUNTER : randomPlan(rng)));
    const result = resolveBattle([side, [npcCombatant(galleon, rng)]], rng);
    if (result.winner === 0) { if (result.outcome === "decisive") decisive++; else victory++; }
  }
  return { ships, plans, battles, decisive: decisive / battles, victory: victory / battles, win: (decisive + victory) / battles };
}

export interface GalleonReport extends GalleonRow {
  /** What section 8.2 says for this row. */
  doc: string;
}

export function runGalleon(battles = 5000): GalleonReport[] {
  const docs: Record<string, string> = {
    "1 counter": "never wins", "1 random": "never wins",
    "2 counter": "75 to 87%", "2 random": "22 to 32%",
    "3 counter": "99%", "3 random": "about 80%",
  };
  const out: GalleonReport[] = [];
  for (const ships of [1, 2, 3]) {
    for (const plans of ["counter", "random"] as const) {
      out.push({ ...simulateGalleon(ships, plans, battles, 7), doc: docs[`${ships} ${plans}`]! });
    }
  }
  return out;
}

/**
 * Hard checks: a lone ship never wins, and careless pairs land in the documented range. "counter" is
 * a perfect read of the habit, so it is only expected to do at least as well as the documented 'good reads'.
 */
export function galleonProblems(rows: readonly GalleonReport[]): string[] {
  const problems: string[] = [];
  const row = (ships: number, plans: GalleonRow["plans"]) => rows.find((r) => r.ships === ships && r.plans === plans)!;
  for (const plans of ["counter", "random"] as const) {
    if (row(1, plans).win > 0) problems.push(`A lone ship beat the galleon with ${plans} plans`);
  }
  const careless2 = row(2, "random").win;
  if (careless2 < 0.19 || careless2 > 0.35) problems.push(`Two careless ships win ${(careless2 * 100).toFixed(1)}%, doc says 22 to 32%`);
  if (row(2, "counter").win < 0.75) problems.push("Two ships with perfect reads win less than the documented 75%");
  if (row(3, "counter").win < 0.95) problems.push("Three ships with perfect reads win less than 95%");
  return problems;
}
