import { speed } from "@engine/balance.ts";
import { matchup } from "@engine/combat.ts";
import { courseLimit } from "@engine/explore.ts";
import { courseError } from "@engine/movement.ts";
import { hopsFrom, shortestPath, type GameMap } from "@engine/map.ts";
import type { Intent, Maneuver, Orders, Ship } from "@engine/types.ts";
import type { Me, Rival } from "../net/captain.ts";
import type { SubmitPayload } from "../net/payloads.ts";

// What the Orders screen shows and sends, with no Preact in it so it can be tested. The server checks
// every order again (submit_orders), so nothing here is trusted. It only saves a round trip.

export const INTENTS: readonly { id: Intent; label: string; help: string }[] = [
  { id: "trade", label: "Trade Run", help: "Does not start fights. Normal escape chance." },
  { id: "quiet", label: "Sail Quietly", help: "Better escape chance. Cannot hunt or explore." },
  { id: "hunt", label: "Hunt", help: "Starts fights with whatever matches your filter." },
  { id: "explore", label: "Explore", help: "Draws an event if you sail to an island or a wreck and do not fight on the way." },
  { id: "escort", label: "Escort", help: "Copies a fleet mate's course and joins any battle they are in." },
];

export const MANEUVERS: readonly { id: Maneuver; label: string }[] = [
  { id: "broadside", label: "Broadside" },
  { id: "outmaneuver", label: "Outmaneuver" },
  { id: "board", label: "Board" },
];

export const PARLEYS: readonly { value: Orders["parley"]; label: string }[] = [
  { value: "off", label: "never" },
  { value: 1.25, label: "25% stronger" },
  { value: 1.5, label: "50% stronger" },
];

export const maneuverLabel = (m: Maneuver) => MANEUVERS.find((x) => x.id === m)!.label;

/** What a maneuver beats, taken from the combat rules rather than written down twice. */
export function beats(m: Maneuver): Maneuver {
  return MANEUVERS.find((x) => matchup(m, x.id) > 1)!.id;
}

/** "Broadside beats Board. Board beats Outmaneuver. ..." for the Orders screen. */
export const TRIANGLE = MANEUVERS.map((m) => `${maneuverLabel(m.id)} beats ${maneuverLabel(beats(m.id))}.`).join(" ");

/** The form's state. Kept flat so every field has an input. */
export interface Draft {
  destination: string;
  intent: Intent;
  huntKind: "merchants" | "players" | "anyone" | "captain";
  huntCaptainId: string;
  escortCaptainId: string;
  plan: [Maneuver, Maneuver, Maneuver];
  parley: Orders["parley"];
  noQuarter: boolean;
  ready: boolean;
}

/** Fleet mates: other captains in my fleet. */
export function fleetMates(me: Pick<Me, "captain" | "others">): Rival[] {
  const fleetId = me.captain.fleetId;
  return fleetId === null ? [] : me.others.filter((r) => r.fleetId === fleetId);
}

/** Saved orders as form state. `nodeId` is where the ship is, for orders that do not move it. */
export function draftFromOrders(o: Orders, nodeId: string): Draft {
  const filter = o.huntFilter;
  return {
    destination: o.course.length > 0 ? o.course[o.course.length - 1]! : nodeId,
    intent: o.intent,
    huntKind: filter === undefined ? "merchants" : typeof filter === "string" ? filter : "captain",
    huntCaptainId: typeof filter === "object" ? filter.captainId : "",
    escortCaptainId: o.escortCaptainId ?? "",
    plan: o.plan,
    parley: o.parley,
    noQuarter: o.noQuarter,
    ready: o.ready,
  };
}

/** The saved orders if there are any, otherwise a quiet start from the captain's standing orders. */
export function draftFor(me: Pick<Me, "captain" | "ship" | "orders" | "others">): Draft {
  const base: Draft = me.orders
    ? draftFromOrders(me.orders, me.ship.nodeId)
    : {
      destination: me.ship.nodeId, intent: "trade", huntKind: "merchants", huntCaptainId: "", escortCaptainId: "",
      plan: me.captain.standingPlan, parley: me.captain.standingParley, noQuarter: false, ready: false,
    };
  return { ...base, escortCaptainId: base.escortCaptainId || (fleetMates(me)[0]?.id ?? "") };
}

export interface Destination { nodeId: string; name: string; hops: number }

