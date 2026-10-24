// Drill, the sixth ship upgrade, and Fire Pots, the third supply (P3.B2 piece 2, docs/specs/boarding.md sections 2 and 4, D119 to D120, D141).

import { describe, expect, it } from "vitest";
import {
  B, CARGO_GOODS, GOODS, SEASON_PRESETS, carriesCargo, drillBonus, drillCap, drillCost, drillFactor, drillOf, drillStage, drillUnlocked, emptyHold,
  holdUsed, maxHands, newShip, powerRating, upgradeCost, zeroLevels,
} from "./index.ts";
import type { FightingStyle, Ship } from "./index.ts";
import { carriedBy, jettison } from "./combat/loot.ts";
import { applyBattle, battleShipOf, towShip } from "./combat/encounter.ts";
import { runBattle } from "./combat/battle.ts";
import { always, battleOf, scripted, testShip } from "./combat/testing.ts";
import { season, ship, world } from "./testing.ts";

const fresh = (style?: FightingStyle, hull: "sloop" | "brigantine" = "sloop"): Ship => newShip("s", "c", "S", hull, "gh_harbour", true, style);

describe("Drill, the Hands track (boarding spec section 4)", () => {
  it("is a sixth stat of a ship that starts at 0, with the other five", () => {
    expect(zeroLevels()).toEqual({ hull: 0, cannons: 0, sails: 0, berths: 0, hold: 0, drill: 0 });
    expect(fresh().levels.drill).toBe(0);
    expect(drillOf(fresh())).toBe(0);
    expect(drillOf({ levels: { hull: 0, cannons: 0, sails: 0, berths: 0, hold: 0 } } as unknown as Ship)).toBe(0); // a ship saved before Drill
  });

  it("goes 0 to 15 in three stages of five: Deckhands 1 to 5, Cutthroats 6 to 10, Sea Wolves 11 to 15", () => {
    expect(B.drill.stageSize).toBe(5);
    expect(B.drill.perLevel).toHaveLength(3);
    expect([0, 1, 5, 6, 10, 11, 15].map(drillStage)).toEqual([-1, 0, 0, 1, 1, 2, 2]);
    expect(drillStage(99)).toBe(2); // never past the last stage
  });

  it("caps at 15 in both seasons (D120)", () => {
    expect(drillCap("season0")).toBe(15);
    expect(drillCap("season1")).toBe(15);
    expect(SEASON_PRESETS.season0.drillMaxLevel).toBe(15);
    expect(SEASON_PRESETS.season1.drillMaxLevel).toBe(15);
  });

  it("adds boarding strength for every level, more in later stages", () => {
    const per = B.drill.perLevel;
    expect(per[0]! < per[1]! && per[1]! < per[2]!).toBe(true);
    expect(drillBonus(0)).toBe(0);
    expect(drillBonus(1)).toBeCloseTo(per[0]!);
    expect(drillBonus(5)).toBeCloseTo(5 * per[0]!);
    expect(drillBonus(6)).toBeCloseTo(5 * per[0]! + per[1]!);
    expect(drillBonus(10)).toBeCloseTo(5 * per[0]! + 5 * per[1]!);
    expect(drillBonus(15)).toBeCloseTo(5 * per[0]! + 5 * per[1]! + 5 * per[2]!);
    expect(drillBonus(15)).toBeCloseTo(0.9);
    expect(drillFactor(0)).toBe(1);
    expect(drillFactor(15)).toBeCloseTo(1.9);
    expect(drillFactor(99)).toBeCloseTo(drillFactor(15) + 84 * per[2]!); // the formula does not stop at the cap: the cap is for buying
  });

  it("prices the Nth level of Drill like the Nth level of any other upgrade, with the season's multiplier (D141)", () => {
    for (let level = 0; level < 15; level++) {
      expect(drillCost(level), `level ${level + 1}`).toBe(upgradeCost(level));
      expect(drillCost(level, SEASON_PRESETS.season0.progressionCostMult)).toBe(Math.round(60 * 1.35 ** level * 0.67));
    }
    expect([0, 1, 2, 9].map((l) => drillCost(l))).toEqual([60, 81, 109, 894]);
    expect(drillCost(14)).toBeGreaterThan(drillCost(4)); // and the later stages cost more because every upgrade does
  });

  it("finishing a stage unlocks Fire Pots at 5, Grapnels at 10 and Second Wave at 15", () => {
    expect(B.drill.unlocks).toEqual({ firePots: 5, grapnels: 10, secondWave: 15 });
    for (const [unlock, at] of Object.entries(B.drill.unlocks) as ["firePots" | "grapnels" | "secondWave", number][]) {
      expect(drillUnlocked(at - 1, unlock), `${unlock} just before`).toBe(false);
      expect(drillUnlocked(at, unlock), `${unlock} at ${at}`).toBe(true);
      expect(drillUnlocked(15, unlock)).toBe(true);
    }
  });

  it("is carried into a battle with the ship, and absent from a ship with none", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull" }]);
    const flags = { charted: false, withCurrent: false, lurker: false };
    expect(battleShipOf(ship(s, "a"), s.captains.a!, "hunter", flags)).not.toHaveProperty("drill");
    ship(s, "a").levels.drill = 7;
    expect(battleShipOf(ship(s, "a"), s.captains.a!, "hunter", flags).drill).toBe(7);
  });

  it("belongs to the ship: a tow, a Capture and a Sunk ship leave it alone", () => {
    const s = season([{ id: "h", name: "H", shipName: "Hunter", water: "gh_lee" }, { id: "t", name: "T", shipName: "Target", water: "gh_lee" }], 5);
    ship(s, "t").levels.drill = 9;
    ship(s, "h").levels.drill = 4;
    const record = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("hold", "holdFire"), target: always("hold", "holdFire") }, { at: "gh_lee" }));
    for (const kind of ["captured", "sunk"] as const) {
      applyBattle({
        state: s, record: { ...record, outcome: { kind, winner: "hunter", loser: "target", round: 3 } },
        ships: { hunter: ship(s, "h"), target: ship(s, "t") }, captains: { hunter: s.captains.h!, target: s.captains.t! },
        powerRatings: { hunter: 10, target: 10 }, mutual: false, inCradle: false, refusedParley: false,
      });
    }
    towShip(world, s, ship(s, "t"), s.captains.t!, { cradle: { kind: "breeze", from: 270 } });
    expect(ship(s, "t").levels.drill).toBe(9);
    expect(ship(s, "h").levels.drill).toBe(4);
  });
});

