import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, SEASON_PRESETS } from "./balance.ts";
import { loadMap } from "./map.ts";
import { median, seasonSettings, startSeason } from "./season.ts";

const map = loadMap(brineJson);
const six = ["ann", "bob", "cat", "dan", "eve", "fay"].map((id) => ({ id }));

describe("seasonSettings", () => {
  it("copies a preset without sharing its lists", () => {
    const s = seasonSettings("season0");
    expect(s).toMatchObject({ preset: "season0", progressionCostMult: 0.67, mawOpens: false });
    s.galleonTides.push(99);
    expect(SEASON_PRESETS.season0.galleonTides).toEqual([7, 14]);
  });
});

describe("startSeason", () => {
  it("gives six captains a fresh docked sloop each in a different port", () => {
    const snap = startSeason(map, "s0", "season0", six, 1);
    expect(snap.tide).toBe(1);
    expect(snap.lengthTides).toBe(14);
    expect(snap.captains.map((c) => c.id)).toEqual(["ann", "bob", "cat", "dan", "eve", "fay"]);
    expect(snap.captains.every((c) => c.chestGold === B.startGold)).toBe(true);
    expect(snap.ships.every((s) => s.docked && s.hull === "sloop" && map.node(s.nodeId).type === "port")).toBe(true);
    expect(new Set(snap.ships.map((s) => s.nodeId)).size).toBe(6);
  });

  it("opens with merchants on the map and prices at normal, and no Trade Winds in week 1", () => {
    const snap = startSeason(map, "s0", "season0", six, 1);
    expect(snap.npcs.length).toBeGreaterThanOrEqual(4);
    expect(snap.npcs.every((n) => n.spawnedTide === 1 && n.status === "active")).toBe(true);
    expect(snap.market.every((r) => r.drift === 1)).toBe(true);
    expect(snap.boomPortId).toBeNull();
  });

  it("is the same for the same seed, whatever order the captains are listed in", () => {
    const a = startSeason(map, "s0", "season0", six, 5);
    expect(startSeason(map, "s0", "season0", [...six].reverse(), 5)).toEqual(a);
    expect(startSeason(map, "s0", "season0", six, 6).npcs).not.toEqual(a.npcs);
  });

  it("carries a captain's fleet and rejects duplicate ids", () => {
    const snap = startSeason(map, "s0", "season0", [{ id: "ann", fleetId: "f1" }, { id: "bob" }], 1);
    expect(snap.captains.map((c) => c.fleetId)).toEqual(["f1", null]);
    expect(() => startSeason(map, "s0", "season0", [{ id: "ann" }, { id: "ann" }], 1)).toThrow(/unique/);
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
