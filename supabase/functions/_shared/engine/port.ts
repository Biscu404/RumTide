// Section 6 and section 15.4 (`port_action`): everything a docked captain can do, plus docking itself.
// Each function takes the ship, captain and market row as they are, checks the rules, and returns
// new objects. Nothing is changed in place, so a failed action leaves the state untouched.
// Rule breaks throw a PortError whose message is safe to show the player.

import { B, cargoValue, holdUnits, hullCost, maxHullPoints, upgradeCost } from "./balance.ts";
import { incomeBonus, type IncomeBonus, type IncomeFacts } from "./income.ts";
import type { GameMap, PortTrade } from "./map.ts";
import { GOODS, driftAfterSelling, saleRevenue, unitPrice } from "./market.ts";
import type { Captain, Good, HullId, MarketRow, SeasonSettings, Ship, Stat } from "./types.ts";

export class PortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortError";
  }
}

/** Hulls from smallest to largest. The Shipwright builds the next one along. */
export const HULL_ORDER: readonly HullId[] = ["sloop", "brigantine", "frigate"];

export interface PortContext {
  map: GameMap;
  tide: number;
  settings: Pick<SeasonSettings, "progressionCostMult" | "hullsEnabled">;
  /** The port with this week's Trade Winds boom, or null when there is none. */
  boomPortId: string | null;
  /** What Shore Leave, Fair Winds and the convoy bonus depend on. Without it a sale earns no bonus. */
  income?: IncomeFacts;
}

const fail = (message: string): never => { throw new PortError(message); };

/** Is this ship docked at a port? Returns that port's trade data, or throws. */
function dockedTrade(ship: Ship, ctx: PortContext): PortTrade {
  const node = ctx.map.node(ship.nodeId);
  if (!ship.docked || node.type !== "port" || !node.trade) return fail("The ship is not docked at a port");
  return node.trade;
}

const wholeUnits = (n: number, what: string) => {
  if (!Number.isInteger(n) || n < 1) fail(`${what} must be a whole number of at least 1`);
};

export const cargoUnits = (ship: Pick<Ship, "cargo">) => GOODS.reduce((t, g) => t + ship.cargo[g], 0);

/** Free space in the Hold, in cargo units. */
export const holdFree = (ship: Ship) => holdUnits(ship.hull, ship.levels.hold) - cargoUnits(ship);

/** Plunder gold plus the value of the cargo: the most a PvP hunter can take (section 9 rule 6). */
export const carriedValue = (ship: Ship, tide: number) =>
  ship.plunderGold + cargoValue(cargoUnits(ship), tide);

/** The most gold a winner can carry off from one battle: a full Hold of cargo at prize value (section 5.1). */
export const holdLootCap = (ship: Ship, tide: number) =>
  Math.floor(cargoValue(holdUnits(ship.hull, ship.levels.hold), tide));

export const maxHull = (ship: Ship) => maxHullPoints(ship.hull, ship.levels.hull);

// ---- Docking ----

export interface DockResult { ship: Ship; captain: Captain; banked: number; }

/** Section 4.4 rule 8: plunder is banked into the Chest, and Legend follows the profit banked (section 6.4). */
export function dock(ship: Ship, captain: Captain): DockResult {
  const banked = ship.plunderGold;
  return {
    ship: { ...ship, docked: true, plunderGold: 0 },
    captain: { ...captain, chestGold: captain.chestGold + banked, legend: captain.legend + banked * B.legend.perGoldProfit },
    banked,
  };
}

// ---- Trade ----

export interface TradeResult {
  ship: Ship; captain: Captain; row: MarketRow;
  units: number;
  /** Doubloons paid (buying) or received (selling), whole numbers. */
  gold: number;
  /** Selling only: revenue minus what the cargo cost. Can be negative. */
  profit: number;
  /** Selling only: the bonus on a profit, already in `captain`. Null when the sale earned none. */
  bonus: IncomeBonus | null;
}

function checkRow(row: MarketRow, ship: Ship, good: Good) {
  if (!GOODS.includes(good)) fail(`Unknown good ${String(good)}`);
  if (row.portId !== ship.nodeId || row.good !== good) fail("That market row is for another port or good");
}

