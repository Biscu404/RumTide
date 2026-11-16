// The Old Shellback sweep (P3.2b): the space it searches, its scoring, and the patch a boss job can carry.

import { describe, expect, it } from "vitest";
import { B, Rng, styleTemplate, templateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { BOSS_TIDE } from "./boss.ts";
import { runBoss } from "./jobs.ts";
import type { BossJob } from "./jobs.ts";
import { AIM_HIGH, AIM_LOW, GRID, GRID_KEYS, baseline, changesOf, complete, keyOf, neighbours, randomCombination, rank, scoreOf, steps } from "./sweepSpace.ts";

describe("the sweep space", () => {
  it("has the numbers of balance.ts on every grid, so the game as it is can be scored and stepped away from", () => {
    const now = baseline();
    for (const key of GRID_KEYS) expect(GRID[key], key).toContain(now[key]);
  });

  it("makes steps without floating point noise", () => {
    expect(steps(0.1, 0.3, 0.025)).toEqual([0.1, 0.125, 0.15, 0.175, 0.2, 0.225, 0.25, 0.275, 0.3]);
    expect(steps(40, 44, 2)).toEqual([40, 42, 44]);
  });

  it("draws the same combinations from the same seed, all on the grid", () => {
    const a = new Rng("test/sweep");
    const b = new Rng("test/sweep");
    for (let i = 0; i < 20; i++) {
      const combination = randomCombination(a);
      expect(combination).toEqual(randomCombination(b));
      for (const key of GRID_KEYS) expect(GRID[key], key).toContain(combination[key]);
    }
  });

  it("steps one number at a time and stops at the ends of a grid", () => {
    const around = neighbours(baseline());
    expect(around).toHaveLength(2 * GRID_KEYS.length);
    for (const n of around) expect(Object.keys(changesOf(n))).toHaveLength(1);
    const low = complete({ "shellback.hull": GRID["shellback.hull"]![0]! });
    expect(neighbours(low).filter((n) => n["shellback.hull"] !== low["shellback.hull"])).toHaveLength(1);
  });

  it("gives one key to a combination however it is written, and reports only what differs from balance.ts", () => {
    expect(keyOf({ b: 2, a: 1 })).toBe(keyOf({ a: 1, b: 2 }));
    expect(changesOf(complete({ "shellback.cannons": 30 }))).toEqual({ "shellback.cannons": 30 });
    expect(changesOf(baseline())).toEqual({});
  });

  it("scores a combination by how far its styles are outside the aim", () => {
    expect(scoreOf([AIM_LOW, 0.5, AIM_HIGH]).loss).toBe(0);
    expect(scoreOf([1, 0.5]).loss).toBeCloseTo(1 - AIM_HIGH);
    expect(scoreOf([0, 0.5]).loss).toBeCloseTo(AIM_LOW);
    expect(rank(scoreOf([0.57, 0.57]))).toBeLessThan(rank(scoreOf([0.45, 0.7])));
    expect(rank(scoreOf([0.45, 0.7]))).toBeLessThan(rank(scoreOf([0.45, 0.9])));
  });
});

describe("a boss job with a patch", () => {
  const job = (patch?: BossJob["patch"]): BossJob => ({
    doctrine: templateDoctrine(styleTemplate("boarder")), ship: { style: "boarder" }, tide: BOSS_TIDE, label: "test/sweep/patch", from: 0, count: 12,
    ...(patch ? { patch } : {}),
  });

  it("fights with the patched numbers and puts balance.ts back", () => {
    const claws = B.shellback.clawHands;
    const plain = runBoss(job());
    const weak = runBoss(job({ "shellback.clawHands": 4, "shellback.hull": 30 }));
    expect(B.shellback.clawHands).toBe(claws);
    expect(weak.beaten).toBe(12);
    expect(runBoss(job())).toEqual(plain);
    expect(runBoss(job({}))).toEqual(plain);
  });

  it("puts the numbers back when a path is wrong", () => {
    const claws = B.shellback.clawHands;
    expect(() => runBoss(job({ "shellback.clawHands": 4, "shellback.nothing": 1 }))).toThrow();
    expect(B.shellback.clawHands).toBe(claws);
  });
});
