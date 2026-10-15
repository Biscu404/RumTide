import { describe, expect, it } from "vitest";
import { B, SEASON_PRESETS, powerRating, speed } from "./balance.ts";
import { npcCombatant } from "./npc.ts";
import { createRng } from "./rng.ts";
import type { Npc } from "./types.ts";

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

describe("speed", () => {
  it("is the hull speed until Sails level 5", () => {
    expect(speed("sloop", 0)).toBe(2);
    expect(speed("sloop", 4)).toBe(2);
    expect(speed("brigantine", 0)).toBe(2);
    expect(speed("frigate", 0)).toBe(3);
  });

  it("adds one hop at Sails level 5, never above 3", () => {
    expect(speed("sloop", 5)).toBe(3);
    expect(speed("brigantine", 10)).toBe(3);
    expect(speed("frigate", 10)).toBe(3);
  });

  it("never exceeds the movement steps in a Tide", () => {
    expect(speed("frigate", 10)).toBeLessThanOrEqual(B.movement.steps);
  });
});

describe("hullPerPR", () => {
  it("makes a fresh sloop PR 10, as the design says", () => {
    expect(B.baseHull / B.hullPerPR).toBe(B.baseStat);
    expect(powerRating({ hull: B.baseHull, cannons: B.baseStat, sails: B.baseStat, crew: B.baseStat })).toBe(10);
  });

  it("gives an NPC a hull of hullPerPR times its PR", () => {
    const npc = { id: "n1", kind: "smallTrader", pr: 8, habit: ["outmaneuver", "board", "board"] } as unknown as Npc;
    const c = npcCombatant(npc, createRng(1));
    expect(c.hullPoints).toBe(B.hullPerPR * 8);
    expect(c.maxHull).toBe(B.hullPerPR * 8);
  });
});
