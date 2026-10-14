// Scripted captains for the bot season (section 15.6). Each one plans a Tide from what a real
// player could see: its own ship and Chest, every ship's position, the merchants on the map, and
// the market. Nothing here is a game rule, so the thresholds live in this file and not in balance.ts.
//
//   trader    sails the best loop between ports, like the economy sim, and takes parley when outgunned
//   raider    hunts the nearest player ship it can reach, and merchants when none is near
//   reaver    hunts merchants only
//   convoy    two traders in one fleet, who go after the Treasure Galleon together when both can reach it

import { maxHullPoints, speed } from "@engine/balance.ts";
import type { GameMap } from "@engine/map.ts";
import { hopsFrom, shortestPath } from "@engine/map.ts";
import type { PortContext } from "@engine/port.ts";
import { repairShip } from "@engine/port.ts";
import { nearestPort } from "@engine/resolve.ts";
import type { Rng } from "@engine/rng.ts";
import type { TideSnapshot } from "@engine/season.ts";
import { shipPowerRating } from "@engine/state.ts";
import type { Captain, Maneuver, MarketRow, Orders, Ship, Stat } from "@engine/types.ts";
import { spend, visitPort, type TraderPolicy } from "../sim/trader.ts";

const MANEUVERS: readonly Maneuver[] = ["broadside", "outmaneuver", "board"];
type Plan = [Maneuver, Maneuver, Maneuver];

/** Plays Outmaneuver, Broadside, Outmaneuver: the counter to the galleon's printed habit (Broadside, Board, Broadside). */
export const GALLEON_COUNTER: Plan = ["outmaneuver", "broadside", "outmaneuver"];

/** What a bot is shown when it plans. The market already holds the sales of captains who went before it. */
export interface BotView {
  map: GameMap;
  snap: TideSnapshot;
  ctx: PortContext;
  ship: Ship;
  captain: Captain;
}

/** What a bot does: port actions (new ship, Chest and market) and its orders, or none if it skips the Tide. */
export interface Turn { ship: Ship; captain: Captain; market: MarketRow[]; orders: Orders | null; }

export interface Bot {
  id: string;
  role: string;
  fleetId: string | null;
  /** Tides this captain does not submit orders for (to exercise standing orders and Shore Leave). */
  absent: readonly number[];
  play(view: BotView): Turn;
}

// ---- Shared pieces ----

const hopsBetween = (map: GameMap, a: string, b: string) => hopsFrom(map, a).get(b)!;
const atPort = (map: GameMap, ship: Ship) => map.node(ship.nodeId).type === "port";
const pace = (ship: Ship) => speed(ship.hull, ship.levels.sails);
const towards = (map: GameMap, ship: Ship, to: string) => shortestPath(map, ship.nodeId, to).slice(0, pace(ship));
const hullShare = (ship: Ship) => ship.hullPoints / maxHullPoints(ship.hull, ship.levels.hull);

/** Three maneuvers with no repeat in a row, so no round is stale. */
function freshPlan(rng: Rng): Plan {
  const a = rng.pick(MANEUVERS);
  const b = rng.pick(MANEUVERS.filter((m) => m !== a));
  const c = rng.pick(MANEUVERS.filter((m) => m !== b));
  return [a, b, c];
}

const orders = (view: BotView, o: Partial<Orders> & Pick<Orders, "plan">): Orders => ({
  tide: view.snap.tide, captainId: view.captain.id, course: [], intent: "trade",
  parley: "off", noQuarter: false, ready: true, ...o,
});

/** Docked and short of hull: pay for repairs. */
function repaired(view: BotView): { ship: Ship; captain: Captain } {
  if (!atPort(view.map, view.ship)) return { ship: view.ship, captain: view.captain };
  const r = repairShip(view.ship, view.captain, view.ctx);
  return { ship: r.ship, captain: r.captain };
}

/** Is a galleon on the map that this ship and every fleet mate can reach this Tide? Returns its node. */
function galleonRun(view: BotView): string | null {
  const galleon = view.snap.npcs.find((n) => n.kind === "galleon" && n.status === "active");
  if (!galleon || view.captain.fleetId === null) return null;
  const crew = view.snap.captains.filter((c) => c.fleetId === view.captain.fleetId);
  for (const c of crew) {
    const s = view.snap.ships.find((x) => x.captainId === c.id)!;
    if (hopsBetween(view.map, s.nodeId, galleon.nodeId) > pace(s) || hullShare(s) < 0.7) return null;
  }
  return crew.length >= 2 ? galleon.nodeId : null;
}

