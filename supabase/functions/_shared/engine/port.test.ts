import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, SEASON_PRESETS, boom, cargoValue, holdUnits, maxHullPoints, upgradeCost } from "./balance.ts";
import { loadMap } from "./map.ts";
import { newMarket } from "./market.ts";
import {
  PortError, applyLoss, buyGood, buyUpgrade, carriedValue, cargoUnits, dock, feedShipwright, holdFree,
  holdLootCap, nextHull, nextUpgradeCost, patchAfterStrike, patchAtSea, repairShip, sellGood, type PortContext,
} from "./port.ts";
import { newCaptain, newShip } from "./state.ts";
import type { Captain, MarketRow, Ship } from "./types.ts";

const map = loadMap(brineJson);
const season0 = SEASON_PRESETS.season0;

const ctxAt = (tide = 1, over: Partial<PortContext> = {}): PortContext => ({
  map, tide, settings: { progressionCostMult: season0.progressionCostMult, hullsEnabled: [...season0.hullsEnabled] },
  boomPortId: null, ...over,
});
const market = newMarket(map, "s1");
const rowOf = (portId: string, good: MarketRow["good"]) => market.find((r) => r.portId === portId && r.good === good)!;

const start = (port = "port_regal", gold?: number): { ship: Ship; captain: Captain } => ({
  ship: newShip("anna", port),
  captain: { ...newCaptain("anna", "s1"), ...(gold === undefined ? {} : { chestGold: gold }) },
});

describe("newShip and newCaptain", () => {
  it("start as a docked level 0 sloop with the starting gold", () => {
    const { ship, captain } = start();
    expect(ship).toMatchObject({ hull: "sloop", docked: true, plunderGold: 0, shipwrightProgress: 0 });
    expect(ship.hullPoints).toBe(B.baseHull);
    expect(Object.values(ship.levels).every((l) => l === 0)).toBe(true);
    expect(captain.chestGold).toBe(B.startGold);
  });
});

