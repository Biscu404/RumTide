import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, boom } from "./balance.ts";
import { loadMap } from "./map.ts";
import {
  GOODS, advanceMarket, driftAfterSelling, driftNextTide, newMarket, pickBoomPort, portMult,
  saleRevenue, unitPrice, weekOf, weeklyBoomActive,
} from "./market.ts";
import { createRng } from "./rng.ts";

const brine = loadMap(brineJson);
const trade = (id: string) => brine.node(id).trade!;

describe("the Brine's ports (section 4.2)", () => {
  it.each([
    ["port_regal", "sugar", "rum"],
    ["saint_brine", "spice", "sugar"],
    ["rumhaven", "rum", "spice"],
    ["gullrock", "spice", "rum"],
    ["driftwood_key", "sugar", "spice"],
  ] as const)("%s makes %s and wants %s", (port, makes, wants) => {
    expect(trade(port)).toEqual({ makes, wants });
  });

  it("has Last Lantern make nothing and want everything", () => {
    expect(trade("last_lantern")).toEqual({ makes: null, wants: "all" });
  });
});

describe("portMult", () => {
  it("sells the made good cheap, the wanted good dear and the third good at base", () => {
    const regal = trade("port_regal");   // makes sugar, wants rum
    expect(portMult("sugar", regal)).toBe(B.trade.madeMult);
    expect(portMult("rum", regal)).toBe(B.trade.wantedMult);
    expect(portMult("spice", regal)).toBe(1);
  });

  it("raises only the wanted good during a boom", () => {
    const regal = trade("port_regal");
    expect(portMult("rum", regal, true)).toBe(B.trade.weeklyBoomMult);
    expect(portMult("sugar", regal, true)).toBe(B.trade.madeMult);
    expect(portMult("spice", regal, true)).toBe(1);
  });

  it("pays a premium for everything at Last Lantern", () => {
    for (const good of GOODS) expect(portMult(good, trade("last_lantern"))).toBe(B.trade.lastLanternMult);
    expect(B.trade.lastLanternMult).toBeGreaterThan(B.trade.wantedMult);
  });
});

describe("unitPrice", () => {
  it("is base price times the port factor, the Boom and the drift", () => {
    expect(unitPrice("rum", trade("port_regal"), 0, 1)).toBeCloseTo(32);
    expect(unitPrice("sugar", trade("port_regal"), 0, 1)).toBeCloseTo(12);
    expect(unitPrice("rum", trade("port_regal"), 10, 0.9)).toBeCloseTo(32 * boom(10) * 0.9);
  });

  it("gives sugar from Port Regal to Saint Brine a margin of 20 doubloons a unit at Tide 0", () => {
    expect(unitPrice("sugar", trade("saint_brine"), 0, 1) - unitPrice("sugar", trade("port_regal"), 0, 1)).toBeCloseTo(20);
  });
});

describe("selling pushes the price down", () => {
  it("lowers the drift by 1.5% a unit sold", () => {
    expect(driftAfterSelling(1, 1)).toBeCloseTo(0.985);
    expect(driftAfterSelling(1, 10)).toBeCloseTo(0.985 ** 10);
    expect(driftAfterSelling(0.8, 0)).toBe(0.8);
  });

  it("pays each unit a little less than the one before", () => {
    expect(saleRevenue(30, 1)).toBeCloseTo(30);
    expect(saleRevenue(30, 2)).toBeCloseTo(30 + 30 * 0.985);
    let by = 0;
    for (let i = 0; i < 10; i++) by += 30 * 0.985 ** i;
    expect(saleRevenue(30, 10)).toBeCloseTo(by);
    expect(saleRevenue(30, 10)).toBeLessThan(300);
  });

  it("is the same whether you sell in one lot or two, so splitting a sale gains nothing", () => {
    const whole = saleRevenue(30, 10);
    const split = saleRevenue(30, 4) + saleRevenue(30 * driftAfterSelling(1, 4), 6);
    expect(split).toBeCloseTo(whole);
  });

  it("moves halfway back to normal each Tide", () => {
    expect(driftNextTide(0.8)).toBeCloseTo(0.9);
    expect(driftNextTide(driftNextTide(0.8))).toBeCloseTo(0.95);
    expect(driftNextTide(1)).toBe(1);
  });
});

describe("the market table", () => {
  const market = newMarket(brine, "s1");

  it("has a row for every port and good, in sorted order", () => {
    expect(market).toHaveLength(6 * 3);
    const keys = market.map((r) => `${r.portId}/${r.good}`);
    expect(keys).toEqual([...keys].sort());
    expect(market.every((r) => r.drift === 1 && r.soldThisTide === 0 && r.seasonId === "s1")).toBe(true);
  });

  it("drifts every row back and clears the sales counter when a Tide begins", () => {
    const sold = market.map((r, i) => (i === 0 ? { ...r, drift: 0.8, soldThisTide: 5 } : r));
    const next = advanceMarket(sold);
    expect(next[0]).toMatchObject({ drift: 0.9, soldThisTide: 0 });
    expect(next[1]!.drift).toBe(1);
    expect(sold[0]!.drift).toBe(0.8);   // the input is not changed
  });
});

describe("the Trade Winds boom", () => {
  it("starts in week 2 and never in Calm Seas week", () => {
    expect(weekOf(1)).toBe(1);
    expect(weekOf(7)).toBe(1);
    expect(weekOf(8)).toBe(2);
    expect(weekOf(14)).toBe(2);
    expect(weeklyBoomActive(7)).toBe(false);
    expect(weeklyBoomActive(8)).toBe(true);
    expect(weeklyBoomActive(14)).toBe(true);
  });

  it("picks a port other than Last Lantern, the same every time for one seed", () => {
    const picks = Array.from({ length: 200 }, (_, i) => pickBoomPort(brine, createRng(i)));
    expect(picks).not.toContain("last_lantern");
    expect(new Set(picks)).toEqual(new Set(["port_regal", "saint_brine", "rumhaven", "gullrock", "driftwood_key"]));
    expect(pickBoomPort(brine, createRng(7))).toBe(pickBoomPort(brine, createRng(7)));
  });
});
