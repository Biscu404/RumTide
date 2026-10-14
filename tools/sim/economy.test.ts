import { describe, expect, it } from "vitest";
import { B } from "@engine/balance.ts";
import { newShip } from "@engine/state.ts";
import { CAREFUL, CASUAL, economyProblems, runFullSeason, runSeason0, summarise } from "./economy.ts";
import { galleonProblems, runGalleon } from "./galleon.ts";
import { runTrader, seasonSettings, totalLevels } from "./trader.ts";

describe("the bot trader", () => {
  const run = runTrader(CAREFUL, 3);

  it("plays all 14 Tides of Season 0 and reports each one", () => {
    expect(run.tides.map((t) => t.tide)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it("is the same for the same seed", () => {
    expect(runTrader(CAREFUL, 3)).toEqual(run);
  });

  it("never has negative gold, income or levels, and ends richer and stronger than it started", () => {
    for (const t of run.tides) {
      expect(t.chest).toBeGreaterThanOrEqual(0);
      expect(t.income).toBeGreaterThanOrEqual(0);
    }
    expect(run.tides.at(-1)!.levels).toBeGreaterThan(run.tides[0]!.levels);
    expect(run.tides.at(-1)!.pr).toBeGreaterThan(10);
    expect(run.tides.reduce((t, r) => t + r.income, 0)).toBeGreaterThan(B.startGold);
  });

  it("buys the Brigantine in Season 0 but never the Frigate", () => {
    expect(run.brigantineTide).not.toBeNull();
    expect(run.tides.every((t) => t.hull !== "frigate")).toBe(true);
    const full = runTrader(CAREFUL, 3, seasonSettings("full"));
    expect(full.tides).toHaveLength(28);
    expect(full.tides.some((t) => t.hull === "frigate")).toBe(true);
  });

  it("keeps trading when sailing to ports across the whole map", () => {
    const odd = runTrader({ ...CAREFUL, startPort: "last_lantern" }, 1);
    expect(odd.tides.reduce((t, r) => t + r.income, 0)).toBeGreaterThan(0);
  });

  it("adds up the levels of all five stats", () => {
    const ship = newShip("x", "port_regal");
    expect(totalLevels({ ...ship, levels: { hull: 1, cannons: 2, sails: 3, crew: 4, hold: 5 } })).toBe(15);
  });
});

describe("section 3.5 and 5.5 pacing", () => {
  const season0 = runSeason0();
  const full = runFullSeason();

  it("has the documented trader earn between the casual and the careful bot", () => {
    expect(economyProblems(season0, full)).toEqual([]);
    expect(season0.casual.earned).toBeLessThan(season0.careful.earned);
  }, 30_000);

  it("shows the careful bot reaching the Brigantine before the casual one", () => {
    expect(season0.careful.brigantineTide!).toBeLessThan(season0.casual.brigantineTide!);
  });

  it("summarises a single run as itself", () => {
    const one = runTrader(CASUAL, 0);
    const s = summarise(CASUAL, [one]);
    expect(s.earned).toBe(one.tides.reduce((t, r) => t + r.income, 0));
    expect(s.income).toEqual(one.tides.map((t) => t.income));
  });
});

describe("section 8.2 galleon", () => {
  it("never lets a lone ship win and lets careless pairs win roughly a quarter of the time", () => {
    const rows = runGalleon(1500);
    expect(galleonProblems(rows)).toEqual([]);
  });
});
