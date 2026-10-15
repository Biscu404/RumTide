import { B, holdUnits, hullCost } from "@engine/balance.ts";
import type { GameMap } from "@engine/map.ts";
import { GOODS, saleRevenue, unitPrice } from "@engine/market.ts";
import {
  cargoUnits, holdFree, maxHull, nextHull, nextUpgradeCost, repairShip, type PortContext,
} from "@engine/port.ts";
import type { Good, HullId, MarketRow, Stat } from "@engine/types.ts";
import type { Me } from "../net/captain.ts";

// What the Port screen shows: prices, costs and limits, worked out with the same engine functions
// that port_action uses, so the screen and the server cannot disagree. The server still decides.

export const STATS: readonly { id: Stat; label: string; help: string }[] = [
  { id: "hull", label: "Hull", help: "More hull points to lose before you sink." },
  { id: "cannons", label: "Cannons", help: "More damage in every round." },
  { id: "sails", label: "Sails", help: "Better escape chance, and one more hop at level 3." },
  { id: "crew", label: "Crew", help: "Counts towards your power rating." },
  { id: "hold", label: "Hold", help: "Room for more cargo, and more to lose." },
];

export const GOOD_LABEL: Record<Good, string> = { rum: "Rum", sugar: "Sugar", spice: "Spice" };

export function portContext(map: GameMap, me: Pick<Me, "tide" | "settings">): PortContext {
  return { map, tide: me.tide.number, settings: me.settings, boomPortId: me.tide.boomPortId };
}

export interface GoodQuote {
  good: Good;
  /** What buying one unit costs. Buyers always pay the normal price. */
  buyPrice: number;
  /** What the first unit sells for right now, after earlier sales pushed the price down. */
  sellPrice: number;
  held: number;
  /** Why this port treats the good differently, if it does. */
  note: "made here" | "wanted here" | "boom" | "wants everything" | null;
}

/** One quote per good for the port the ship is docked at, or an empty list at sea. */
export function quotes(map: GameMap, me: Pick<Me, "ship" | "tide" | "market">): GoodQuote[] {
  const { ship } = me;
  const node = map.node(ship.nodeId);
  if (!ship.docked || !node.trade) return [];
  const trade = node.trade;
  const boomed = me.tide.boomPortId === ship.nodeId;
  const rowOf = (good: Good): MarketRow | undefined => me.market.find((r) => r.good === good);
  return GOODS.map((good): GoodQuote => ({
    good,
    buyPrice: unitPrice(good, trade, me.tide.number, 1, boomed),
    sellPrice: unitPrice(good, trade, me.tide.number, rowOf(good)?.drift ?? 1, boomed),
    held: ship.cargo[good],
    note: trade.wants === "all" ? "wants everything"
      : trade.makes === good ? "made here"
      : trade.wants === good ? (boomed ? "boom" : "wanted here")
      : null,
  }));
}

/** Doubloons for buying `units`, rounded the way the server rounds. */
export const buyCost = (quote: GoodQuote, units: number) => Math.round(quote.buyPrice * units);

/** Doubloons for selling `units`: each unit sells a little cheaper than the one before. */
export const sellRevenue = (quote: GoodQuote, units: number) => Math.round(saleRevenue(quote.sellPrice, units));

/** The most units that can be bought: limited by Hold space and by the Chest. */
export function maxBuy(quote: GoodQuote, me: Pick<Me, "ship" | "captain">): number {
  let units = Math.max(0, holdFree(me.ship));
  while (units > 0 && buyCost(quote, units) > me.captain.chestGold) units--;
  return units;
}

export interface HoldSummary { used: number; capacity: number; free: number }

export function hold(me: Pick<Me, "ship">): HoldSummary {
  const capacity = holdUnits(me.ship.hull, me.ship.levels.hold);
  const used = cargoUnits(me.ship);
  return { used, capacity, free: capacity - used };
}

export interface RepairQuote { missing: number; points: number; cost: number; max: number }

/** What repairing as much as the Chest can pay for would do. */
export function repairQuote(ctx: PortContext, me: Pick<Me, "ship" | "captain">): RepairQuote {
  const max = maxHull(me.ship);
  const r = repairShip(me.ship, me.captain, ctx);
  return { missing: max - me.ship.hullPoints, points: r.points, cost: r.cost, max };
}

export interface UpgradeRow { stat: Stat; level: number; cost: number | null; affordable: boolean }

export function upgrades(me: Pick<Me, "ship" | "captain" | "settings">): UpgradeRow[] {
  return STATS.map(({ id }) => {
    const cost = nextUpgradeCost(me.ship, id, me);
    return { stat: id, level: me.ship.levels[id], cost, affordable: cost !== null && cost <= me.captain.chestGold };
  });
}

export const MAX_LEVEL = B.upgrade.maxLevel;

export interface ShipwrightQuote { target: HullId; cost: number; progress: number; owed: number }

/** The hull being built, or null when this season has no bigger one. */
export function shipwright(me: Pick<Me, "ship" | "settings">): ShipwrightQuote | null {
  const target = nextHull(me.ship, me);
  if (target === null) return null;
  const cost = hullCost(target, me.settings.progressionCostMult);
  return { target, cost, progress: me.ship.shipwrightProgress, owed: cost - me.ship.shipwrightProgress };
}
