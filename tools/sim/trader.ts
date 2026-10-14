// A bot trader playing a solo season on the real engine: it buys at one port, sails the real map,
// sells at another, and spends the profit on upgrades and the Shipwright. Used by the economy
// sim (section 3.5) and by the full bot season (tools/bots), which calls visitPort.
//
// Timing. Session s is the captain's visit to port while Tide s is open (s = 1 is before the first
// Tide resolves). Whatever is sold in session s+1 was earned during Tide s, so "income of Tide s"
// is the profit of the sales in session s+1. After the last Tide there is one more session
// to sell and spend, without sailing on.
//
// The thresholds below are bot behaviour, not game rules, so they live here and not in balance.ts.

import { readFileSync } from "node:fs";
import { B, SEASON_PRESETS, speed } from "@engine/balance.ts";
import { hopsFrom, loadMap, shortestPath, type GameMap } from "@engine/map.ts";
import { GOODS, advanceMarket, driftNextTide, newMarket, pickBoomPort, saleRevenue, unitPrice, weekOf, weeklyBoomActive } from "@engine/market.ts";
import {
  buyGood, buyUpgrade, dock, feedShipwright, holdFree, nextHull, nextUpgradeCost, sellGood, type PortContext,
} from "@engine/port.ts";
import { createRng } from "@engine/rng.ts";
import { seasonSettings } from "@engine/season.ts";
import { newCaptain, newShip, shipPowerRating } from "@engine/state.ts";
import type { PortActionPayload } from "../../supabase/functions/_shared/api/schemas.ts";
import type { Captain, Good, HullId, MarketRow, SeasonSettings, Ship, Stat } from "@engine/types.ts";

export const brine: GameMap = loadMap(
  JSON.parse(readFileSync(new URL("../../supabase/functions/_shared/maps/brine.json", import.meta.url), "utf8")),
);

export interface TraderPolicy {
  /**
   * How the next leg is picked, always by profit for each Tide at sea. "careful" also looks at
   * the best leg back out of the far port and takes the best loop. "casual" looks at the one
   * leg only, so it can end up in a port with nothing good to carry away.
   */
  route: "careful" | "casual";
  startPort: string;
  /** Start saving for the next hull once this many upgrade levels are bought (the section 5.5 sim saves from about 10). */
  saveFromLevels: number;
}

export const DEFAULT_POLICY: TraderPolicy = { route: "careful", startPort: "port_regal", saveFromLevels: 10 };

/** Cheapest upgrade first, and among equals the stat a trader wants most. */
const UPGRADE_ORDER: readonly Stat[] = ["hold", "sails", "hull", "crew", "cannons"];

export interface TideReport {
  tide: number;
  /** Trade profit earned during the Tide: sales minus what the cargo cost. */
  income: number;
  levels: number;
  hull: HullId;
  chest: number;
  pr: number;
}

export interface TraderRun {
  seed: number;
  tides: TideReport[];
  /** The Tide on which the Brigantine was finished, or null. */
  brigantineTide: number | null;
}

const PORTS = brine.nodeIds.filter((id) => brine.node(id).type === "port");

/** The state a trader carries into a port. */
export interface PortState { ship: Ship; captain: Captain; market: MarketRow[]; }

export interface PortVisit extends PortState {
  /** The nodes still to sail, set when the trader loaded cargo for a destination; empty if there is nowhere to go. */
  route: string[];
  /** Trade profit from the sales made on this visit. */
  earned: number;
  /** The port actions of the visit in order, as the `port_action` Edge Function takes them. */
  actions: PortActionPayload[];
}

/**
 * Everything a trading captain does in port: bank, sell the whole Hold, keep enough gold to fill it again,
 * spend the rest on the Shipwright and upgrades, then load the best cargo and pick the way to its port.
 * `lastVisit` is the one after the final Tide: sell and spend everything, load nothing.
 */