describe("buying and selling", () => {
  it("buys a made good at the cheap price and fills the Hold", () => {
    const { ship, captain } = start();
    const r = buyGood(ship, captain, rowOf("port_regal", "sugar"), "sugar", 10, ctxAt(0));
    expect(r.gold).toBe(120);                       // 10 units at 12
    expect(r.captain.chestGold).toBe(0);
    expect(r.ship.cargo.sugar).toBe(10);
    expect(r.ship.cargoCostBasis.sugar).toBe(120);
    expect(holdFree(r.ship)).toBe(0);
    expect(ship.cargo.sugar).toBe(0);               // the inputs are not changed
  });

  it("refuses when the Hold is full, the Chest is short, or the amount is not a whole number", () => {
    const { ship, captain } = start("port_regal", 1000);
    const row = rowOf("port_regal", "sugar");
    expect(() => buyGood(ship, captain, row, "sugar", 11, ctxAt())).toThrow(/room for 10/);
    expect(() => buyGood(ship, { ...captain, chestGold: 50 }, row, "sugar", 5, ctxAt())).toThrow(/Chest/);
    expect(() => buyGood(ship, captain, row, "sugar", 1.5, ctxAt())).toThrow(PortError);
    expect(() => buyGood(ship, captain, row, "sugar", 0, ctxAt())).toThrow(PortError);
    expect(() => buyGood(ship, captain, row, "sugar", -2, ctxAt())).toThrow(PortError);
  });

  it("refuses to trade at sea, in a non port node, or with another port's market row", () => {
    const { ship, captain } = start();
    const row = rowOf("port_regal", "sugar");
    expect(() => buyGood({ ...ship, docked: false }, captain, row, "sugar", 1, ctxAt())).toThrow(/not docked/);
    expect(() => buyGood({ ...ship, nodeId: "sea01" }, captain, row, "sugar", 1, ctxAt())).toThrow(/not docked/);
    expect(() => buyGood(ship, captain, rowOf("saint_brine", "sugar"), "sugar", 1, ctxAt())).toThrow(/another port/);
    expect(() => buyGood(ship, captain, rowOf("port_regal", "rum"), "sugar", 1, ctxAt())).toThrow(/another port/);
  });

  it("sells a wanted good dear: the round trip of section 4.2 makes about 20 a unit", () => {
    const { ship, captain } = start("port_regal", 1000);
    const bought = buyGood(ship, captain, rowOf("port_regal", "sugar"), "sugar", 10, ctxAt(0));
    const sailed = { ...bought.ship, nodeId: "saint_brine" };
    const sold = sellGood(sailed, bought.captain, rowOf("saint_brine", "sugar"), "sugar", 10, ctxAt(0));
    // 10 units, each 1.5% cheaper than the last: 32 * (1 - 0.985^10) / 0.015
    expect(sold.gold).toBe(Math.round(32 * (1 - 0.985 ** 10) / 0.015));
    expect(sold.profit).toBe(sold.gold - 120);
    expect(sold.profit).toBeGreaterThan(150);
    expect(sold.profit).toBeLessThan(200);
    expect(sold.ship.cargo.sugar).toBe(0);
    expect(sold.ship.cargoCostBasis.sugar).toBe(0);
    expect(sold.captain.chestGold).toBe(880 + sold.gold);
  });

  it("lowers that port's price for the next seller, and records the sales", () => {
    const { ship, captain } = start("saint_brine");
    const held: Ship = { ...ship, cargo: { ...ship.cargo, sugar: 10 }, cargoCostBasis: { ...ship.cargoCostBasis, sugar: 100 } };
    const first = sellGood(held, captain, rowOf("saint_brine", "sugar"), "sugar", 5, ctxAt());
    expect(first.row.drift).toBeCloseTo(0.985 ** 5);
    expect(first.row.soldThisTide).toBe(5);
    const second = sellGood(first.ship, first.captain, first.row, "sugar", 5, ctxAt());
    expect(second.gold).toBeLessThan(first.gold);
  });

  it("takes the cost of the units sold and keeps the cost of the rest", () => {
    const { ship, captain } = start("saint_brine");
    const held: Ship = { ...ship, cargo: { ...ship.cargo, sugar: 10 }, cargoCostBasis: { ...ship.cargoCostBasis, sugar: 100 } };
    const sold = sellGood(held, captain, rowOf("saint_brine", "sugar"), "sugar", 4, ctxAt());
    expect(sold.ship.cargoCostBasis.sugar).toBeCloseTo(60);
    expect(sold.profit).toBeCloseTo(sold.gold - 40);
  });

  it("earns Legend on profit only, 1 per 10 doubloons", () => {
    const { ship, captain } = start("saint_brine");
    const held: Ship = { ...ship, cargo: { ...ship.cargo, sugar: 10 }, cargoCostBasis: { ...ship.cargoCostBasis, sugar: 120 } };
    const sold = sellGood(held, captain, rowOf("saint_brine", "sugar"), "sugar", 10, ctxAt(0));
    expect(sold.captain.legend).toBeCloseTo(sold.profit * B.legend.perGoldProfit);
    const dear: Ship = { ...held, cargoCostBasis: { ...held.cargoCostBasis, sugar: 10_000 } };
    const loss = sellGood(dear, captain, rowOf("saint_brine", "sugar"), "sugar", 10, ctxAt(0));
    expect(loss.profit).toBeLessThan(0);
    expect(loss.captain.legend).toBe(captain.legend);
  });

  describe("with the income bonuses (engine/income.ts)", () => {
    const held = (basis = 100): { ship: Ship; captain: Captain } => {
      const { ship, captain } = start("saint_brine");
      return { ship: { ...ship, cargo: { ...ship.cargo, sugar: 10 }, cargoCostBasis: { ...ship.cargoCostBasis, sugar: basis } }, captain };
    };
    const sell = (basis: number, captainPatch: Partial<Captain>, ctx: PortContext, units = 10, from = held(basis)) =>
      sellGood(from.ship, { ...from.captain, ...captainPatch }, rowOf("saint_brine", "sugar"), "sugar", units, ctx);

    it("earns no bonus when the context carries no income facts, as for a lone sim trader", () => {
      const r = sell(100, { shoreLeaveTides: 3, fairWinds: true }, ctxAt());
      expect(r.bonus).toBeNull();
      expect(r.captain.chestGold).toBe(B.startGold + r.gold);
      expect(r.captain.shoreLeaveTides).toBe(3);
    });

    it("tops a profit up by the bonus: gold, Legend and the extra shown separately from what the buyer paid", () => {
      const plain = sell(100, {}, ctxAt());
      const r = sell(100, { fairWinds: true }, ctxAt(1, { income: { convoyMates: 1 } }));
      const extra = Math.round(r.profit * (B.catchUp.fairWindsBonus + B.fleet.convoyPerMate));
      expect(r.gold).toBe(plain.gold);                        // what the market paid is unchanged
      expect(r.bonus).toMatchObject({ extra, fairWinds: true, convoyMates: 1 });
      expect(r.captain.chestGold).toBe(B.startGold + r.gold + extra);
      expect(r.captain.legend).toBeCloseTo((r.profit + extra) * B.legend.perGoldProfit);   // the bonus counts as profit banked
    });

    it("spends a stored Tide of Shore Leave on the first profitable sale, and every sale of that Tide gets it", () => {
      const ctx = ctxAt(4, { income: { convoyMates: 0 } });
      const first = sell(100, { shoreLeaveTides: 2 }, ctx, 5);
      expect(first.bonus!.extra).toBe(Math.round(first.profit * B.catchUp.shoreLeaveBonus));
      expect(first.captain).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 4 });
      const second = sellGood(first.ship, first.captain, first.row, "sugar", 5, ctx);
      expect(second.bonus!.extra).toBe(Math.round(second.profit * B.catchUp.shoreLeaveBonus));
      expect(second.captain).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 4 });   // not spent twice in one Tide
    });

    it("gives nothing on a sale at a loss and does not spend Shore Leave on it", () => {
      const ctx = ctxAt(4, { income: { convoyMates: 2 } });
      const r = sell(10_000, { shoreLeaveTides: 1, fairWinds: true }, ctx);
      expect(r.profit).toBeLessThan(0);
      expect(r.bonus).toBeNull();
      expect(r.captain.chestGold).toBe(B.startGold + r.gold);
      expect(r.captain).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 0 });
    });

    it("never pays a bonus on buying", () => {
      const { ship, captain } = start("port_regal", 1000);
      const bought = buyGood(ship, { ...captain, shoreLeaveTides: 1, fairWinds: true }, rowOf("port_regal", "sugar"), "sugar", 10,
        ctxAt(1, { income: { convoyMates: 2 } }));
      expect(bought.bonus).toBeNull();
      expect(bought.captain).toMatchObject({ chestGold: 1000 - bought.gold, shoreLeaveTides: 1 });
    });
  });

  it("charges buyers the normal price even after sellers have pushed the price down", () => {
    const { ship, captain } = start("port_regal", 1000);
    const dumped: MarketRow = { ...rowOf("port_regal", "sugar"), drift: 0.7 };
    expect(buyGood(ship, captain, dumped, "sugar", 10, ctxAt(0)).gold).toBe(120);
  });

  it("gives no free gold for selling at a port and buying the same goods back, however often", () => {
    let { ship, captain } = start("port_regal", 100_000);
    ship = { ...ship, cargo: { ...ship.cargo, rum: 10 }, cargoCostBasis: { ...ship.cargoCostBasis, rum: 100 } };
    let row = rowOf("port_regal", "rum");
    for (let i = 0; i < 20; i++) {
      const before = captain.chestGold;
      const sold = sellGood(ship, captain, row, "rum", 10, ctxAt(5));
      const bought = buyGood(sold.ship, sold.captain, sold.row, "rum", 10, ctxAt(5));
      ({ ship, captain, row } = bought);
      expect(captain.chestGold, `loop ${i}`).toBeLessThan(before);
    }
    expect(ship.cargo.rum).toBe(10);
  });

  it("refuses to sell what the Hold does not have", () => {
    const { ship, captain } = start("saint_brine");
    expect(() => sellGood(ship, captain, rowOf("saint_brine", "sugar"), "sugar", 1, ctxAt())).toThrow(/only 0/);
  });

  it("uses the boom price for the boomed port's wanted good", () => {
    const { ship, captain } = start("saint_brine");
    const held: Ship = { ...ship, cargo: { ...ship.cargo, sugar: 1 }, cargoCostBasis: { ...ship.cargoCostBasis, sugar: 12 } };
    const plain = sellGood(held, captain, rowOf("saint_brine", "sugar"), "sugar", 1, ctxAt(8));
    const boomed = sellGood(held, captain, rowOf("saint_brine", "sugar"), "sugar", 1, ctxAt(8, { boomPortId: "saint_brine" }));
    expect(boomed.gold).toBe(Math.round(20 * 2.0 * boom(8)));
    expect(plain.gold).toBe(Math.round(20 * 1.6 * boom(8)));
  });
});

