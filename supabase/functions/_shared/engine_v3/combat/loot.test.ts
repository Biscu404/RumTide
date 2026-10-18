import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { Rng } from "../rng.ts";
import { emptyHold, newShip } from "../ship.ts";
import { CARGO_GOODS } from "../types.ts";
import { cargoValue, capturePick, carriedBy, fairnessFactor, jettison, lootMultiplier, lootShare, settleLoot } from "./loot.ts";
import type { Carried, LootInput } from "./loot.ts";
import { deepFreeze } from "./testing.ts";
import type { OutcomeKind } from "./types.ts";

const L = B.loot;
const F = B.fairness;
const PRICE = B.economy.basePrice;
const OUTCOMES: OutcomeKind[] = ["sunk", "captured", "struckColours", "crippled", "escaped", "victory", "draw"];

/** 100 doubloons and 10 rum and 4 spice: 380 doubloons at the default price, well under the cap. */
const carried = (): Carried => ({ plunder: 100, goods: { rum: 10, spice: 4 } });

/** An even PvP-free fight (an NPC loser) unless the test says otherwise. */
const input = (over: Partial<LootInput> = {}): LootInput => ({
  outcome: "captured", loser: "ship_loser", carried: carried(), at: "dw_shallows", tide: 5,
  pvp: false, inCradle: false, loserPR: 10, winnerPR: 10, ...over,
});

describe("the fairness factor (P2.2, GAME_DESIGN 9 rule 1)", () => {
  it("is 1 between equal ships", () => {
    expect(fairnessFactor(10, 10)).toBe(1);
  });

  it("squares the ratio when the winner is stronger", () => {
    expect(fairnessFactor(8, 10)).toBeCloseTo(0.64);
    expect(fairnessFactor(6, 10)).toBeCloseTo(0.36);
  });

  it("floors at 0.25 for a bully, so a much stronger winner still takes a quarter of a fair share", () => {
    expect(fairnessFactor(5, 10)).toBe(F.floor); // exactly the floor
    expect(fairnessFactor(3, 10)).toBe(F.floor);
    expect(fairnessFactor(0, 10)).toBe(F.floor);
    expect(fairnessFactor(10, 30)).toBe(F.floor); // three equal ships against one are judged as three to one
  });

  it("is loser PR over winner PR for an underdog, capped at 1.5 (David's Due)", () => {
    expect(fairnessFactor(12, 10)).toBeCloseTo(1.2);
    expect(fairnessFactor(15, 10)).toBe(F.underdogCap);
    expect(fairnessFactor(40, 10)).toBe(F.underdogCap);
  });

  it("does not divide by zero", () => {
    expect(fairnessFactor(10, 0)).toBe(F.underdogCap);
    expect(fairnessFactor(0, 0)).toBe(1);
  });
});

describe("the multiplier (P2.2, D57)", () => {
  it("is fairness times the Cradle's half, for PvP only", () => {
    expect(lootMultiplier({ pvp: true, inCradle: false, loserPR: 5, winnerPR: 10 })).toEqual({ fairness: 0.25, cradle: 1, total: 0.25 });
    expect(lootMultiplier({ pvp: true, inCradle: true, loserPR: 10, winnerPR: 10 })).toEqual({ fairness: 1, cradle: L.cradlePvp, total: L.cradlePvp });
    expect(lootMultiplier({ pvp: true, inCradle: true, loserPR: 5, winnerPR: 10 }).total).toBe(0.25 * L.cradlePvp);
  });

  it("leaves a fight against an NPC alone, Cradle or not", () => {
    expect(lootMultiplier({ pvp: false, inCradle: true, loserPR: 1, winnerPR: 100 })).toEqual({ fairness: 1, cradle: 1, total: 1 });
  });
});

