import { describe, expect, it } from "vitest";
import { SEASON_PRESETS } from "./balance.ts";

const presets = Object.entries(SEASON_PRESETS);

describe("SEASON_PRESETS", () => {
  it.each(presets)("%s: galleon Tides are ascending and inside the season", (_, p) => {
    expect([...p.galleonTides].sort((a, b) => a - b)).toEqual(p.galleonTides);
    expect(new Set(p.galleonTides).size).toBe(p.galleonTides.length);
    for (const tide of p.galleonTides) {
      expect(tide).toBeGreaterThanOrEqual(1);
      expect(tide).toBeLessThanOrEqual(p.lengthTides);
    }
  });

  it.each(presets)("%s: the starting sloop is always enabled", (_, p) => {
    expect(p.hullsEnabled).toContain("sloop");
  });

  it.each(presets)("%s: progression costs stay positive", (_, p) => {
    expect(p.progressionCostMult).toBeGreaterThan(0);
  });

  // The Season 0 scope from section 16.1. If this changes on purpose, update 16.1 and DECISIONS.md.
  it("season0 keeps the beta scope", () => {
    const s = SEASON_PRESETS.season0;
    expect(s.lengthTides).toBe(14);
    expect(s.hullsEnabled).toEqual(["sloop", "brigantine"]);
    expect(s.galleonTides).toEqual([7, 14]);
    expect(s.mawOpens).toBe(false);
  });
});