describe("docking", () => {
  it("banks plunder into the Chest and counts it towards Legend", () => {
    const { ship, captain } = start();
    const r = dock({ ...ship, docked: false, plunderGold: 250 }, captain);
    expect(r.banked).toBe(250);
    expect(r.ship).toMatchObject({ docked: true, plunderGold: 0 });
    expect(r.captain.chestGold).toBe(B.startGold + 250);
    expect(r.captain.legend).toBeCloseTo(25);
  });
});

describe("repairs", () => {
  const damaged = (hp: number) => ({ ...start().ship, hullPoints: hp });

  it("charges 0.3 doubloons a hull point", () => {
    const r = repairShip(damaged(40), start().captain, ctxAt());
    expect(r.points).toBe(60);
    expect(r.cost).toBe(18);
    expect(r.ship.hullPoints).toBe(100);
    expect(r.captain.chestGold).toBe(B.startGold - 18);
  });

  it("repairs as much as the Chest can pay for, never more than the missing points", () => {
    const poor = { ...start().captain, chestGold: 6 };
    const r = repairShip(damaged(40), poor, ctxAt());
    expect(r.points).toBeCloseTo(20);
    expect(r.cost).toBe(6);
    expect(r.captain.chestGold).toBe(0);
    expect(repairShip(damaged(100), start().captain, ctxAt()).cost).toBe(0);
  });

  it("respects a smaller wish", () => {
    const r = repairShip(damaged(40), start().captain, ctxAt(), 10);
    expect(r.points).toBe(10);
    expect(r.cost).toBe(3);
  });

  it("needs a port", () => {
    expect(() => repairShip({ ...damaged(40), docked: false }, start().captain, ctxAt())).toThrow(/not docked/);
  });

  it("patches 10% of the hull a Tide at sea, never past full", () => {
    expect(patchAtSea({ ...damaged(40), docked: false }).hullPoints).toBeCloseTo(50);
    expect(patchAtSea(damaged(95)).hullPoints).toBe(100);
  });

  it("tows a struck ship home with the hull half patched", () => {
    expect(patchAfterStrike(damaged(0)).hullPoints).toBe(50);
    expect(patchAfterStrike(damaged(80)).hullPoints).toBe(80);
  });
});

