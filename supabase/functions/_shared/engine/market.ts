// Section 6.3: what a good costs at a port, how selling pushes the price down, and how prices
// drift back. Pure arithmetic on a MarketRow and the port's trade data from the map.
//
// Selling lowers a port's price for a good by 1.5% a unit (the drift). Buying does not move the
// price, and buyers always pay the normal price, never a drifted one: otherwise a captain could
// sell a lot, buy it back cheaper and repeat for free gold. Each Tide the drift moves halfway back to 1.

import { B, boom } from "./balance.ts";
import type { GameMap, PortTrade } from "./map.ts";
import type { Rng } from "./rng.ts";
import type { Good, MarketRow } from "./types.ts";

/** Every good in sorted order. Iterate this, never an object's keys, so results are reproducible. */
export const GOODS: readonly Good[] = ["rum", "spice", "sugar"];

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Week 1 is Tides 1 to 7, week 2 is Tides 8 to 14, and so on. */
export const weekOf = (tide: number) => Math.ceil(tide / B.weekTides);

/** Does the weekly Trade Winds boom exist yet? Season 0 has Calm Seas in week 1 and Trade Winds in week 2. */
export const weeklyBoomActive = (tide: number) => weekOf(tide) >= B.trade.weeklyBoomFromWeek;

/** The factor a port applies to the base price of a good. `boomed` is the Trade Winds boom for its wanted good. */
export function portMult(good: Good, trade: PortTrade, boomed = false): number {
  if (trade.wants === "all") return B.trade.lastLanternMult;
  if (trade.makes === good) return B.trade.madeMult;
  if (trade.wants === good) return boomed ? B.trade.weeklyBoomMult : B.trade.wantedMult;
  return 1;
}

/**
 * Price of one unit right now, before the units about to be sold push it down. Pass drift 1 for the
 * price a buyer pays.
 */
export const unitPrice = (good: Good, trade: PortTrade, tide: number, drift: number, boomed = false) =>
  B.trade.basePrice * portMult(good, trade, boomed) * boom(tide) * drift;

/** Drift after `units` have been sold. */
export const driftAfterSelling = (drift: number, units: number) =>
  drift * B.trade.priceKeptPerUnitSold ** units;

/** What selling `units` at a starting unit price pays: each unit sells a little cheaper than the one before. */
export function saleRevenue(startPrice: number, units: number): number {
  const k = B.trade.priceKeptPerUnitSold;
  return startPrice * (1 - k ** units) / (1 - k);
}

/** Each Tide prices drift halfway back to normal. */
export const driftNextTide = (drift: number) => (drift + 1) / 2;

/** A fresh market: every port and good at normal prices, in sorted port then good order. */
export function newMarket(map: GameMap, seasonId: string): MarketRow[] {
  const rows: MarketRow[] = [];
  for (const portId of map.nodeIds) {
    if (map.node(portId).type !== "port") continue;
    for (const good of GOODS) rows.push({ seasonId, portId, good, drift: 1, soldThisTide: 0 });
  }
  return rows;
}

/** The start of a new Tide: every row drifts back and its sales counter resets. */
export const advanceMarket = (rows: readonly MarketRow[]): MarketRow[] =>
  rows.map((r) => ({ ...r, drift: driftNextTide(r.drift), soldThisTide: 0 }));

/**
 * The Trade Winds boom (section 6.3): one random port with a wanted good gets it for the week.
 * Last Lantern already wants everything, so it is left out.
 */
export function pickBoomPort(map: GameMap, rng: Rng): string {
  const ports = map.nodeIds.filter((id) => {
    const n = map.node(id);
    return n.type === "port" && n.trade?.wants !== "all";
  }).sort(compareIds);
  return rng.pick(ports);
}
