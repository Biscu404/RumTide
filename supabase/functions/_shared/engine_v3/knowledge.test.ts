import { describe, expect, it } from "vitest";
import {
  LEVEL, coverage, islandFullyCharted, levelOf, onArrive, onLand, onSurvey, raise, startKnowledge,
} from "./index.ts";
import { noRng, season, world, yesRng } from "./testing.ts";

const captain = () => season([{ id: "a", name: "A", shipName: "Gull" }]).captains.a!;

describe("start knowledge (P1.4, GAMEPLAY 2.4)", () => {
  it("knows Gullhaven and Driftwood Key, sketches Tarpot, and nothing else", () => {
    const k = startKnowledge(world);
    expect(levelOf(k, "gh_harbour")).toBe(LEVEL.charted);
    expect(levelOf(k, "dw_shallows")).toBe(LEVEL.charted);
    expect(levelOf(k, "tp_kelp")).toBe(LEVEL.sketched);
    expect(levelOf(k, "ln_tp_kelp_dw")).toBe(LEVEL.sketched);
    expect(levelOf(k, "whisper_rock")).toBe(LEVEL.unknown);
    expect(levelOf(k, "wr_fog")).toBe(LEVEL.unknown);
    expect(levelOf(k, "ln_gh_reefside_wr_fog")).toBe(LEVEL.unknown);
    expect(k.visited).toEqual(["cradle"]);
  });

  it("counts coverage as Charted points plus half of Sketched points", () => {
    // Charted: 5 waters + 6 lanes (3 points) + 2 sites = 10. Sketched: 3 waters + 4 lanes (2) + 2 sites = 7, half is 3.5.
    expect(coverage(world, startKnowledge(world))).toBeCloseTo(13.5 / 30, 6);
  });
});

describe("charting (P1.4, GAMEPLAY 4.3)", () => {
  it("charts the water you arrive in and the lane you came along, and sketches what you can see", () => {
    const c = captain();
    const charted = onArrive(world, c, "tp_kelp", "ln_tp_kelp_dw");
    expect(charted).toEqual(["ln_tp_kelp_dw", "tp_kelp"]);
    expect(levelOf(c.knowledge, "ln_tp_harbour_kelp")).toBe(LEVEL.sketched); // seen, current unknown
  });

  it("never reveals a hidden lane just by sailing past it", () => {
    const c = captain();
    onArrive(world, c, "gh_reefside", null);
    expect(levelOf(c.knowledge, "ln_gh_reefside_wr_fog")).toBe(LEVEL.unknown);
    expect(levelOf(c.knowledge, "wr_fog")).toBe(LEVEL.unknown);
  });

  it("lets a Survey chart every visible lane and sketch the island's sites", () => {
    const c = captain();
    const r = onSurvey(world, c, "tp_kelp", noRng);
    expect(r.charted).toEqual(["ln_tp_harbour_kelp", "ln_tp_kelp_dw", "tp_kelp"]);
    expect(levelOf(c.knowledge, "tarpot_tar_pits")).toBe(LEVEL.sketched);
    expect(r.revealed).toEqual([]);
  });

  it("can reveal a hidden passage on a lucky Survey, making the far island Rumoured", () => {
    const c = captain();
    const r = onSurvey(world, c, "gh_reefside", yesRng);
    expect(r.revealed).toEqual(["ln_gh_reefside_wr_fog"]);
    expect(levelOf(c.knowledge, "wr_fog")).toBe(LEVEL.sketched);
    expect(levelOf(c.knowledge, "whisper_rock")).toBe(LEVEL.rumoured);
    expect(onSurvey(world, c, "gh_reefside", yesRng).revealed).toEqual([]); // nothing left to find there
  });

  it("does not roll for hidden passages where there are none", () => {
    let rolled = false;
    const spy = { chance: () => { rolled = true; return true; }, pick: <T>(xs: readonly T[]) => xs[0] as T } as never;
    onSurvey(world, captain(), "gh_harbour", spy);
    expect(rolled).toBe(false);
  });

  it("unlocks the way to Hermit's Reach from the Whispering Ruins", () => {
    const c = captain();
    expect(onLand(world, c, "whisper_ruins")).toEqual({ charted: ["whisper_ruins"], unlocked: ["narrows_clue"] });
    expect(levelOf(c.knowledge, "ln_wr_rocks_hr")).toBe(LEVEL.sketched);
    expect(levelOf(c.knowledge, "ln_dw_shallows_hr")).toBe(LEVEL.sketched);
    expect(levelOf(c.knowledge, "hermits_reach")).toBe(LEVEL.rumoured);
    expect(levelOf(c.knowledge, "hr_shallows")).toBe(LEVEL.rumoured);
    expect(onLand(world, c, "whisper_ruins").unlocked).toEqual([]); // only once
  });

  it("applies captain Seamanship: rank 1 sees the currents around you", () => {
    const c = captain();
    c.skills.seamanship = 1;
    const charted = onArrive(world, c, "tp_kelp", null);
    expect(charted).toContain("ln_tp_harbour_kelp");
    expect(charted).toContain("ln_tp_kelp_dw");
  });

  it("knows when an island is fully charted, hidden lanes included", () => {
    const c = captain();
    expect(islandFullyCharted(world, c.knowledge, "driftwood_key")).toBe(false);
    for (const id of [...world.watersOf.driftwood_key!, ...world.lanesOf.driftwood_key!, ...world.sitesOf.driftwood_key!]) {
      raise(c.knowledge, id, LEVEL.charted);
    }
    expect(islandFullyCharted(world, c.knowledge, "driftwood_key")).toBe(true);
  });

  it("reaches 100% coverage when everything is Charted", () => {
    const c = captain();
    for (const id of [...world.waterIds, ...world.laneIds, ...world.siteIds]) raise(c.knowledge, id, LEVEL.charted);
    expect(coverage(world, c.knowledge)).toBe(1);
  });
});