describe("upgrades", () => {
  it("costs 40 for the first level in Season 0 and 60 in a full season", () => {
    const { ship, captain } = start();
    expect(nextUpgradeCost(ship, "cannons", ctxAt())).toBe(40);
    const r = buyUpgrade(ship, captain, "cannons", ctxAt());
    expect(r.cost).toBe(40);
    expect(r.level).toBe(1);
    expect(r.ship.levels.cannons).toBe(1);
    expect(r.captain.chestGold).toBe(80);
    const full = ctxAt(1, { settings: { progressionCostMult: 1, hullsEnabled: ["sloop"] } });
    expect(buyUpgrade(ship, captain, "cannons", full).cost).toBe(60);
  });

  it("follows the cost table of section 5.3 at full cost", () => {
    const table = [60, 81, 109, 148, 199, 269, 363, 490, 662, 894];
    expect(table.map((_, level) => upgradeCost(level))).toEqual(table);
  });

  it("charges each stat its own level", () => {
    let { ship, captain } = start("port_regal", 1000);
    ({ ship, captain } = buyUpgrade(ship, captain, "cannons", ctxAt()));
    expect(nextUpgradeCost(ship, "cannons", ctxAt())).toBe(54);
    expect(nextUpgradeCost(ship, "sails", ctxAt())).toBe(40);
  });

  it("stops at level 10", () => {
    const { ship, captain } = start("port_regal", 100_000);
    const maxed = { ...ship, levels: { ...ship.levels, crew: 10 } };
    expect(nextUpgradeCost(maxed, "crew", ctxAt())).toBeNull();
    expect(() => buyUpgrade(maxed, captain, "crew", ctxAt())).toThrow(/level 10/);
  });

  it("refuses when the Chest is short or the stat is unknown", () => {
    const { ship, captain } = start("port_regal", 39);
    expect(() => buyUpgrade(ship, captain, "cannons", ctxAt())).toThrow(/costs 40/);
    expect(() => buyUpgrade(ship, { ...captain, chestGold: 999 }, "luck" as never, ctxAt())).toThrow(/Unknown stat/);
  });

  it("raises Hold capacity by 12% of the base a level, rounded down to whole units", () => {
    expect(holdUnits("sloop", 0)).toBe(10);
    expect(holdUnits("sloop", 1)).toBe(11);   // 11.2
    expect(holdUnits("sloop", 5)).toBe(16);
    expect(holdUnits("sloop", 10)).toBe(22);
    expect(holdUnits("brigantine", 0)).toBe(16);
    expect(holdUnits("brigantine", 4)).toBe(23);   // 23.68
    expect(holdUnits("frigate", 0)).toBe(24);
    const { ship, captain } = start();
    const r = buyUpgrade(ship, captain, "hold", ctxAt());
    expect(holdFree(r.ship)).toBe(11);
  });

  it("adds hull points when the Hull stat goes up, so the ship is not left damaged", () => {
    const { ship, captain } = start();
    const r = buyUpgrade(ship, captain, "hull", ctxAt());
    expect(r.ship.hullPoints).toBeCloseTo(112);
    const hurt = buyUpgrade({ ...ship, hullPoints: 30 }, captain, "hull", ctxAt());
    expect(hurt.ship.hullPoints).toBeCloseTo(42);
    expect(maxHullPoints("sloop", 1)).toBeCloseTo(112);
  });

  it("is a purchase that needs a port", () => {
    const { ship, captain } = start();
    expect(() => buyUpgrade({ ...ship, docked: false }, captain, "sails", ctxAt())).toThrow(/not docked/);
  });
});

