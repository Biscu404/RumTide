import { describe, expect, it } from "vitest";
import { MapError, angleBetween, bearingBetween, laneBetween, loadMap, travelBearing, validateMap } from "./index.ts";
import { rawCradle, world } from "./testing.ts";

describe("the Cradle map (P1.3)", () => {
  it("validates", () => {
    expect(validateMap(rawCradle())).toEqual([]);
  });

  it("has the shape GAMEPLAY 2.4 describes", () => {
    expect(world.islandIds).toHaveLength(5);
    expect(world.waterIds).toHaveLength(12);
    expect(world.laneIds).toHaveLength(16);
    expect(world.siteIds).toHaveLength(10);
    expect(world.map.islands.filter((i) => i.hidden).map((i) => i.id).sort()).toEqual(["hermits_reach", "whisper_rock"]);
    expect(world.map.straits.map((s) => s.from)).toEqual(["the_narrows", "the_narrows"]);
    expect(world.map.bosses[0]?.id).toBe("old_shellback");
  });

  it("derives bearings from positions", () => {
    expect(world.bearingAB.ln_dw_gh).toBe(90); // Driftwood Harbour to Gullhaven Lee runs east
    expect(travelBearing(world, "ln_dw_gh", "gh_lee")).toBe(270);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 0, y: -5 })).toBe(0);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(135);
    expect(angleBetween(350, 10)).toBe(20);
    expect(angleBetween(90, 270)).toBe(180);
  });

  it("indexes lanes and waters", () => {
    expect(laneBetween(world, "gh_lee", "dw_harbour")?.id).toBe("ln_dw_gh");
    expect(laneBetween(world, "gh_lee", "the_narrows")).toBeUndefined();
    expect(world.watersOf.gullhaven).toEqual(["gh_harbour", "gh_lee", "gh_reefside"]);
    expect(world.archOf.the_narrows).toBe("cradle");
    expect(world.totalPoints).toBe(12 + 16 * 0.5 + 10);
  });

  it("rejects broken maps with clear problems", () => {
    const m = rawCradle();
    m.islands.find((i) => i.id === "whisper_rock")!.tier = "village"; // a settlement without a Harbour
    m.lanes.find((l) => l.id === "ln_gh_reefside_wr_fog")!.hidden = undefined; // a visible lane into a hidden island
    m.lanes.push({ id: "ln_bad", a: "gh_lee", b: "nowhere", current: { strength: "none" } });
    const problems = validateMap(m);
    expect(problems.some((p) => p.includes("needs exactly one Harbour"))).toBe(true);
    expect(problems.some((p) => p.includes("must be hidden"))).toBe(true);
    expect(problems.some((p) => p.includes("ln_bad"))).toBe(true);
    expect(() => loadMap(m)).toThrow(MapError);
  });

  it("rejects duplicate ids and currents without a flow", () => {
    const m = rawCradle();
    m.sites.push({ id: "gh_lee", island: "gullhaven", name: "Twin", kind: "ruins" });
    m.lanes[0]!.current = { strength: "mild" };
    const problems = validateMap(m);
    expect(problems.some((p) => p.includes('id "gh_lee"'))).toBe(true);
    expect(problems.some((p) => p.includes("needs a flow"))).toBe(true);
  });
});