// ---- Trader ----

export function traderBot(id: string, policy: TraderPolicy, rng: Rng, fleetId: string | null = null, absent: readonly number[] = []): Bot {
  let destination: string | null = null;   // the port the cargo is bound for
  return {
    id, role: fleetId ? "convoy trader" : `${policy.route} trader`, fleetId, absent,
    play(view) {
      const { map, ctx } = view;
      let { ship, captain } = repaired(view);
      let market = view.snap.market;

      const target = galleonRun(view);
      if (target !== null) {
        const course = towards(map, ship, target);
        return {
          ship, captain, market,
          orders: orders(view, { plan: GALLEON_COUNTER, intent: "hunt", huntFilter: "merchants", course }),
        };
      }

      let course: string[] = [];
      if (atPort(map, ship)) {
        const visit = visitPort({ ship, captain, market }, ctx, policy);
        ({ ship, captain, market } = visit);
        destination = visit.route.at(-1) ?? null;
        course = visit.route.slice(0, pace(ship));
      } else {
        // Blown off course or stopped by a fight: carry on to the same port, or the nearest one.
        destination ??= nearestPort(map, ship.nodeId);
        course = towards(map, ship, destination);
      }
      return {
        ship, captain, market,
        orders: orders(view, { plan: freshPlan(rng), course, parley: 1.25 }),
      };
    },
  };
}

// ---- Raiders and reavers ----

const HUNTER_UPGRADES: readonly Stat[] = ["cannons", "crew", "hull", "sails", "hold"];
/** Head for port once the hold of plunder is this big, or the hull this low. */
const BANK_AT_PLUNDER = 100;
const REPAIR_BELOW_HULL = 0.55;
/** A raider leaves ships that are much stronger than itself alone. */
const MAX_PR_RATIO = 1.5;

export function hunterBot(id: string, role: "raider" | "reaver", policy: TraderPolicy, rng: Rng, fleetId: string | null = null): Bot {
  return {
    id, role, fleetId, absent: [],
    play(view) {
      const { map, snap, ctx } = view;
      let { ship, captain } = repaired(view);
      if (atPort(map, ship)) {
        const spent = spend(ship, captain, captain.chestGold, ctx, policy, HUNTER_UPGRADES);
        ({ ship, captain } = spent);
      }
      const base = { ship, captain, market: snap.market };
      const plan = freshPlan(rng);
      const here = ship.nodeId;

      const hurt = ship.plunderGold >= BANK_AT_PLUNDER || hullShare(ship) < REPAIR_BELOW_HULL;
      if (hurt && !atPort(map, ship)) {
        return { ...base, orders: orders(view, { plan, intent: "quiet", course: towards(map, ship, nearestPort(map, here)) }) };
      }

      // Candidates: where something is, and how many hops away.
      const prey: { nodeId: string; hops: number; id: string }[] = [];
      if (role === "raider") {
        for (const other of snap.ships) {
          const c = snap.captains.find((x) => x.id === other.captainId)!;
          if (other.captainId === captain.id || atPort(map, other)) continue;
          if (c.fleetId !== null && c.fleetId === captain.fleetId) continue;
          if (c.shieldUntilTide !== null && snap.tide <= c.shieldUntilTide) continue;
          if (shipPowerRating(other) > MAX_PR_RATIO * shipPowerRating(ship)) continue;
          prey.push({ nodeId: other.nodeId, hops: hopsBetween(map, here, other.nodeId), id: other.captainId });
        }
      }
      for (const npc of snap.npcs) {
        if (npc.kind === "galleon" || npc.status !== "active") continue;
        prey.push({ nodeId: npc.nodeId, hops: hopsBetween(map, here, npc.nodeId), id: npc.id });
      }
      prey.sort((a, b) => a.hops - b.hops || (a.id < b.id ? -1 : 1));
      const next = prey[0];

      if (!next) return { ...base, orders: orders(view, { plan, intent: "trade" }) };
      const course = next.hops === 0 ? [] : towards(map, ship, next.nodeId);
      return {
        ...base,
        orders: orders(view, { plan, intent: "hunt", huntFilter: role === "raider" ? "anyone" : "merchants", course }),
      };
    },
  };
}
