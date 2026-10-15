import { describe, expect, it } from "vitest";
import { awayExperiment } from "./away.ts";
import { apiProblems, brawlProblems, commonProblems, sixCaptainProblems, voyageProblems } from "./checks.ts";
import { playSeasonThroughApi } from "./api_season.ts";
import { brawl, checkState, playSeason, sixCaptains, voyage } from "./season.ts";
import { brine } from "../sim/trader.ts";
import { startSeason } from "@engine/season.ts";

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe("the bot season", () => {
  const six = SEEDS.map((seed) => playSeason(seed, sixCaptains(seed)));
  const fights = SEEDS.map((seed) => playSeason(seed, brawl(seed)));
  const trips = SEEDS.map((seed) => playSeason(seed, voyage(seed)));

  it("plays all 14 Tides with no impossible state, and replays exactly from its seed", () => {
    expect(commonProblems("six captains", six, (seed) => playSeason(seed, sixCaptains(seed)))).toEqual([]);
    expect(commonProblems("brawl", fights, (seed) => playSeason(seed, brawl(seed)))).toEqual([]);
    expect(commonProblems("voyage", trips, (seed) => playSeason(seed, voyage(seed)))).toEqual([]);
  });

  it("draws every exploration event on a voyage, and lets a Hermit's chart lengthen a course", () => {
    expect(voyageProblems(trips)).toEqual([]);
  });

  it("gives sane results for the Season 0 roster", () => {
    expect(sixCaptainProblems(six)).toEqual([]);
  });

  it("fires the PvP rules when everyone hunts", () => {
    expect(brawlProblems(fights)).toEqual([]);
  });

  it("lets a captain who is away for a week store Shore Leave, spend it on coming back, and come to no harm", () => {
    for (const r of six) {
      const bob = r.captains.find((c) => c.id === "bob")!;
      expect(bob.shoreLeavePeak).toBe(3);
      expect(bob.shoreLeaveSpent).toBeGreaterThanOrEqual(1);
      expect(bob.shoreLeave).toBeLessThan(3);   // some of it was paid out
      expect(bob.status).toBe("active");
    }
  });

  it("does not leave a week away worse off than it was before Shore Leave paid out", () => {
    const result = awayExperiment(SEEDS);
    // The doc says about 85% to 93% of an unbroken captain's earnings (sections 3.5 and 5.5). Loose on purpose.
    expect(result.legend).toBeGreaterThan(0.75);
    expect(result.legend).toBeLessThan(1.05);
    expect(result.peak).toBe(3);
  });
});

describe("the bot season through the Edge Function handlers", () => {
  const seeds = SEEDS.slice(0, 6);

  it("plays the Season 0 roster, the brawl and the voyage, ends exactly as the direct season, and posts every Gazette", async () => {
    for (const seed of seeds) {
      for (const [label, roster] of [["six captains", sixCaptains], ["brawl", brawl], ["voyage", voyage]] as const) {
        const api = await playSeasonThroughApi(seed, roster(seed));
        const direct = playSeason(seed, roster(seed));
        expect(apiProblems(label, direct, api)).toEqual([]);
        expect(api.posts).toHaveLength(14);
      }
    }
  });
});

describe("checkState", () => {
  const snap = startSeason(brine, "s", "season0", [{ id: "ann" }], 1);

  it("accepts a fresh season", () => {
    expect(checkState(brine, snap, "fresh")).toEqual([]);
  });

  it("flags the impossible", () => {
    const ship = snap.ships[0]!;
    const broken = {
      ...snap,
      captains: [{ ...snap.captains[0]!, chestGold: -5, legend: Number.NaN }],
      ships: [{ ...ship, hullPoints: 0, cargo: { ...ship.cargo, rum: 99 }, nodeId: "nowhere" }],
    };
    const problems = checkState(brine, broken, "broken").join("\n");
    for (const part of ["unknown node", "hull 0", "Chest -5", "Legend NaN", "carries 99 units"]) expect(problems).toContain(part);
  });
});