describe("Power Rating counts Drill (boarding spec section 4, D144)", () => {
  /** The rating of a D26 sum S: 10 x (S / 10) ^ 1.6. */
  const rated = (sum: number) => 10 * (sum / 10) ** B.power.exponent;

  it("counts Hands times the Drill factor: a fresh sloop is 10, and a fully drilled crew counts for 1.9 times as many", () => {
    const sh = fresh();
    expect(powerRating(sh)).toBe(10);
    sh.levels.drill = 15;
    expect(powerRating(sh)).toBeCloseTo(rated((10 + 10 + 10 + (30 * 1.9) / 3) / 4), 10); // about 13.8
    expect(powerRating(sh)).toBeGreaterThan(13.5);
    expect(powerRating(sh)).toBeLessThan(14);
  });

  it("grows with every level of Drill, and by more for the later levels as the strength does", () => {
    const rating = (level: number) => { const sh = fresh(); sh.levels.drill = level; return powerRating(sh); };
    const ratings = Array.from({ length: 16 }, (_, l) => rating(l));
    for (let l = 1; l <= 15; l++) expect(ratings[l]!).toBeGreaterThan(ratings[l - 1]!);
    expect(rating(11) - rating(10)).toBeGreaterThan(rating(1) - rating(0));
  });

  it("counts the Hands aboard now: a drilled ship that lost its crew rates lower (D74)", () => {
    const sh = fresh();
    sh.levels.drill = 10;
    const full = powerRating(sh);
    sh.hands = 15;
    expect(powerRating(sh)).toBeLessThan(full);
    expect(powerRating(sh)).toBeCloseTo(rated((10 + 10 + 10 + (15 * 1.5) / 3) / 4), 10);
  });

  it("agrees with D144: styles do not change the rating, and a Bombardier counts its Hands against its own crew, drilled or not", () => {
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"] as const) {
      const sh = fresh(style);
      sh.levels.drill = 10;
      expect(powerRating(sh), style).toBeCloseTo(rated((10 + 10 + 10 + (30 * 1.5) / 3) / 4), 10);
    }
    expect(powerRating(fresh("bombardier"))).toBe(10);
    const bomb = fresh("bombardier");
    bomb.levels.drill = 5;
    const sloop = fresh();
    sloop.levels.drill = 5;
    expect(bomb.hands).toBe(18);
    expect(powerRating(bomb)).toBeCloseTo(powerRating(sloop), 10);
  });

  it("is the same for a bigger hull, whose Hands term is that hull's", () => {
    const brig = fresh(undefined, "brigantine");
    const before = powerRating(brig);
    brig.levels.drill = 15;
    const gain = powerRating(brig) - before;
    expect(gain).toBeGreaterThan(0);
    expect(brig.hands).toBe(maxHands(brig));
  });

  it("puts a fully drilled crew inside the fairness line: about 1.38 times the rating of a fresh sloop", () => {
    const sh = fresh();
    sh.levels.drill = 15;
    expect(powerRating(sh) / powerRating(fresh())).toBeCloseTo(1.38, 1);
  });
});