export function buyGood(ship: Ship, captain: Captain, row: MarketRow, good: Good, units: number, ctx: PortContext): TradeResult {
  const trade = dockedTrade(ship, ctx);
  checkRow(row, ship, good);
  wholeUnits(units, "Units to buy");
  if (units > holdFree(ship)) fail(`The Hold has room for ${holdFree(ship)} more units`);
  // Buyers always pay the normal price. If a depressed price applied to buying too, a captain could sell
  // a lot, buy it back cheaper and repeat for free gold (docs/DECISIONS.md).
  const cost = Math.round(unitPrice(good, trade, ctx.tide, 1, ctx.boomPortId === ship.nodeId) * units);
  if (cost > captain.chestGold) fail(`That costs ${cost} doubloons and the Chest holds ${captain.chestGold}`);
  return {
    ship: {
      ...ship,
      cargo: { ...ship.cargo, [good]: ship.cargo[good] + units },
      cargoCostBasis: { ...ship.cargoCostBasis, [good]: ship.cargoCostBasis[good] + cost },
    },
    captain: { ...captain, chestGold: captain.chestGold - cost },
    row, units, gold: cost, profit: 0, bonus: null,
  };
}

export function sellGood(ship: Ship, captain: Captain, row: MarketRow, good: Good, units: number, ctx: PortContext): TradeResult {
  const trade = dockedTrade(ship, ctx);
  checkRow(row, ship, good);
  wholeUnits(units, "Units to sell");
  const held = ship.cargo[good];
  if (units > held) fail(`The Hold has only ${held} units of ${good}`);
  const start = unitPrice(good, trade, ctx.tide, row.drift, ctx.boomPortId === ship.nodeId);
  const revenue = Math.round(saleRevenue(start, units));
  const basisSold = ship.cargoCostBasis[good] * (units / held);
  const profit = revenue - basisSold;
  // Shore Leave, Fair Winds and the convoy top up a profit, never a loss (engine/income.ts).
  const bonus = ctx.income && profit > 0 ? incomeBonus(captain, ctx.tide, profit, ctx.income) : null;
  const extra = bonus?.extra ?? 0;
  return {
    ship: {
      ...ship,
      cargo: { ...ship.cargo, [good]: held - units },
      cargoCostBasis: { ...ship.cargoCostBasis, [good]: held === units ? 0 : ship.cargoCostBasis[good] - basisSold },
    },
    // Legend follows profit banked, so a sale at a loss earns nothing and costs nothing, and the bonus counts as profit.
    captain: {
      ...(bonus?.captain ?? captain), chestGold: captain.chestGold + revenue + extra,
      legend: captain.legend + (Math.max(0, profit) + extra) * B.legend.perGoldProfit,
    },
    row: { ...row, drift: driftAfterSelling(row.drift, units), soldThisTide: row.soldThisTide + units },
    units, gold: revenue, profit, bonus,
  };
}

// ---- Repairs ----

export interface RepairResult { ship: Ship; captain: Captain; points: number; cost: number; }

// Rounded up to a whole doubloon, ignoring float noise. Math.max also turns -0 into 0.
const roundCost = (x: number) => Math.max(0, Math.ceil(x - 1e-9));

/** Repair up to `maxPoints` hull points (default all), as many as the Chest can pay for. */
export function repairShip(ship: Ship, captain: Captain, ctx: PortContext, maxPoints = Infinity): RepairResult {
  dockedTrade(ship, ctx);
  const missing = maxHull(ship) - ship.hullPoints;
  const affordable = captain.chestGold / B.repair.costPerHullPoint;
  const points = Math.max(0, Math.min(missing, maxPoints, affordable));
  const cost = Math.min(roundCost(points * B.repair.costPerHullPoint), captain.chestGold);
  return {
    ship: { ...ship, hullPoints: ship.hullPoints + points },
    captain: { ...captain, chestGold: captain.chestGold - cost },
    points, cost,
  };
}

/** Section 5.1: the crew patch 10% of the hull per Tide at sea. */
export function patchAtSea(ship: Ship): Ship {
  const max = maxHull(ship);
  return { ...ship, hullPoints: Math.min(max, ship.hullPoints + B.repair.crewPatchAtSea * max) };
}

/** Section 7.2: a ship that Strikes its Colours is towed home with its hull half patched for free. */
export function patchAfterStrike(ship: Ship): Ship {
  const floor = B.repair.strikeFreePatch * maxHull(ship);
  return { ...ship, hullPoints: Math.max(ship.hullPoints, floor) };
}

// ---- Upgrades ----

export interface UpgradeResult { ship: Ship; captain: Captain; cost: number; level: number; }

