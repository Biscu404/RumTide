import { describe, expect, it } from "vitest";
import { B } from "@engine/balance.ts";
import { standingOrders, submitOrders } from "../../../supabase/functions/_shared/api/handlers.ts";
import { seasonWorld, type TestWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import { MANEUVERS, PARLEYS } from "./ordersModel.ts";
import {
  shoreLeaveNote, standingChanged, standingDraftFor, standingPayload, standingSentence, type StandingDraft,
} from "./standingModel.ts";

// These run the standing orders form's model against the real handler on the in memory store: what the
// form sends must be accepted, and once it is saved the form must see nothing left to save.

const captainOf = async (w: TestWorld, id: string) => (await w.store.captainView(w.user(id)))!.captain;

describe("Standing orders model", () => {
  it("starts from the captain's saved standing orders and sees nothing to save", async () => {
    const w = await seasonWorld();
    const captain = await captainOf(w, "ann");
    const draft = standingDraftFor(captain);
    expect(draft).toEqual({ plan: captain.standingPlan, parley: captain.standingParley });
    expect(standingChanged(captain, draft)).toBe(false);
    expect(draft.plan).not.toBe(captain.standingPlan);   // a copy, so editing the form never edits the captain
  });

  it("builds a payload the server accepts for every maneuver and every parley, and then sees nothing left to save", async () => {
    const w = await seasonWorld();
    const parleys = PARLEYS.map((p) => p.value);
    for (const [i, first] of MANEUVERS.entries()) {
      const draft: StandingDraft = {
        plan: [first.id, MANEUVERS[(i + 1) % 3]!.id, MANEUVERS[(i + 2) % 3]!.id],
        parley: parleys[i % parleys.length]!,
      };
      await expect(standingOrders(w.deps, w.user("ann"), standingPayload(draft))).resolves.toEqual({ plan: draft.plan, parley: draft.parley });
      expect(standingChanged(await captainOf(w, "ann"), draft)).toBe(false);
    }
  });

  it("notices a change to one round or to the parley", async () => {
    const captain = await captainOf(await seasonWorld(), "ann");
    const draft = standingDraftFor(captain);
    expect(standingChanged(captain, { ...draft, plan: [draft.plan[0], draft.plan[1], "outmaneuver"] })).toBe(draft.plan[2] !== "outmaneuver");
    expect(standingChanged(captain, { ...draft, parley: 1.5 })).toBe(true);
    expect(standingChanged(captain, { ...draft, parley: draft.parley })).toBe(false);
  });

  it("writes the standing orders as one sentence, with the same words as the Orders screen", () => {
    expect(standingSentence({ plan: ["board", "broadside", "outmaneuver"], parley: "off" })).toBe(
      "If you send no orders: stay in port, or at sea sail Quietly to the nearest port. If a hunter finds you, fight with Board, Broadside, Outmaneuver, and never parley.",
    );
    expect(standingSentence({ plan: ["board", "board", "board"], parley: 1.25 })).toContain("parley if they are 25% stronger");
  });

  it("describes what the standing orders really do: a captain who sends nothing is defended by them", async () => {
    // The sentence promises a defence by the standing plan. The captain in the store carries exactly that plan into the Tide.
    const w = await seasonWorld();
    await standingOrders(w.deps, w.user("ann"), { plan: ["board", "board", "outmaneuver"], parley: 1.5 });
    await submitOrders(w.deps, w.user("bob"), {
      tide: 1, course: [], intent: "trade", plan: ["broadside", "broadside", "broadside"], parley: "off", noQuarter: false, ready: true,
    });
    const ann = (await w.store.loadTideState("s0")).snapshot.captains.find((c) => c.id === "ann")!;
    expect(ann.standingPlan).toEqual(["board", "board", "outmaneuver"]);
    expect(ann.standingParley).toBe(1.5);
  });

  it("explains Shore Leave with the numbers from balance.ts", () => {
    const text = shoreLeaveNote({ shoreLeaveTides: 2, status: "active" });
    expect(text).toContain(`2 of ${B.catchUp.shoreLeaveCap} stored`);
    expect(text).toContain(`${Math.round(B.catchUp.shoreLeaveBonus * 100)}% more`);
    expect(text).toContain(`${B.catchUp.ashoreAfterMissed} missed Tides`);
    expect(shoreLeaveNote({ shoreLeaveTides: 0, status: "ashore" })).toMatch(/^You are Ashore\./);
  });
});
