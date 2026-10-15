import { B } from "@engine/balance.ts";
import type { Captain, Maneuver, Orders } from "@engine/types.ts";
import type { StandingPayload } from "../net/payloads.ts";
import { PARLEYS, maneuverLabel } from "./ordersModel.ts";

// What the standing orders form shows and sends, with no Preact in it so it can be tested (section 12.4).
// A captain who sends no orders for a Tide stays in port, or at sea sails Quietly to the nearest port,
// and the standing plan and standing parley defend the ship if a hunter finds it. The server checks the
// payload again (standing_orders), so nothing here is trusted. It only saves a round trip.

export interface StandingDraft {
  plan: [Maneuver, Maneuver, Maneuver];
  parley: Orders["parley"];
}

export const standingDraftFor = (captain: Pick<Captain, "standingPlan" | "standingParley">): StandingDraft => ({
  plan: [...captain.standingPlan], parley: captain.standingParley,
});

export const standingPayload = (draft: StandingDraft): StandingPayload => ({ plan: draft.plan, parley: draft.parley });

/** Has the form moved away from what the server has saved? */
export const standingChanged = (captain: Pick<Captain, "standingPlan" | "standingParley">, draft: StandingDraft) =>
  draft.parley !== captain.standingParley || draft.plan.some((m, i) => m !== captain.standingPlan[i]);

/** The standing orders as one sentence, the way the Orders screen writes its own (section 2.2). */
export function standingSentence(draft: StandingDraft): string {
  const parley = PARLEYS.find((p) => p.value === draft.parley)!;
  return `If you send no orders: stay in port, or at sea sail Quietly to the nearest port. If a hunter finds you, fight with ${
    draft.plan.map(maneuverLabel).join(", ")}, and ${
    draft.parley === "off" ? "never parley" : `parley if they are ${parley.label}`}.`;
}

/** What Shore Leave is and how much this captain has stored (section 12.4). */
export function shoreLeaveNote(captain: Pick<Captain, "shoreLeaveTides" | "status">): string {
  const bonus = `${Math.round(B.catchUp.shoreLeaveBonus * 100)}%`;
  const cap = B.catchUp.shoreLeaveCap;
  const text = `Shore Leave: ${captain.shoreLeaveTides} of ${cap} stored. Every Tide you send no orders stores one. When you are back, `
    + `the first Tide you bank a profit uses one up, and every sale profit and prize in that Tide pays ${bonus} more.`;
  const ashore = `After ${B.catchUp.ashoreAfterMissed} missed Tides in a row your ship stays docked as Ashore and you stop counting for Ready. Sending orders sets you free.`;
  return captain.status === "ashore" ? `You are Ashore. ${text} Send orders to sail again.` : `${text} ${ashore}`;
}
