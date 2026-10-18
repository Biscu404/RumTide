import { describe, expect, it } from "vitest";
import { choosePlan, findRoute, onSurvey, pinnedRoute, standingPlan, startKnowledge, stepSlots, validatePlan } from "./index.ts";
import type { VoyagePlan } from "./index.ts";
import { WEST_BREEZE, season, ship, world, yesRng } from "./testing.ts";

describe("routing (P1.7)", () => {
  it("finds the cheapest known route by estimated Watches", () => {
    const k = startKnowledge(world);
    const r = findRoute(world, k, "gh_harbour", "gh_reefside", "sloop", WEST_BREEZE)!;
    expect(r.waters).toEqual(["gh_harbour", "gh_reefside"]);
    expect(r.estimate).toBe(2);
  });

  it("never routes through hidden or unknown waters", () => {
    const k = startKnowledge(world);
    expect(findRoute(world, k, "gh_reefside", "wr_fog", "sloop", WEST_BREEZE)).toBeNull();
    const c = season([{ id: "a", name: "A", shipName: "G" }]).captains.a!;
    onSurvey(world, c, "gh_reefside", yesRng);
    expect(findRoute(world, c.knowledge, "gh_reefside", "wr_fog", "sloop", WEST_BREEZE)?.waters).toEqual(["gh_reefside", "wr_fog"]);
  });

  it("checks a pinned route", () => {
    const k = startKnowledge(world);
    expect(pinnedRoute(world, k, "gh_harbour", ["gh_lee", "dw_harbour"], "sloop", WEST_BREEZE)?.lanes).toEqual(["ln_gh_lee_harbour", "ln_dw_gh"]);
    expect(pinnedRoute(world, k, "gh_harbour", ["dw_harbour"], "sloop", WEST_BREEZE)).toBeNull(); // no lane there
  });
});

describe("plans (P1.7, GAMEPLAY 3.6)", () => {
  const s = season([{ id: "a", name: "A", shipName: "Gull" }]);
  const captain = s.captains.a!;

  it("allows 3 steps, more with Seamanship rank 4 and Stargazer nodes, up to 6", () => {
    expect(stepSlots(captain)).toBe(3);
    const c = structuredClone(captain);
    c.skills.seamanship = 4;
    c.perks = ["navigator.step", "navigator.step", "navigator.step"];
    expect(stepSlots(c)).toBe(6);
  });

  it("accepts a good plan", () => {
    const plan: VoyagePlan = { steps: [
      { kind: "sail", to: "gh_reefside", stance: "hunt", filter: { kind: "merchants" } },
      { kind: "survey", if: { kind: "watchesAtLeast", n: 2 } },
      { kind: "dock" },
    ] };
    expect(validatePlan(world, captain, plan)).toEqual([]);
  });

  it("explains what is wrong with a bad plan", () => {
    const plan = { steps: [
      { kind: "sail", to: "wr_fog" },
      { kind: "sail", to: "gh_lee", stance: "hunt" },
      { kind: "land", site: "nowhere" },
      { kind: "teleport" },
    ] } as unknown as VoyagePlan;
    const problems = validatePlan(world, captain, plan);
    expect(problems).toContain("plan: 4 steps, this captain may use 3");
    expect(problems).toContain("step 1: you do not know wr_fog");
    expect(problems).toContain("step 2: needs a filter");
    expect(problems).toContain("step 3: unknown site nowhere");
    expect(problems).toContain("step 4: unknown step teleport");
  });

  it("gives standing orders: stay docked, or sail quietly to the nearest Harbour and dock", () => {
    const st = season([{ id: "a", name: "A", shipName: "G" }, { id: "b", name: "B", shipName: "H", water: "dw_shallows" }]);
    expect(standingPlan(world, st.captains.a!, ship(st, "a"), WEST_BREEZE).steps).toEqual([]);
    expect(standingPlan(world, st.captains.b!, ship(st, "b"), WEST_BREEZE).steps).toEqual([
      { kind: "sail", to: "dw_harbour", stance: "quiet" }, { kind: "dock" },
    ]);
  });

  it("prefers fresh orders, then a carried Plan B, then standing orders", () => {
    const c = structuredClone(captain);
    const sh = ship(s, "a");
    const fresh: VoyagePlan = { steps: [{ kind: "survey" }] };
    const b: VoyagePlan = { steps: [{ kind: "dock" }] };
    c.queuedPlan = { tide: 6, plan: b };
    expect(choosePlan(world, c, sh, 6, { tide: 6, planA: fresh }, WEST_BREEZE).source).toBe("orders");
    expect(choosePlan(world, c, sh, 6, { tide: 5, planA: fresh }, WEST_BREEZE)).toEqual({ plan: b, source: "planB" });
    c.queuedPlan = null;
    expect(choosePlan(world, c, sh, 6, undefined, WEST_BREEZE).source).toBe("standing");
  });
});