describe("the outcome table (P2.2, GAMEPLAY 8.7)", () => {
  it("pays 25% for Sunk, 40% for Captured, 15% for Struck Colours and 20% for Victory", () => {
    expect(lootShare("sunk")).toBe(0.25);
    expect(lootShare("captured")).toBe(0.4);
    expect(lootShare("struckColours")).toBe(0.15);
    expect(lootShare("victory")).toBe(0.2);
  });

  it("pays nothing for Crippled, Escaped or a Draw", () => {
    for (const kind of ["crippled", "escaped", "draw"] as const) {
      expect(lootShare(kind)).toBe(0);
      const r = settleLoot(input({ outcome: kind }));
      expect(r.taken).toEqual({ plunder: 0, goods: {} });
      expect(r.lost).toEqual({ plunder: 0, goods: {} });
      expect(r.wreck).toBeNull();
      expect(r.pick).toBeNull();
    }
  });

  it("takes the table's share of plunder and of every good, rounded down", () => {
    expect(settleLoot(input({ outcome: "captured" })).taken).toEqual({ plunder: 40, goods: { rum: 4, spice: 1 } });
    expect(settleLoot(input({ outcome: "struckColours" })).taken).toEqual({ plunder: 15, goods: { rum: 1 } });
    expect(settleLoot(input({ outcome: "victory" })).taken).toEqual({ plunder: 20, goods: { rum: 2 } });
    expect(settleLoot(input({ outcome: "sunk" })).taken).toEqual({ plunder: 25, goods: { rum: 2, spice: 1 } });
  });

  it("takes exactly what the loser gives up, for every outcome but Sunk", () => {
    for (const outcome of ["captured", "struckColours", "victory"] as const) {
      const r = settleLoot(input({ outcome }));
      expect(r.lost).toEqual(r.taken);
      expect(r.wreck).toBeNull();
    }
  });

  it("reports the share, the fairness and the Cradle it used", () => {
    const r = settleLoot(input({ outcome: "captured", pvp: true, inCradle: true, loserPR: 5, winnerPR: 10 }));
    expect(r).toMatchObject({ outcome: "captured", share: 0.4, fairness: 0.25, cradle: 0.5 });
    expect(r.fraction).toBeCloseTo(0.4 * 0.25 * 0.5);
  });
});

describe("Sunk: a grab and a Wreck (P2.2, GAMEPLAY 8.7)", () => {
  it("lets the winner grab 25% and leaves the rest of what the loser carried in a Wreck for 4 Tides", () => {
    const r = settleLoot(input({ outcome: "sunk", tide: 5 }));
    expect(r.taken).toEqual({ plunder: 25, goods: { rum: 2, spice: 1 } });
    expect(r.lost).toEqual({ plunder: 100, goods: { rum: 10, spice: 4 } });
    expect(r.wreck).toEqual({ id: "wreck_t5_ship_loser", water: "dw_shallows", goods: { rum: 8, spice: 3 }, plunder: 75, untilTide: 5 + L.wreckTides });
  });

  it("splits what the loser carried between the winner and the Wreck, with nothing created or lost", () => {
    const r = settleLoot(input({ outcome: "sunk" }));
    for (const good of CARGO_GOODS) {
      expect((r.taken.goods[good] ?? 0) + (r.wreck?.goods[good] ?? 0)).toBe(r.lost.goods[good] ?? 0);
    }
    expect(r.taken.plunder + (r.wreck?.plunder ?? 0)).toBe(r.lost.plunder);
  });

  it("is smaller for a bully, so fairness protects the sunk captain as well as paying the winner less", () => {
    const r = settleLoot(input({ outcome: "sunk", pvp: true, loserPR: 3, winnerPR: 10 }));
    expect(r.fairness).toBe(F.floor);
    expect(r.taken.plunder).toBe(6); // 100 x 0.25 x 0.25 = 6.25
    expect(r.lost.plunder).toBe(25); // the loser gives up only a quarter of what it carried
    expect(r.wreck?.plunder).toBe(19);
  });

  it("is halved in the Cradle for PvP, for the loser too", () => {
    const r = settleLoot(input({ outcome: "sunk", pvp: true, inCradle: true }));
    expect(r.lost.plunder).toBe(50);
    expect(r.taken.plunder).toBe(12); // 100 x 0.25 x 0.5 = 12.5
    expect(r.wreck?.plunder).toBe(38);
  });

  it("never gives up more than the loser carried, however kind the fairness factor", () => {
    const r = settleLoot(input({ outcome: "sunk", pvp: true, loserPR: 40, winnerPR: 10 }));
    expect(r.fairness).toBe(F.underdogCap);
    expect(r.taken.plunder).toBe(37); // 100 x 0.25 x 1.5
    expect(r.lost).toEqual({ plunder: 100, goods: { rum: 10, spice: 4 } });
  });

  it("puts what the per battle cap keeps from the winner into the Wreck", () => {
    const rich = { plunder: 10000, goods: {} };
    const r = settleLoot(input({ outcome: "sunk", carried: rich }));
    expect(r.capped).toBe(true);
    expect(r.taken.plunder).toBe(L.capPerBattle);
    expect(r.lost.plunder).toBe(10000);
    expect(r.wreck?.plunder).toBe(10000 - L.capPerBattle);
  });

  it("leaves no Wreck when nothing was carried", () => {
    expect(settleLoot(input({ outcome: "sunk", carried: { plunder: 0, goods: {} } })).wreck).toBeNull();
  });

  it("makes no Wreck for any other outcome", () => {
    for (const outcome of OUTCOMES.filter((o) => o !== "sunk")) expect(settleLoot(input({ outcome })).wreck).toBeNull();
  });
});