/** Every node the ship can reach this Tide, nearest first. The ship's own node (stay put) is not listed. */
export function destinations(map: GameMap, from: string, maxSpeed: number): Destination[] {
  const found: Destination[] = [];
  for (const [nodeId, hops] of hopsFrom(map, from)) {
    if (hops >= 1 && hops <= maxSpeed) found.push({ nodeId, name: map.node(nodeId).name, hops });
  }
  return found.sort((a, b) => a.hops - b.hops || a.name.localeCompare(b.name));
}

export const shipSpeed = (ship: Pick<Ship, "hull" | "levels">) => speed(ship.hull, ship.levels.sails);

/** The route to a destination, not counting where the ship is. Empty to stay put. */
export function courseTo(map: GameMap, ship: Ship, destination: string): string[] {
  return destination === ship.nodeId ? [] : shortestPath(map, ship.nodeId, destination);
}

/** The orders to send, or the reason they are not ready to send. */
export function toPayload(
  map: GameMap, me: Pick<Me, "captain" | "ship" | "tide" | "others">, draft: Draft, ready: boolean,
): { ok: true; payload: SubmitPayload } | { ok: false; reason: string } {
  const { ship } = me;
  let course: string[];
  try {
    course = courseTo(map, ship, draft.destination);
  } catch {
    return { ok: false, reason: "There is no route to that place." };
  }
  const problem = courseError(map, ship.nodeId, course, courseLimit(ship, me.captain));
  if (problem !== null) return { ok: false, reason: problem };

  const payload: SubmitPayload = {
    tide: me.tide.number, course, intent: draft.intent, plan: draft.plan, parley: draft.parley,
    noQuarter: draft.intent === "hunt" && draft.noQuarter, ready,
  };
  if (draft.intent === "hunt") {
    if (draft.huntKind === "captain") {
      if (!me.others.some((r) => r.id === draft.huntCaptainId)) return { ok: false, reason: "Pick a captain to hunt." };
      payload.huntFilter = { captainId: draft.huntCaptainId };
    } else {
      payload.huntFilter = draft.huntKind;
    }
  }
  if (draft.intent === "escort") {
    if (!fleetMates(me).some((r) => r.id === draft.escortCaptainId)) return { ok: false, reason: "Pick a fleet mate to escort." };
    payload.escortCaptainId = draft.escortCaptainId;
  }
  return { ok: true, payload };
}

/** The orders as one sentence (section 2.2): "Sail to X, Hunt merchants, fight with A, B, C, parley if they are 50% stronger." */
export function sentence(
  map: GameMap, me: { ship: Pick<Ship, "nodeId" | "docked">; others: readonly Pick<Rival, "id" | "shipName">[] }, draft: Draft,
): string {
  const { ship } = me;
  const parts: string[] = [];
  if (draft.destination === ship.nodeId) {
    parts.push(ship.docked ? `Stay in ${map.node(ship.nodeId).name}` : `Hold at ${map.node(ship.nodeId).name}`);
  } else {
    parts.push(`Sail to ${map.node(draft.destination).name}`);
  }
  const intent = INTENTS.find((i) => i.id === draft.intent)!.label;
  if (draft.intent === "hunt") {
    const who = draft.huntKind === "captain"
      ? me.others.find((r) => r.id === draft.huntCaptainId)?.shipName ?? "a captain"
      : draft.huntKind;
    parts.push(`Hunt ${who}`);
  } else if (draft.intent === "escort") {
    parts.push(`Escort ${me.others.find((r) => r.id === draft.escortCaptainId)?.shipName ?? "a fleet mate"}`);
  } else {
    parts.push(intent);
  }
  parts.push(`fight with ${draft.plan.map(maneuverLabel).join(", ")}`);
  const parley = PARLEYS.find((p) => p.value === draft.parley)!;
  parts.push(draft.parley === "off" ? "never parley" : `parley if they are ${parley.label}`);
  return `${parts.join(", ")}.`;
}

/** Has the form moved away from what the server has saved? */
export function isDirty(saved: Orders | null, payload: SubmitPayload): boolean {
  if (!saved) return true;
  const a = { ...payload, ready: false };
  const b: SubmitPayload = {
    tide: saved.tide, course: saved.course, intent: saved.intent, plan: saved.plan, parley: saved.parley,
    noQuarter: saved.noQuarter, ready: false,
    ...(saved.huntFilter !== undefined ? { huntFilter: saved.huntFilter } : {}),
    ...(saved.escortCaptainId !== undefined ? { escortCaptainId: saved.escortCaptainId } : {}),
  };
  return JSON.stringify(sortKeys(a)) !== JSON.stringify(sortKeys(b));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}