describe("the Shipwright", () => {
  const brigantine = Math.round(600 * 0.67);   // 402 in Season 0

  it("builds the Brigantine for 402 doubloons in Season 0, in instalments", () => {
    let { ship, captain } = start("port_regal", 1000);
    expect(nextHull(ship, ctxAt())).toBe("brigantine");
    let r = feedShipwright(ship, captain, 100, ctxAt());
    expect(r).toMatchObject({ paid: 100, completed: null });
    expect(r.ship.shipwrightProgress).toBe(100);
    expect(r.captain.chestGold).toBe(900);
    r = feedShipwright(r.ship, r.captain, 200, ctxAt());
    expect(r.ship.shipwrightProgress).toBe(300);
    r = feedShipwright(r.ship, r.captain, 500, ctxAt());   // only 102 is still owed
    expect(r.paid).toBe(brigantine - 300);
    expect(r.completed).toBe("brigantine");
    expect(r.ship.hull).toBe("brigantine");
    expect(r.ship.shipwrightProgress).toBe(0);
    expect(r.captain.chestGold).toBe(1000 - brigantine);
    ({ ship, captain } = r);
    expect(holdFree(ship)).toBe(16);
  });

  it("keeps upgrade levels and hands over a fully repaired new hull", () => {
    const { ship, captain } = start("port_regal", 1000);
    const upgraded = { ...ship, hullPoints: 70, levels: { ...ship.levels, cannons: 3, hull: 2 } };
    const r = feedShipwright(upgraded, captain, brigantine, ctxAt());
    expect(r.ship.levels).toEqual(upgraded.levels);
    expect(r.ship.hullPoints).toBeCloseTo(maxHullPoints("brigantine", 2));
  });

  it("costs 600 in a full season and then builds the Frigate for 2,400", () => {
    const full = ctxAt(1, { settings: { progressionCostMult: 1, hullsEnabled: ["sloop", "brigantine", "frigate"] } });
    const { ship, captain } = start("port_regal", 5000);
    const brig = feedShipwright(ship, captain, 600, full);
    expect(brig.completed).toBe("brigantine");
    expect(nextHull(brig.ship, full)).toBe("frigate");
    const frig = feedShipwright(brig.ship, brig.captain, 2400, full);
    expect(frig.completed).toBe("frigate");
    expect(nextHull(frig.ship, full)).toBeNull();
  });

  it("skips hulls the season does not allow", () => {
    const { ship } = start();
    expect(nextHull({ ...ship, hull: "brigantine" }, ctxAt())).toBeNull();   // Season 0 has no Frigate
    expect(nextHull(ship, ctxAt(1, { settings: { progressionCostMult: 1, hullsEnabled: ["sloop", "frigate"] } }))).toBe("frigate");
  });

  it("refuses when there is no bigger hull, the Chest is short or the amount is silly", () => {
    const { ship, captain } = start("port_regal", 50);
    expect(() => feedShipwright({ ...ship, hull: "brigantine" }, captain, 10, ctxAt())).toThrow(/no bigger hull/);
    expect(() => feedShipwright(ship, captain, 51, ctxAt())).toThrow(/Chest/);
    expect(() => feedShipwright(ship, captain, 0, ctxAt())).toThrow(PortError);
    expect(() => feedShipwright(ship, captain, 2.5, ctxAt())).toThrow(PortError);
    expect(() => feedShipwright({ ...ship, docked: false }, captain, 10, ctxAt())).toThrow(/not docked/);
  });
});