export function visitPort(
  start: PortState, ctx: PortContext, policy: TraderPolicy, lastVisit = false, upgradeOrder: readonly Stat[] = UPGRADE_ORDER,
): PortVisit {
  let { ship, captain } = start;
  const market = [...start.market];
  const rowIndex = (portId: string, good: Good) => market.findIndex((r) => r.portId === portId && r.good === good);
  const drift = (portId: string, good: Good) => market[rowIndex(portId, good)]!.drift;
  let earned = 0;
  let route: string[] = [];
  const actions: PortActionPayload[] = [];
  ship = dock(ship, captain).ship;

  // 1. Sell whatever the Hold has.
  for (const good of GOODS) {
    if (ship.cargo[good] === 0) continue;
    const r = sellGood(ship, captain, market[rowIndex(ship.nodeId, good)]!, good, ship.cargo[good], ctx);
    ship = r.ship; captain = r.captain; earned += r.profit; market[rowIndex(r.row.portId, r.row.good)] = r.row;
    actions.push({ action: "sell", good, units: r.units });
  }

  if (!lastVisit) {
    // 2. Keep enough gold to fill the Hold, then spend the rest.
    const planned = bestTrip(ship, captain.chestGold, ctx, drift, policy, PORTS);
    const reserve = planned ? Math.ceil(planned.units * buyPriceAt(ship.nodeId, planned.good, ctx)) : 0;
    const spent = spend(ship, captain, Math.max(0, captain.chestGold - reserve), ctx, policy, upgradeOrder);
    ship = spent.ship; captain = spent.captain; actions.push(...spent.actions);

    // 3. Fill the Hold for the best leg and set sail.
    const trip = bestTrip(ship, captain.chestGold, ctx, drift, policy, PORTS);
    if (trip) {
      const bought = buyGood(ship, captain, market[rowIndex(ship.nodeId, trip.good)]!, trip.good, trip.units, ctx);
      ship = { ...bought.ship, docked: false }; captain = bought.captain;
      actions.push({ action: "buy", good: trip.good, units: trip.units });
      route = shortestPath(brine, ship.nodeId, trip.to);
    }
  } else {
    const spent = spend(ship, captain, captain.chestGold, ctx, policy, upgradeOrder);
    ship = spent.ship; captain = spent.captain; actions.push(...spent.actions);
  }
  return { ship, captain, market, route, earned, actions };
}

interface Trip { good: Good; to: string; tides: number; units: number; score: number; }

export const totalLevels = (ship: Ship) => Object.values(ship.levels).reduce((a, b) => a + b, 0);

export function runTrader(
  policy: TraderPolicy, seed: number, settings: SeasonSettings = seasonSettings("season0"),
  lengthTides: number = SEASON_PRESETS[settings.preset].lengthTides,
): TraderRun {
  const rng = createRng(seed);
  let ship = newShip("trader", policy.startPort);
  let captain: Captain = newCaptain("trader", "sim");
  let market: MarketRow[] = newMarket(brine, "sim");
  let route: string[] = [];
  let boomPortId: string | null = null;
  const reports: TideReport[] = [];
  let brigantineTide: number | null = null;


  for (let session = 1; session <= lengthTides + 1; session++) {
    const tide = Math.min(session, lengthTides);
    if (session > 1) market = advanceMarket(market);
    if (weeklyBoomActive(tide) && (boomPortId === null || weekOf(tide) !== weekOf(Math.min(session - 1, lengthTides)))) {
      boomPortId = pickBoomPort(brine, rng);
    }
    const ctx: PortContext = { map: brine, tide, settings, boomPortId };
    let earned = 0;

    // En route the captain just keeps sailing. At a port with nowhere left to go, it is time to trade.
    if (route.length === 0) {
      const visit = visitPort({ ship, captain, market }, ctx, policy, session > lengthTides);
      ({ ship, captain, market, route } = visit);
      earned += visit.earned;
    }

    // The sales of session s were earned in Tide s - 1.
    if (session > 1) {
      reports.push({
        tide: session - 1, income: earned, levels: totalLevels(ship), hull: ship.hull,
        chest: captain.chestGold, pr: shipPowerRating(ship),
      });
      if (brigantineTide === null && ship.hull !== "sloop") brigantineTide = session - 1;
    }

    // Tide `session` resolves: sail as far as speed allows.
    if (session <= lengthTides && route.length > 0) {
      const hops = route.splice(0, speed(ship.hull, ship.levels.sails));
      ship = { ...ship, nodeId: hops[hops.length - 1]!, docked: route.length === 0 };
    }
  }
  return { seed, tides: reports, brigantineTide };
}