/** Cost of the next level of a stat, or null at the top level. */
export function nextUpgradeCost(ship: Ship, stat: Stat, ctx: Pick<PortContext, "settings">): number | null {
  const level = ship.levels[stat];
  return level >= B.upgrade.maxLevel ? null : upgradeCost(level, ctx.settings.progressionCostMult);
}

export function buyUpgrade(ship: Ship, captain: Captain, stat: Stat, ctx: PortContext): UpgradeResult {
  dockedTrade(ship, ctx);
  if (!(stat in ship.levels)) fail(`Unknown stat ${String(stat)}`);
  const cost = nextUpgradeCost(ship, stat, ctx);
  if (cost === null) return fail(`${stat} is already at level ${B.upgrade.maxLevel}`);
  if (cost > captain.chestGold) return fail(`That costs ${cost} doubloons and the Chest holds ${captain.chestGold}`);
  const level = ship.levels[stat] + 1;
  const upgraded: Ship = { ...ship, levels: { ...ship.levels, [stat]: level } };
  // A bigger hull comes with the extra hull points, so buying it does not leave the ship looking damaged.
  if (stat === "hull") upgraded.hullPoints = ship.hullPoints + (maxHull(upgraded) - maxHull(ship));
  return { ship: upgraded, captain: { ...captain, chestGold: captain.chestGold - cost }, cost, level };
}

// ---- Shipwright ----

/** The hull the Shipwright is building: the next one this season allows, or null if the ship has the best. */
export function nextHull(ship: Ship, ctx: Pick<PortContext, "settings">): HullId | null {
  const from = HULL_ORDER.indexOf(ship.hull);
  return HULL_ORDER.slice(from + 1).find((h) => ctx.settings.hullsEnabled.includes(h)) ?? null;
}

export interface ShipwrightResult {
  ship: Ship; captain: Captain;
  /** Doubloons actually paid, which can be less than offered when the hull is nearly paid for. */
  paid: number;
  /** The new hull, set when this instalment finished it. */
  completed: HullId | null;
}

/** Feed the Shipwright's progress bar (section 5.2). The last instalment is trimmed to what is still owed. */
export function feedShipwright(ship: Ship, captain: Captain, amount: number, ctx: PortContext): ShipwrightResult {
  dockedTrade(ship, ctx);
  wholeUnits(amount, "The instalment");
  const target = nextHull(ship, ctx);
  if (target === null) return fail("There is no bigger hull to build this season");
  if (amount > captain.chestGold) return fail(`The Chest holds only ${captain.chestGold} doubloons`);
  const owed = hullCost(target, ctx.settings.progressionCostMult) - ship.shipwrightProgress;
  const paid = Math.min(amount, owed);
  const progress = ship.shipwrightProgress + paid;
  const done = progress >= hullCost(target, ctx.settings.progressionCostMult);
  const next: Ship = { ...ship, shipwrightProgress: done ? 0 : progress };
  if (done) {
    // Levels carry over. The new hull arrives fully repaired.
    next.hull = target;
    next.hullPoints = maxHullPoints(target, ship.levels.hull);
  }
  return {
    ship: next, captain: { ...captain, chestGold: captain.chestGold - paid },
    paid, completed: done ? target : null,
  };
}

// ---- Losses ----

export interface LossResult { ship: Ship; plunderLost: number; cargoLost: Record<Good, number>; }

/**
 * Take `fraction` of the plunder and cargo away (LootSettlement.lossFraction). Whole units and
 * doubloons, rounded to the nearest, with the cost basis shrinking in step with the cargo.
 */
export function applyLoss(ship: Ship, fraction: number): LossResult {
  const plunderLost = Math.min(ship.plunderGold, Math.round(ship.plunderGold * fraction));
  const cargo = { ...ship.cargo }, basis = { ...ship.cargoCostBasis };
  const cargoLost = { rum: 0, spice: 0, sugar: 0 } as Record<Good, number>;
  for (const good of GOODS) {
    const lost = Math.min(ship.cargo[good], Math.round(ship.cargo[good] * fraction));
    cargoLost[good] = lost;
    cargo[good] = ship.cargo[good] - lost;
    basis[good] = ship.cargo[good] === 0 ? 0 : ship.cargoCostBasis[good] * (cargo[good] / ship.cargo[good]);
  }
  return { ship: { ...ship, plunderGold: ship.plunderGold - plunderLost, cargo, cargoCostBasis: basis }, plunderLost, cargoLost };
}
