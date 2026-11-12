// P3.2c, D225: the gate pace of check 5 follows the engine. Old Shellback fights every captain who reaches him each Tide, and
// the pace of the old one fight a Tide (D108) is printed beside it. D226: the pace across the band of check 5.

import { describe, expect, it } from "vitest";
import { BOSS_HIGH, BOSS_LOW, gatePace } from "./boss.ts";

describe("the gate pace when he fights every captain each Tide (D225)", () => {
  it("is what gatePace measures unless it is told a number of fights", () => {
    expect(gatePace([0.5], 5, 6, 50).fightsPerTide).toBe(6);
    expect(gatePace([0.5], 5, 4, 50).fightsPerTide).toBe(4);
    expect(gatePace([0.5], 5, 6, 50, 1).fightsPerTide).toBe(1);
  });

  it("lets all six pass on the first Tide when every fight is won", () => {
    const g = gatePace([1], 5, 6, 50);
    expect(g.medianTide).toBe(5);
    expect(g.lastTide).toBe(5);
    expect(g.lastByTwelve).toBe(1);
  });

  it("never lets anyone pass when the fight cannot be won", () => {
    expect(gatePace([0], 5, 6, 3).lastByTwelve).toBe(0);
  });

  it("is faster with every fight added, at the same win chance", () => {
    const paces = [1, 2, 3, 6].map((fights) => gatePace([0.5], 5, 6, 600, fights));
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i]!.medianTide).toBeLessThan(paces[i - 1]!.medianTide);
      expect(paces[i]!.lastTide).toBeLessThan(paces[i - 1]!.lastTide);
    }
  });

  it("gives the same answer every time: its rolls are seeded", () => {
    expect(gatePace([0.4, 0.5, 0.6], 5)).toEqual(gatePace([0.4, 0.5, 0.6], 5));
  });
});

describe("the gate pace across the band of check 5 (D226)", () => {
  it("meets the target of GAMEPLAY 2.5 at both ends of the band when he fights everyone", () => {
    for (const chance of [BOSS_LOW, BOSS_HIGH]) {
      const everyone = gatePace([chance], 5);
      expect(everyone.medianTide).toBeLessThanOrEqual(9);
      expect(everyone.lastTide).toBeLessThanOrEqual(12);
      expect(everyone.lastByTwelve).toBeGreaterThan(0.8);
    }
  });

  it("misses it with a queue: at the bottom of the band nearly always, and at the top in one season of five", () => {
    const low = gatePace([BOSS_LOW], 5, 6, 4000, 1);
    expect(low.medianTide).toBeGreaterThan(9);
    expect(low.lastByTwelve).toBeLessThan(0.1);
    const high = gatePace([BOSS_HIGH], 5, 6, 4000, 1);
    expect(high.lastByTwelve).toBeLessThan(0.85);
  });
});
