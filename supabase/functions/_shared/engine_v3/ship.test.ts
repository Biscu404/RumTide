import { describe, expect, it } from "vitest";
import { B, holdCapacity, holdUsed, maxHands, maxHullPoints, newShip, powerRating, upgradeCost, watchesFor } from "./index.ts";
import type { FightingStyle } from "./index.ts";
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

describe("Power Rating (D26, D136, P2.4)", () => {
  /** The rating of a D26 sum S: 10 x (S / 10) ^ 1.6. */
  const rated = (sum: number) => 10 * (sum / 10) ** B.power.exponent;

  it("rates a fresh sloop 10: a quarter of Hull / 10 + Cannons + Sails + Hands / 3, and the exponent pivots there", () => {
    const { ship: sh } = setup();
    expect(B.power.exponent).toBe(1.6);
    expect(powerRating(sh)).toBe(10);
  });

  it("grows faster than the stats with upgrades and a bigger hull (D136)", () => {
    const { ship: sh } = setup();
    sh.levels = { hull: 5, cannons: 5, sails: 5, berths: 5, hold: 0, drill: 0 };
    sh.hands = maxHands(sh);
    expect(powerRating(sh)).toBeCloseTo(rated(16), 10); // a sum of 16 rates about 21.2
    expect(powerRating(sh)).toBeGreaterThan(21);
    const brig = setup("brigantine").ship;
    expect(powerRating(brig)).toBeCloseTo(rated((135 / 10 + 13.5 + 13.5 + 60 / 3) / 4), 10);
  });

  it("counts the Hands aboard now, not the most it could carry", () => {
    const { ship: sh } = setup();
    sh.hands = 0;
    expect(powerRating(sh)).toBeCloseTo(rated(7.5), 10);
  });

  it("is the same for every style: a Bombardier's smaller crew counts against its own size, so it is not lower", () => {
    const fresh = (style?: FightingStyle) => newShip("s", "c", "S", "sloop", "gh_harbour", true, style);
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"] as const) {
      expect(powerRating(fresh(style)), style).toBe(10);
    }
    const bomb = fresh("bombardier");
    expect(bomb.hands).toBe(18);
    bomb.hands = 9; // half its crew rates like a sloop with half of its 30
    const half = fresh();
    half.hands = 15;
    expect(powerRating(bomb)).toBeCloseTo(powerRating(half), 10);
    bomb.levels.berths = 5;
    bomb.hands = maxHands(bomb);
    const full = fresh();
    full.levels.berths = 5;
    full.hands = maxHands(full);
    expect(powerRating(bomb)).toBeCloseTo(powerRating(full), 10);
  });
});

describe("a Bombardier's small crew (spec section 3)", () => {
  it("sails with 60% of the Hands, wherever max Hands is read", () => {
    const bomb = newShip("s", "c", "S", "sloop", "gh_harbour", true, "bombardier");
    expect(bomb.style).toBe("bombardier");
    expect(maxHands(bomb)).toBe(18);
    expect(bomb.hands).toBe(18);
    expect(maxHands(newShip("s", "c", "S", "brigantine", "gh_harbour", true, "bombardier"))).toBe(36);
    bomb.levels.berths = 5;
    expect(maxHands(bomb)).toBe(Math.floor(30 * 1.6 * 0.6));
    expect(maxHands(newShip("s", "c", "S", "sloop", "gh_harbour", true, "gunline"))).toBe(30);
    expect(newShip("s", "c", "S", "sloop", "gh_harbour", true)).not.toHaveProperty("style");
  });

  it("judges low Hands for the Watches against its own crew", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull" }]);
    const bomb = newShip("ship_a", "a", "Gull", "sloop", "gh_harbour", true, "bombardier");
    expect(watchesFor(bomb, s.captains.a!).penalties).toEqual([]);
    bomb.hands = 7; // under 40% of 18
    expect(watchesFor(bomb, s.captains.a!).penalties).toEqual(["lowHands"]);
  });
});

