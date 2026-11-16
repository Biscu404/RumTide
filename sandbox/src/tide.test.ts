import { describe, expect, it } from "vitest";
import { B, replayHash, validatePlan } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { ReplayEvent, Step, VoyagePlan } from "../../supabase/functions/_shared/engine_v3/index.ts";
import {
  BOTS, LAST_WATCH, TIDE, YOU, YOUR_SHIP, estimatePlan, involves, newTide, planProblems, runTide, spotsAt, watchOf, watchesAllowed, world,
  yourShip,
} from "./tideSetup.ts";
import { battleWords, estimateWords, eventWords, newlyCharted, othersWords, stepWords, summaryRows, windWords } from "./tideWords.ts";

const HUNT: VoyagePlan = { steps: [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" } }, { kind: "dock" }] };
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

describe("sandbox Tide: the sea", () => {
  it("builds the same sea for the same style and seed, with you docked in Gullhaven and four bots", () => {
    const a = newTide("gunline", 7), b = newTide("gunline", 7);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.state.tide).toBe(TIDE);
    expect(Object.keys(a.state.ships)).toHaveLength(BOTS.length + 1);
    expect(yourShip(a.state)).toMatchObject({ waterId: "gh_harbour", docked: true, style: "gunline" });
    expect(a.state.captains.old_shellback).toBeUndefined();
  });

  it("gives every bot a plan the engine accepts, and different seeds pick different ones", () => {
    const setup = newTide("boarder", 1);
    for (const bot of BOTS) {
      for (const plan of bot.plans) expect(validatePlan(world, setup.state.captains[bot.spec.id]!, plan)).toEqual([]);
    }
    const picks = new Set(SEEDS.map((seed) => JSON.stringify(newTide("boarder", seed).botOrders)));
    expect(picks.size).toBeGreaterThan(3);
  });

  it("runs the same Tide twice from one setup and leaves the setup alone", () => {
    const setup = newTide("rammer", 11);
    const frozen = JSON.stringify(setup);
    const a = runTide(setup, HUNT), b = runTide(setup, HUNT);
    expect(replayHash(a.replay)).toBe(replayHash(b.replay));
    expect(JSON.stringify(setup)).toBe(frozen);
    expect(a.state.tide).toBe(TIDE + 1);
    expect(a.replay.some((e) => e.kind === "plan" && e.ship === YOUR_SHIP && e.source === "orders")).toBe(true);
  });

  it("fights real battles somewhere in thirty seas", () => {
    const battles = SEEDS.flatMap((seed) => runTide(newTide("gunline", seed), HUNT).replay.filter((e) => e.kind === "battle"));
    expect(battles.length).toBeGreaterThan(0);
  });
});

describe("sandbox Tide: the planner's estimate", () => {
  const setup = newTide("gunline", 3);
  const total = watchesAllowed(setup);

  it("counts a voyage hop by hop and matches what the Tide then charges in Charted water", () => {
    const plan: VoyagePlan = { steps: [{ kind: "sail", to: "dw_harbour", stance: "quiet" }, { kind: "dock" }] };
    const est = estimatePlan(setup, plan);
    expect(est.steps[0]).toMatchObject({ problem: null, guess: false, path: ["gh_harbour", "gh_lee", "dw_harbour"] });
    expect(est.endsAt).toBe("dw_harbour");
    const hops = runTide(setup, plan).replay.filter((e): e is Extract<ReplayEvent, { kind: "hop" }> => e.kind === "hop" && e.ship === YOUR_SHIP);
    if (hops.length === 2) expect(est.steps[0]!.watches).toBe(hops[0]!.cost + hops[1]!.cost); // unless a hunter stopped you on the way
    expect(est.steps[1]).toMatchObject({ watches: B.actions.dock, problem: null });
    expect(est.used).toBe(est.steps[0]!.watches + B.actions.dock);
  });

  it("says why a step will not happen", () => {
    const steps: Step[] = [{ kind: "dock" }, { kind: "repair" }, { kind: "land", site: "driftwood_wreck" }, { kind: "sail", to: "gh_harbour" }];
    expect(estimatePlan(setup, { steps }).steps.map((s) => s.problem)).toEqual(["alreadyThere", "nothingToRepair", "siteNotHere", "alreadyThere"]);
    expect(estimatePlan(setup, { steps: [{ kind: "sail", to: "gh_lee" }, { kind: "dock" }] }).steps[1]!.problem).toBe("notAHarbour");
    expect(estimatePlan(setup, { steps: [{ kind: "sail", to: "wr_fog" }] }).steps[0]!.problem).toBe("noKnownRoute");
  });

  it("lets lying in wait take every Watch that is left, so nothing after it is reached", () => {
    const est = estimatePlan(setup, { steps: [{ kind: "survey" }, { kind: "lurk", filter: { kind: "anyone" } }, { kind: "dock" }] });
    expect(est.steps.map((s) => s.watches)).toEqual([B.actions.survey, total - B.actions.survey, 0]);
    expect(est.steps[2]!.problem).toBe("notReached");
    expect(est.used).toBe(total);
  });

  it("stops a voyage where the Watches run out and marks a sketch as a guess", () => {
    const far = estimatePlan(setup, { steps: [{ kind: "sail", to: "dw_shallows" }, { kind: "sail", to: "tp_harbour" }] });
    expect(far.steps[1]).toMatchObject({ problem: "outOfWatches" });
    expect(far.steps[1]!.stopsAt).not.toBeNull();
    expect(far.used).toBeLessThanOrEqual(total);
    expect(estimatePlan(setup, { steps: [{ kind: "sail", to: "tp_channel" }] }).steps[0]!.guess).toBe(true);
  });

  it("agrees with the engine about which plans are allowed", () => {
    expect(planProblems(setup, HUNT)).toEqual([]);
    expect(planProblems(setup, { steps: [{ kind: "survey" }, { kind: "survey" }, { kind: "survey" }, { kind: "survey" }] })).toHaveLength(1);
  });
});

describe("sandbox Tide: reading the replay", () => {
  it("starts every ship where the sea had it and ends it where the Tide left it", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const setup = newTide("skirmisher", seed);
      const result = runTide(setup, HUNT);
      for (const id of Object.keys(setup.state.ships)) {
        expect(spotsAt(setup.state, result, 0)[id]!.water).toBe(setup.state.ships[id]!.waterId);
        expect(spotsAt(setup.state, result, LAST_WATCH)[id]!.water).toBe(result.state.ships[id]!.waterId);
      }
    }
  });

  it("puts a ship part way along a lane while it sails, and in the new water once it arrives", () => {
    const setup = newTide("gunline", 3);
    const result = runTide(setup, { steps: [] }); // you stay docked, so nobody can stop a bot by fighting you
    const hop = result.replay.find((e): e is Extract<ReplayEvent, { kind: "hop" }> =>
      e.kind === "hop" && e.ends - e.t >= 2 && result.replay.some((a) => a.kind === "arrive" && a.ship === e.ship && a.t === e.ends));
    expect(hop).toBeDefined();
    const mid = spotsAt(setup.state, result, hop!.t + 1)[hop!.ship]!;
    const from = world.water[hop!.from]!, to = world.water[hop!.to]!;
    expect(mid.water).toBeNull();
    expect(mid.x).toBeCloseTo(from.x + (to.x - from.x) / (hop!.ends - hop!.t));
    expect(spotsAt(setup.state, result, hop!.ends)[hop!.ship]!.water).toBe(hop!.to);
  });

  it("knows which events are about your ship", () => {
    const setup = newTide("gunline", 3);
    const result = runTide(setup, HUNT);
    const mine = result.replay.filter((e) => involves(e, YOUR_SHIP, YOU));
    expect(mine.some((e) => e.kind === "hop")).toBe(true);
    expect(mine.every((e) => !("ship" in e) || e.ship === YOUR_SHIP)).toBe(true);
    expect(result.replay.every((e) => watchOf(e) >= 0 && watchOf(e) <= LAST_WATCH)).toBe(true);
  });
});

