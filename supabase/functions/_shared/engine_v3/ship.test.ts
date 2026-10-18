import { describe, expect, it } from "vitest";
import { B, holdCapacity, holdUsed, maxHands, maxHullPoints, powerRating, upgradeCost, watchesFor } from "./index.ts";
import { season, ship } from "./testing.ts";

const setup = (hull: "sloop" | "brigantine" | "frigate" = "sloop") => {
  const s = season([{ id: "a", name: "A", shipName: "Gull", hull }]);
  return { captain: s.captains.a!, ship: ship(s, "a") };
};

describe("ships (P1.5, GAMEPLAY 6)", () => {
  it("starts a fresh sloop full and fit to sail", () => {
    const { ship: sh } = setup();
    expect(sh.hullPoints).toBe(100);
    expect(sh.riggingPoints).toBe(100);
    expect(sh.hands).toBe(30);
    expect(holdUsed(sh)).toBe(5); // 4 Provisions and 6 Powder at half a unit each
    expect(holdCapacity(sh)).toBe(10);
  });

  it("grows stats linearly with levels", () => {
    const { ship: sh } = setup("brigantine");
    expect(maxHullPoints(sh)).toBe(135);
    sh.levels.berths = 5;
    expect(maxHands(sh)).toBe(Math.floor(60 * 1.6));
  });

  it("prices upgrades exponentially, as v0.2 5.3", () => {
    expect([0, 1, 2, 9].map((l) => upgradeCost(l))).toEqual([60, 81, 109, 894]);
    expect(upgradeCost(0, 0.67)).toBe(40);
  });
});

describe("Watches (P1.5, GAMEPLAY 3.1)", () => {
  it("starts from the hull's base", () => {
    expect(watchesFor(setup("sloop").ship, setup().captain).total).toBe(6);
    const f = setup("frigate");
    expect(watchesFor(f.ship, f.captain).total).toBe(7);
  });

  it("adds Sails level 5, Seamanship rank 2 and a Navigator, up to the cap", () => {
    const f = setup("frigate");
    f.ship.levels.sails = 5;
    f.captain.skills.seamanship = 2;
    f.captain.perks = ["navigator.watch", "trinket.watch"];
    const w = watchesFor(f.ship, f.captain);
    expect(w.bonuses).toEqual(["sails", "seamanship", "navigator", "trinket"]);
    expect(w.total).toBe(B.watches.cap);
  });

  it("takes one Watch each for low Hands, Short Rations and a heavy hold", () => {
    const { ship: sh, captain } = setup();
    sh.hands = 11; // under 40% of 30
    sh.shortRations = true;
    sh.hold.rum = 4; // 9 of 10 units used
    const w = watchesFor(sh, captain);
    expect(w.penalties).toEqual(["lowHands", "shortRations", "heavyHold"]);
    expect(w.total).toBe(3);
  });

  it("never drops below the minimum", () => {
    const { ship: sh, captain } = setup();
    sh.hands = 0; sh.shortRations = true; sh.hold.rum = 9;
    expect(watchesFor(sh, captain).total).toBeGreaterThanOrEqual(B.watches.min);
  });
});

describe("Power Rating (D26, P2.4)", () => {
  it("rates a fresh sloop 10: a quarter of Hull / 10 + Cannons + Sails + Hands / 3", () => {
    const { ship: sh } = setup();
    expect(powerRating(sh)).toBe(10);
  });

  it("grows with upgrades and a bigger hull", () => {
    const { ship: sh } = setup();
    sh.levels = { hull: 5, cannons: 5, sails: 5, berths: 5, hold: 0 };
    sh.hands = maxHands(sh);
    expect(powerRating(sh)).toBeCloseTo(16, 10);
    const brig = setup("brigantine").ship;
    expect(powerRating(brig)).toBeCloseTo((135 / 10 + 13.5 + 13.5 + 60 / 3) / 4, 10);
  });

  it("counts the Hands aboard now, not the most it could carry", () => {
    const { ship: sh } = setup();
    sh.hands = 0;
    expect(powerRating(sh)).toBe(7.5);
  });
});
