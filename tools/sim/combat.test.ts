import { describe, expect, it } from "vitest";
import { B } from "@engine/balance.ts";
import { createRng } from "@engine/rng.ts";
import { randomPlan, scaledShip, simulateGang, simulateRatio } from "./combat.ts";
import { runSection73, section73Problems } from "./section73.ts";

describe("section 7.3", () => {
  it("is reproduced by the real engine", () => {
    expect(section73Problems(runSection73())).toEqual([]);
  });

  it("gives the same rows for the same seed", () => {
    expect(simulateRatio(1.5, 500, 4)).toEqual(simulateRatio(1.5, 500, 4));
  });

  it("splits every battle into stronger wins, weaker wins and draws", () => {
    const row = simulateRatio(1.25, 800, 2);
    expect(row.strongerWins + row.weakerWins + row.draws).toBeCloseTo(1, 10);
    expect(row.decisive).toBeLessThanOrEqual(row.strongerWins + row.weakerWins + row.draws);
  });
});

describe("simulation helpers", () => {
  it("builds a sloop scaled by the ratio, with PR scaled too", () => {
    const fresh = scaledShip("a", 1, ["board", "board", "board"]);
    const twice = scaledShip("b", 2, ["board", "board", "board"]);
    expect(fresh.pr).toBeCloseTo(10, 10);
    expect(twice.pr).toBeCloseTo(20, 10);
    expect(twice.maxHull).toBe(2 * B.baseHull);
  });

  it("picks plans of the right length from the seed", () => {
    expect(randomPlan(createRng(1))).toHaveLength(B.combat.rounds);
    expect(randomPlan(createRng(1))).toEqual(randomPlan(createRng(1)));
  });

  // Section 9 rule 4 says about 96%. The engine gives 100% (docs/DECISIONS.md, 2026-10-14, day 3),
  // so this only guards "nearly always" until that mismatch is settled.
  it("lets three equal ships beat one nearly always", () => {
    expect(simulateGang(3, 300, 1)).toBeGreaterThan(0.9);
  });
});