describe("carried value and losses", () => {
  const laden = (): Ship => ({
    ...start().ship, docked: false, plunderGold: 100,
    cargo: { rum: 5, spice: 0, sugar: 3 }, cargoCostBasis: { rum: 60, spice: 0, sugar: 30 },
  });

  it("counts plunder plus cargo at prize value, never the Chest", () => {
    expect(cargoUnits(laden())).toBe(8);
    expect(carriedValue(laden(), 10)).toBeCloseTo(100 + 8 * 19 * boom(10));
  });

  it("caps what a winner can carry off at a full Hold of cargo", () => {
    expect(holdLootCap(laden(), 10)).toBe(Math.floor(10 * 19 * boom(10)));
    expect(cargoValue(10, 0)).toBe(190);
  });

  it("takes the same share of plunder and every good, with the cost basis following", () => {
    const r = applyLoss(laden(), 0.4);
    expect(r.plunderLost).toBe(40);
    expect(r.cargoLost).toEqual({ rum: 2, spice: 0, sugar: 1 });
    expect(r.ship.plunderGold).toBe(60);
    expect(r.ship.cargo).toEqual({ rum: 3, spice: 0, sugar: 2 });
    expect(r.ship.cargoCostBasis.rum).toBeCloseTo(36);
    expect(r.ship.cargoCostBasis.sugar).toBeCloseTo(20);
  });

  it("takes nothing at 0 and everything at 1", () => {
    expect(applyLoss(laden(), 0).ship).toEqual(laden());
    const all = applyLoss(laden(), 1).ship;
    expect(all.plunderGold).toBe(0);
    expect(cargoUnits(all)).toBe(0);
    expect(all.cargoCostBasis).toEqual({ rum: 0, spice: 0, sugar: 0 });
  });
});