describe("Captured: the pick (P2.2, GAMEPLAY 8.7)", () => {
  it("is gold until intel and crew exist", () => {
    expect(capturePick()).toEqual({ kind: "gold" });
    expect(settleLoot(input({ outcome: "captured" })).pick).toEqual({ kind: "gold" });
  });

  it("is only for a Capture", () => {
    for (const outcome of OUTCOMES.filter((o) => o !== "captured")) expect(settleLoot(input({ outcome })).pick).toBeNull();
  });
});

describe("the fairness factor in a settlement (P2.2)", () => {
  it("cuts a bully's loot to a quarter", () => {
    const fair = settleLoot(input({ pvp: true, loserPR: 10, winnerPR: 10 }));
    const bully = settleLoot(input({ pvp: true, loserPR: 3, winnerPR: 10 }));
    expect(fair.taken.plunder).toBe(40);
    expect(bully.taken.plunder).toBe(10);
    expect(bully.lost).toEqual(bully.taken); // and the loser gives up no more than that
  });

  it("raises an underdog's loot by up to half", () => {
    const underdog = settleLoot(input({ pvp: true, loserPR: 20, winnerPR: 10 }));
    expect(underdog.fairness).toBe(F.underdogCap);
    expect(underdog.taken.plunder).toBe(60);
  });

  it("does not touch a fight against an NPC", () => {
    expect(settleLoot(input({ pvp: false, loserPR: 3, winnerPR: 10 })).taken.plunder).toBe(40);
  });
});

describe("the Cradle halving (P2.2)", () => {
  it("halves PvP loot in the Cradle", () => {
    expect(settleLoot(input({ pvp: true, inCradle: true })).taken.plunder).toBe(20);
    expect(settleLoot(input({ pvp: true, inCradle: false })).taken.plunder).toBe(40);
  });

  it("leaves NPC loot alone in the Cradle", () => {
    expect(settleLoot(input({ pvp: false, inCradle: true })).taken.plunder).toBe(40);
  });

  it("stacks with the fairness factor", () => {
    expect(settleLoot(input({ pvp: true, inCradle: true, loserPR: 3, winnerPR: 10 })).taken.plunder).toBe(5); // 100 x 0.4 x 0.25 x 0.5
  });
});

describe("the per battle cap (P2.2)", () => {
  const rich = (plunder: number): Carried => ({ plunder, goods: {} });

  it("caps the winner's take at capPerBattle times the Boom", () => {
    const r = settleLoot(input({ outcome: "captured", carried: rich(10000) }));
    expect(r.capped).toBe(true);
    expect(r.taken.plunder).toBe(L.capPerBattle);
    const boomed = settleLoot(input({ outcome: "captured", carried: rich(10000), boom: 2 }));
    expect(boomed.taken.plunder).toBe(L.capPerBattle * 2);
  });

  it("does not bite below the cap", () => {
    const r = settleLoot(input({ outcome: "captured", carried: rich(1000) })); // 40% is 400
    expect(r.capped).toBe(false);
    expect(r.taken.plunder).toBe(400);
  });

  it("applies to the fairness-adjusted loot, not the table share", () => {
    const r = settleLoot(input({ outcome: "captured", carried: rich(3000), pvp: true, loserPR: 20, winnerPR: 10 })); // 3000 x 0.4 x 1.5 = 1800
    expect(r.capped).toBe(true);
    expect(r.taken.plunder).toBe(L.capPerBattle);
  });

  it("measures cargo at its price, plunder at face value", () => {
    const goods = { plunder: 0, goods: { spice: 100 } };
    const cheap = settleLoot(input({ outcome: "captured", carried: goods })); // 40 spice at 20 is 800, over the cap
    expect(cheap.capped).toBe(true);
    expect(cheap.taken.goods.spice).toBe(30); // 600 / 20 of 100 spice
    const dear = settleLoot(input({ outcome: "captured", carried: goods, prices: { spice: 1 } })); // 40 spice at 1 is 40
    expect(dear.capped).toBe(false);
    expect(dear.taken.goods.spice).toBe(40);
  });

  it("shares the cap across plunder and cargo, taking the same share of each", () => {
    const mixed = { plunder: 1000, goods: { rum: 100 } }; // 3000 doubloons at the default price
    const r = settleLoot(input({ outcome: "captured", carried: mixed }));
    expect(r.capped).toBe(true);
    expect(cargoValue(r.taken)).toBeLessThanOrEqual(L.capPerBattle);
    expect(r.taken).toEqual({ plunder: 200, goods: { rum: 20 } }); // 600 / 3000 of each
  });

  it("never lets the take pass the cap, whatever is carried (random cases)", () => {
    const rng = new Rng("loot-cap-property");
    for (let i = 0; i < 500; i++) {
      const c: Carried = { plunder: rng.int(0, 5000), goods: { timber: rng.int(0, 90), rum: rng.int(0, 90), sugar: rng.int(0, 90), spice: rng.int(0, 90) } };
      const boom = 1 + rng.int(0, 3) * 0.25;
      const prices = { rum: rng.int(1, 80), spice: rng.int(1, 200) };
      const outcome = OUTCOMES[rng.int(0, OUTCOMES.length - 1)]!;
      const pvp = rng.chance(0.5);
      const r = settleLoot(input({ outcome, carried: c, boom, prices, pvp, inCradle: rng.chance(0.3), loserPR: rng.int(1, 30), winnerPR: rng.int(1, 30) }));
      expect(cargoValue(r.taken, { ...prices })).toBeLessThanOrEqual(L.capPerBattle * boom + 1e-9);
      // The winner never takes more than the loser gives up, and the loser never gives up more than it carried.
      for (const good of CARGO_GOODS) {
        expect(r.taken.goods[good] ?? 0).toBeLessThanOrEqual(r.lost.goods[good] ?? 0);
        expect(r.lost.goods[good] ?? 0).toBeLessThanOrEqual(c.goods[good] ?? 0);
        expect(Number.isInteger(r.taken.goods[good] ?? 0)).toBe(true);
      }
      expect(r.taken.plunder).toBeLessThanOrEqual(r.lost.plunder);
      expect(r.lost.plunder).toBeLessThanOrEqual(c.plunder);
      expect(Number.isInteger(r.taken.plunder)).toBe(true);
      if (outcome !== "sunk") expect(r.lost).toEqual(r.taken);
    }
  });
});