describe("sandbox Tide: the words", () => {
  it("has a plain line for every event of thirty Tides, and a card for every battle", () => {
    let battles = 0;
    for (const seed of SEEDS) {
      const setup = newTide(seed % 2 ? "boarder" : "firebrand", seed);
      const result = runTide(setup, HUNT);
      for (const e of result.replay) {
        if (e.kind === "battle") {
          const card = battleWords(e, setup.state);
          battles += 1;
          expect(card.rounds).toHaveLength(e.record.rounds.length);
          expect(card.after.length).toBeGreaterThan(0);
          expect(`${card.title} ${card.start} ${card.ending.why} ${card.after.join(" ")}`).not.toMatch(/undefined|ship_|cap_|NaN/);
        } else {
          const line = eventWords(e, setup.state);
          expect(line).toBeTruthy();
          expect(line).not.toMatch(/undefined|ship_|cap_|ln_|NaN/);
        }
      }
      expect(summaryRows(setup.state, result)).toHaveLength(10);
      expect(othersWords(result)).toHaveLength(BOTS.length);
    }
    expect(battles).toBeGreaterThan(0);
  });

  it("says a step and its cost in normal words", () => {
    const setup = newTide("gunline", 3);
    const steps: Step[] = [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "merchants" } }, { kind: "dock" }];
    const est = estimatePlan(setup, { steps });
    expect(stepWords(steps[0]!)).toBe("Sail to Driftwood Harbour, hunting merchants");
    expect(estimateWords(steps[0]!, est.steps[0]!)).toMatch(/^About \d Watch(es)?, by way of Gullhaven Lee\.$/);
    expect(estimateWords(steps[1]!, est.steps[1]!)).toBe("About 1 Watch.");
    expect(windWords({ kind: "breeze", from: 270 })).toBe("a Breeze from the west");
    expect(windWords({ kind: "calm", from: 0 })).toBe("calm, no wind at all");
  });

  it("lists what a survey newly Charted", () => {
    const setup = newTide("gunline", 3);
    const result = runTide(setup, { steps: [{ kind: "sail", to: "tp_channel", stance: "quiet" }] });
    if (result.state.ships[YOUR_SHIP]!.waterId === "tp_channel") expect(newlyCharted(setup.state, result)).toContain("Tarpot Channel");
    expect(newlyCharted(setup.state, runTide(setup, { steps: [] }))).toEqual([]);
  });
});