/** What a buyer pays here now: the normal price, whatever sellers have done to the market. */
function buyPriceAt(portId: string, good: Good, ctx: PortContext) {
  return unitPrice(good, brine.node(portId).trade!, ctx.tide, 1, ctx.boomPortId === portId);
}

const boomedAt = (ctx: PortContext, portId: string, tide: number) =>
  ctx.boomPortId === portId && weeklyBoomActive(tide);

/** Profit of carrying `units` of a good from one port to another, and the Tides it takes. */
function leg(
  ctx: PortContext, pace: number, from: string, to: string, good: Good, depart: number, units: number,
  driftTo: number,
) {
  const tides = Math.ceil(hopsFrom(brine, from).get(to)! / pace);
  const buy = unitPrice(good, brine.node(from).trade!, depart, 1, boomedAt(ctx, from, depart));
  // Prices at the far port drift back towards normal while the ship sails.
  let d = driftTo;
  for (let i = 0; i < tides; i++) d = driftNextTide(d);
  const sell = unitPrice(good, brine.node(to).trade!, depart + tides, d, boomedAt(ctx, to, depart + tides));
  return { tides, buy, profit: saleRevenue(sell, units) - buy * units };
}

/** The best leg from here, or null if nothing pays. */
function bestTrip(
  ship: Ship, gold: number, ctx: PortContext, drift: (p: string, g: Good) => number,
  policy: TraderPolicy, ports: readonly string[],
): Trip | null {
  const here = ship.nodeId;
  const pace = speed(ship.hull, ship.levels.sails);
  const capacity = holdFree(ship);
  let best: Trip | null = null;
  for (const to of ports) {
    if (to === here) continue;
    for (const good of GOODS) {
      const buy = buyPriceAt(here, good, ctx);
      const units = Math.min(capacity, Math.floor(gold / buy));
      if (units < 1) continue;
      const first = leg(ctx, pace, here, to, good, ctx.tide, units, drift(to, good));
      if (first.profit <= 0) continue;
      let profit = first.profit, tides = first.tides;
      if (policy.route === "careful") {
        // Add the best leg back out of the far port, with a full Hold and normal prices.
        let backScore = -Infinity, backProfit = 0, backTides = 0;
        for (const next of ports) {
          if (next === to) continue;
          for (const g of GOODS) {
            const back = leg(ctx, pace, to, next, g, ctx.tide + first.tides, capacity, 1);
            const score = (first.profit + back.profit) / (first.tides + back.tides);
            if (score > backScore) { backScore = score; backProfit = back.profit; backTides = back.tides; }
          }
        }
        profit += backProfit; tides += backTides;
      }
      const score = profit / tides;
      if (best === null || score > best.score) best = { good, to, tides: first.tides, units, score };
    }
  }
  return best;
}

/** Spend up to `budget` on the Shipwright (once saving has started) and on the cheapest upgrades. */
export function spend(
  ship: Ship, captain: Captain, budget: number, ctx: PortContext, policy: TraderPolicy,
  upgradeOrder: readonly Stat[] = UPGRADE_ORDER,
) {
  let money = budget;
  const actions: PortActionPayload[] = [];
  const pay = (r: { ship: Ship; captain: Captain }, cost: number) => { ship = r.ship; captain = r.captain; money -= cost; };

  if (totalLevels(ship) >= policy.saveFromLevels && nextHull(ship, ctx) !== null) {
    const instalment = Math.floor(B.shipwrightShareHint * money);
    if (instalment >= 1) {
      const amount = Math.min(instalment, captain.chestGold);
      const r = feedShipwright(ship, captain, amount, ctx);
      pay(r, r.paid);
      actions.push({ action: "shipwright", amount });
    }
  }
  for (;;) {
    const options = upgradeOrder
      .map((stat) => ({ stat, cost: nextUpgradeCost(ship, stat, ctx) }))
      .filter((o): o is { stat: Stat; cost: number } => o.cost !== null && o.cost <= money);
    if (options.length === 0) break;
    const pick = options.reduce((a, b) => (b.cost < a.cost ? b : a));
    pay(buyUpgrade(ship, captain, pick.stat, ctx), pick.cost);
    actions.push({ action: "upgrade", stat: pick.stat });
  }
  return { ship, captain, actions };
}