describe("Flotsam (P2.2, GAMEPLAY 8.7)", () => {
  it("is every cargo good thrown overboard, left in that water for 2 Tides", () => {
    const j = jettison({ plunder: 80, goods: { timber: 3, spice: 5 } }, "ship_a", "dw_reef", 7);
    expect(j.flotsam).toEqual({ id: "flotsam_t7_ship_a", water: "dw_reef", goods: { timber: 3, spice: 5 }, plunder: 0, untilTide: 7 + L.flotsamTides });
  });

  it("keeps the plunder aboard", () => {
    expect(jettison({ plunder: 80, goods: { timber: 3 } }, "ship_a", "dw_reef", 7).kept).toEqual({ plunder: 80, goods: {} });
  });

  it("leaves nothing for the winner to take", () => {
    const j = jettison({ plunder: 0, goods: { rum: 40 } }, "ship_a", "dw_reef", 7);
    expect(settleLoot(input({ outcome: "captured", carried: j.kept })).taken).toEqual({ plunder: 0, goods: {} });
  });

  it("makes no Flotsam when there was no cargo", () => {
    expect(jettison({ plunder: 50, goods: {} }, "ship_a", "dw_reef", 7).flotsam).toBeNull();
  });

  it("makes Flotsam last a shorter time than a Wreck", () => {
    expect(L.flotsamTides).toBeLessThan(L.wreckTides);
  });
});

describe("what a ship carries (P2.2)", () => {
  it("counts plunder and cargo goods, but not Provisions or Powder", () => {
    const ship = newShip("ship_a", "cap_a", "A", "sloop", "dw_shallows", false);
    ship.plunder = 33;
    ship.hold = { ...emptyHold(), provisions: 4, powder: 6, rum: 5 };
    expect(carriedBy(ship)).toEqual({ plunder: 33, goods: { rum: 5 } });
  });

  it("values cargo at the price given, else the base price", () => {
    expect(cargoValue({ plunder: 10, goods: { rum: 2, spice: 1 } })).toBe(10 + 3 * PRICE);
    expect(cargoValue({ plunder: 10, goods: { rum: 2, spice: 1 } }, { rum: 5 })).toBe(10 + 10 + PRICE);
  });
});

describe("loot is pure (P2.2)", () => {
  it("does not change its inputs", () => {
    const i = deepFreeze(input({ outcome: "sunk", pvp: true, inCradle: true }));
    expect(() => settleLoot(i)).not.toThrow();
    expect(() => jettison(deepFreeze(carried()), "s", "w", 1)).not.toThrow();
  });

  it("gives the same answer twice", () => {
    expect(settleLoot(input({ outcome: "sunk", pvp: true }))).toEqual(settleLoot(input({ outcome: "sunk", pvp: true })));
  });

  it("returns a JSON friendly result", () => {
    const r = settleLoot(input({ outcome: "sunk" }));
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