describe("Fire Pots, the third supply (boarding spec section 2)", () => {
  it("is a Good with a start of none, a price and a hold space", () => {
    expect(GOODS).toContain("firePots");
    expect(CARGO_GOODS).not.toContain("firePots"); // a supply, like Provisions and Powder, not loot
    expect(B.start.firePots).toBe(0);
    expect(B.supplies.firePotPrice).toBeGreaterThan(0);
    expect(B.holdSpace.firePots).toBe(0.5);
    expect(emptyHold().firePots).toBe(0);
  });

  it("starts a captain with none, and a Firebrand with its startPots (2)", () => {
    expect(fresh().hold.firePots).toBe(0);
    expect(fresh("boarder").hold.firePots).toBe(0);
    expect(fresh("firebrand").hold.firePots).toBe(B.styles.firebrand.startPots);
    expect(B.styles.firebrand.startPots).toBe(2);
    expect(fresh("firebrand").hold.powder).toBe(B.start.powder);
  });

  it("takes Hold space, half a unit each, like Powder", () => {
    const sh = fresh();
    const before = holdUsed(sh);
    sh.hold.firePots = 4;
    expect(holdUsed(sh)).toBe(before + 4 * B.holdSpace.firePots);
    expect(holdUsed(fresh("firebrand"))).toBe(holdUsed(fresh()) + 1);
  });

  it("is used up one at a time when a pot is thrown, and the battle writes what is left back to the hold", () => {
    const s = season([{ id: "h", name: "H", shipName: "Hunter", water: "gh_lee" }, { id: "t", name: "T", shipName: "Target", water: "gh_lee", style: "firebrand" }], 5);
    const flags = { charted: false, withCurrent: false, lurker: false };
    const h = battleShipOf(ship(s, "h"), s.captains.h!, "hunter", flags);
    const t = battleShipOf(ship(s, "t"), s.captains.t!, "target", flags);
    expect(h).not.toHaveProperty("firePots");
    expect(t.firePots).toBe(2);
    const record = runBattle(battleOf(h, t, {
      hunter: scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "charge"]), target: always("hold", "firePots"),
    }, { ambush: "medium", at: "gh_lee" }));
    const thrown = record.rounds.filter((r) => r.ships[1]!.deck?.thrown).length;
    expect(thrown).toBe(2);
    expect(record.final[1]!.firePots).toBe(0);
    applyBattle({
      state: s, record, ships: { hunter: ship(s, "h"), target: ship(s, "t") }, captains: { hunter: s.captains.h!, target: s.captains.t! },
      powerRatings: { hunter: 10, target: 10 }, mutual: false, inCradle: false, refusedParley: false,
    });
    expect(ship(s, "t").hold.firePots).toBe(0);
    expect(ship(s, "h").hold.firePots).toBe(0);
  });

  it("is not loot: it is not in what a ship carries, the Flotsam it throws overboard, or the Wreck it leaves", () => {
    const sh = fresh("firebrand");
    sh.hold.rum = 3;
    sh.plunder = 10;
    expect(carriedBy(sh)).toEqual({ plunder: 10, goods: { rum: 3 } });
    expect(carriesCargo(fresh("firebrand"))).toBe(false); // pots alone are no cargo for a hunter to chase
    const thrown = jettison(carriedBy(sh), "ship_s", "gh_lee", 5);
    expect(JSON.stringify(thrown)).not.toContain("firePots");
  });

  it("stays in the hold through a tow", () => {
    const s = season([{ id: "t", name: "T", shipName: "Target", water: "gh_lee", style: "firebrand" }], 5);
    towShip(world, s, ship(s, "t"), s.captains.t!, { cradle: { kind: "breeze", from: 270 } });
    expect(ship(s, "t").hold.firePots).toBe(2);
    expect(ship(s, "t").docked).toBe(true);
  });
});
