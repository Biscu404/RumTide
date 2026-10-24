// What a ship can try in a round (P3.B3). Check 2 forces one play in one round and judges it against the others, and check 5 writes
// doctrines for a ship of a style, so both need the same answer to "which orders can this ship really give?". The answer is here
// and nowhere else: the situation runner builds its plays from it and the coverage judge counts a play only where it was possible.
//
//   Every ship          the six Guns orders of SIM_GUNS_ORDERS (Round shot, Chain shot, Grapeshot, Hold Fire, Board, Repel)
//   a Bombardier        also the Mortar
//   a Firebrand         also Hot Shot
//   a Grappled round    also Charge and Volley, which do nothing at any other range, and Fire Pots for a ship that can throw one
//
// A ship can throw a pot when it has one and either is a Firebrand or has Drill 5 (the engine's own canThrowPots, so this cannot
// drift from the rule). Fists is never a play: it is what a crew falls back to.

import { HELM_MOVES, canThrowPots, drillOf } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { GunsOrder, HelmMove } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { buildShip } from "./arena.ts";
import type { ShipSpec } from "./arena.ts";
import { SIM_GUNS_ORDERS } from "./plans.ts";

/** One Helm move with one Guns order: a play for a round. */
export interface Play {
  helm: HelmMove;
  guns: GunsOrder;
}

/** Whether the ships are Grappled as the round starts. Only then do the Deck orders mean anything. */
export type Setting = "open" | "grappled";

/** The Guns orders this ship can give in a round of this setting, the six first. */
export function ordersFor(spec: ShipSpec, setting: Setting): GunsOrder[] {
  const ship = buildShip("plays", spec);
  const orders: GunsOrder[] = [...SIM_GUNS_ORDERS];
  if (ship.style === "bombardier") orders.push("mortar");
  if (ship.style === "firebrand") orders.push("hotShot");
  if (setting === "grappled") {
    orders.push("charge", "volley");
    if (canThrowPots({ ...(ship.style ? { style: ship.style } : {}), drill: drillOf(ship), firePots: ship.hold.firePots })) orders.push("firePots");
  }
  return orders;
}

/** Every play this ship can try: the four Helm moves in order, each with every order it can give. */
export const playsFor = (spec: ShipSpec, setting: Setting): Play[] =>
  HELM_MOVES.flatMap((helm) => ordersFor(spec, setting).map((guns) => ({ helm, guns })));

/** Can this ship give this order in a round of this setting? The coverage judge counts an order only where this holds. */
export const canTry = (spec: ShipSpec, setting: Setting, guns: GunsOrder): boolean => ordersFor(spec, setting).includes(guns);

/** The plays of a ship with no style in an open fight: four Helm moves, each with the six Guns orders. */
export const ALL_PLAYS: readonly Play[] = playsFor({}, "open");
