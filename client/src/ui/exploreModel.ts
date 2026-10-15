import { OMEN_NAMES, courseLimit, omenText } from "@engine/explore.ts";
import type { GameMap } from "@engine/map.ts";
import type { Captain, Omen, Ship } from "@engine/types.ts";
import type { Draft } from "./ordersModel.ts";

// What the screens say about exploration events and the Omens they leave (section 10.1), with no
// Preact in it so it can be tested. The rules themselves are in the engine; this only reads them.

/** How many hops the ship may sail this Tide, counting a Hermit's chart. */
export const maxHops = (me: { ship: Pick<Ship, "hull" | "levels">; captain: Pick<Captain, "omens"> }) =>
  courseLimit(me.ship, me.captain);

/** One line for each Omen the captain carries: "Castaway: +10% Crew in your next battle." */
export const omenLines = (omens: readonly Omen[]) => omens.map((o) => `${OMEN_NAMES[o]}: ${omenText(o)}`);

/** Omen names for the one line stats bar, or an empty string. */
export const omenNames = (omens: readonly Omen[]) => omens.map((o) => OMEN_NAMES[o]).join(", ");

/**
 * What the Orders screen says under the Explore intent: whether this course will draw an event. An
 * event is drawn when the ship sails to an island or a wreck and does not fight on the way.
 */
export function exploreHint(map: GameMap, ship: Pick<Ship, "nodeId">, draft: Pick<Draft, "intent" | "destination">): string | null {
  if (draft.intent !== "explore") return null;
  if (draft.destination === ship.nodeId) return "You are already here. Sail to another island or wreck to draw an event.";
  const node = map.node(draft.destination);
  if (node.type !== "island" && node.type !== "wreck") return `Nothing to explore at ${node.name}. Choose an island or a wreck.`;
  return `An event waits at ${node.name}, unless you have to fight on the way.`;
}
