import { describe, expect, it } from "vitest";
import {
  B, LEVEL, emptyKnowledge, estimateHop, hopCost, raise, setPencil, startKnowledge, terrainPart, windFor, windPart, windsFor,
} from "./index.ts";
import type { Wind } from "./index.ts";
import { world } from "./testing.ts";

const west: Wind = { kind: "breeze", from: 270 };
const calm: Wind = { kind: "calm", from: 0 };

describe("hop costs (P1.6, GAMEPLAY 3.3)", () => {
  it("matches the GAMEPLAY example: 1 Watch east, 3 Watches back west", () => {
    // Driftwood Harbour to Gullhaven Lee: mild current flowing east, breeze from the west.
    expect(hopCost(world, "ln_dw_gh", "dw_harbour", "sloop", west, true).total).toBe(1);
    const back = hopCost(world, "ln_dw_gh", "gh_lee", "sloop", west, true);
    expect(back.total).toBe(3);
    expect(back).toMatchObject({ base: 2, current: 1, wind: 0, terrain: 0 });
  });

  it("charges the upwind penalty to square and mixed rigs but not to sloops", () => {
    expect(hopCost(world, "ln_dw_gh", "gh_lee", "brigantine", west, true).total).toBe(4);
    expect(windPart(west, 270, "sloop")).toBe(0);
    expect(windPart({ kind: "gale", from: 270 }, 270, "sloop")).toBe(1);
    expect(windPart({ kind: "gale", from: 270 }, 270, "frigate")).toBe(2);
  });

  it("gives frigates an extra Watch off downwind, and never goes below 1", () => {
    expect(windPart(west, 90, "frigate")).toBe(-2);
    expect(hopCost(world, "ln_dw_gh", "dw_harbour", "frigate", west, true).total).toBe(B.actions.hopMin);
  });

  it("makes everyone but sloops slower in a calm", () => {
    expect(windPart(calm, 90, "sloop")).toBe(0);
    expect(windPart(calm, 90, "brigantine")).toBe(1);
  });

  it("counts only winds within 45 degrees as up or down", () => {
    expect(windPart(west, 135, "brigantine")).toBe(-1); // 45 degrees off downwind
    expect(windPart(west, 180, "brigantine")).toBe(0); // a crosswind
    expect(windPart(west, 225, "brigantine")).toBe(1); // 45 degrees off upwind
  });

  it("applies terrain when leaving a water", () => {
    const kelp = world.water.tp_kelp!, reef = world.water.gh_reefside!, shallows = world.water.dw_shallows!;
    expect(terrainPart(kelp, "sloop", true)).toBe(1);
    expect(terrainPart(reef, "sloop", false)).toBe(1);
    expect(terrainPart(reef, "sloop", true)).toBe(0); // locals know the reef
    expect(terrainPart(shallows, "frigate", true)).toBe(1);
    expect(terrainPart(shallows, "sloop", true)).toBe(0);
  });

  it("charges 2 against a strong current", () => {
    // The Narrows current pushes north, so sailing south into the Narrows fights it.
    expect(hopCost(world, "ln_hr_shallows_narrows", "hr_shallows", "sloop", calm, true)).toMatchObject({ current: 2, total: 4 });
    expect(hopCost(world, "ln_hr_shallows_narrows", "the_narrows", "sloop", calm, true)).toMatchObject({ current: -1, total: 1 });
  });
});

describe("estimates versus truth (P1.6, GAMEPLAY 3.4)", () => {
  const winds = { cradle: west };

  it("assumes no current on a lane whose current you do not know", () => {
    const k = startKnowledge(world); // the Tarpot lanes are only Sketched
    const est = estimateHop(world, k, "ln_tp_kelp_dw", "tp_kelp", "sloop", winds);
    const truth = hopCost(world, "ln_tp_kelp_dw", "tp_kelp", "sloop", west, false);
    expect(est.estimated).toBe(true);
    expect(est.total).toBe(3); // base 2 + kelp 1
    expect(truth.total).toBe(4); // and the current is against you
  });

  it("uses a pencil mark until the lane is Charted", () => {
    const k = startKnowledge(world);
    setPencil(k, "ln_tp_kelp_dw", { strength: "strong", flow: "ba" });
    expect(estimateHop(world, k, "ln_tp_kelp_dw", "tp_kelp", "sloop", winds).total).toBe(5);
    raise(k, "ln_tp_kelp_dw", LEVEL.charted); // the real current overrides the pencil
    expect(estimateHop(world, k, "ln_tp_kelp_dw", "tp_kelp", "sloop", winds).total).toBe(4);
  });

  it("only counts the wind if you know the forecast", () => {
    const k = startKnowledge(world);
    expect(estimateHop(world, k, "ln_dw_gh", "dw_harbour", "sloop", winds).total).toBe(1);
    const stranger = emptyKnowledge();
    raise(stranger, "dw_harbour", LEVEL.charted);
    raise(stranger, "ln_dw_gh", LEVEL.charted);
    const est = estimateHop(world, stranger, "ln_dw_gh", "dw_harbour", "sloop", winds);
    expect(est.estimated).toBe(true);
    expect(est.total).toBe(1); // still knows the current, not the wind
  });
});

describe("wind (P1.6)", () => {
  it("is the same every time it is asked, so it can be forecast", () => {
    expect(windFor(1234, "cradle", 9)).toEqual(windFor(1234, "cradle", 9));
  });

  it("changes from Tide to Tide and blows from a compass point", () => {
    const winds = Array.from({ length: 40 }, (_, i) => windFor(1234, "cradle", i + 1));
    expect(new Set(winds.map((w) => `${w.kind}${w.from}`)).size).toBeGreaterThan(4);
    for (const w of winds) {
      expect(["calm", "breeze", "gale"]).toContain(w.kind);
      expect(w.from % 45).toBe(0);
      if (w.kind === "calm") expect(w.from).toBe(0);
    }
  });

  it("can be overridden for tests and dev tools", () => {
    expect(windsFor(world, 1, 1, { cradle: calm }).cradle).toEqual(calm);
  });
});
