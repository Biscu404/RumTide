import { describe, expect, it } from "vitest";
import { B, boom } from "./balance.ts";
import { apportion, settlePvpBattle, shrinkBounty, zoneLootMult, type LootParty, type SettleInput } from "./loot.ts";

const party = (id: string, over: Partial<LootParty> = {}): LootParty => ({
  id, pr: 10, carriedValue: 0, damageDealt: 100, bounty: 0, ...over,
});

/** A plain win in Free Waters after Calm Seas week, hunters on the winning side. */
const settle = (over: Partial<SettleInput> & Pick<SettleInput, "winners" | "losers">) =>
  settlePvpBattle({
    outcome: "decisive", winnersHunted: false, refusedParley: false,
    zone: "free", mawOpens: false, tide: 10, ...over,
  });

describe("zoneLootMult", () => {
  it("is 1 in Free Waters after Calm Seas week", () => {
    expect(zoneLootMult("free", false, 8, true)).toBe(1);
  });

  it("halves PvP loot in Crown Waters and in Calm Seas week, and both together", () => {
    expect(zoneLootMult("crown", false, 8, true)).toBe(B.loot.crownWaters);
    expect(zoneLootMult("free", false, B.loot.calmSeasLastTide, true)).toBe(B.loot.calmSeasWeek);
    expect(zoneLootMult("free", false, B.loot.calmSeasLastTide + 1, true)).toBe(1);
    expect(zoneLootMult("crown", false, 3, true)).toBe(B.loot.crownWaters * B.loot.calmSeasWeek);
  });

  it("leaves Calm Seas week out of non PvP loot", () => {
    expect(zoneLootMult("free", false, 3, false)).toBe(1);
  });

  it("treats the Maw as Free until it opens, then raises loot by half", () => {
    expect(zoneLootMult("maw", false, 8, true)).toBe(1);
    expect(zoneLootMult("maw", true, 8, true)).toBe(B.loot.maw);
  });
});

describe("apportion", () => {
  it("always adds up to the total", () => {
    for (const weights of [[1, 1, 1], [3, 1], [0.3, 0.3, 0.4], [5], [7, 0, 2, 9]]) {
      for (const total of [0, 1, 2, 7, 31, 100]) {
        expect(apportion(total, weights).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("splits in proportion to the weights", () => {
    expect(apportion(100, [3, 1])).toEqual([75, 25]);
  });

  it("gives the leftover doubloon to the larger remainder, then the earlier entry", () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(2, [10, 10, 1])).toEqual([1, 1, 0]);
  });

  it("splits evenly when every weight is zero", () => {
    expect(apportion(4, [0, 0])).toEqual([2, 2]);
  });
});

describe("shrinkBounty", () => {
  it("keeps 90% a Tide and disappears at the end", () => {
    expect(shrinkBounty(100)).toBe(90);
    let b = 100, tides = 0;
    while (b > 0) { b = shrinkBounty(b); tides++; }
    expect(tides).toBeLessThan(60);
    expect(shrinkBounty(0)).toBe(0);
  });
});

describe("worked example, section 7.4", () => {
  // The Sock (PR 10) beats the Gull (PR 10.3) with a Victory. The Gull carried 150 doubloons.
  it("takes 20% times the underdog factor 1.03: 31 doubloons", () => {
    const result = settle({
      outcome: "victory", winners: [party("sock")], losers: [party("gull", { pr: 10.3, carriedValue: 150 })],
    });
    expect(result.fairness).toBeCloseTo(1.03, 5);
    expect(result.totalGold).toBe(31);
    expect(result.loot).toEqual([{ fromId: "gull", toId: "sock", gold: 31 }]);
    expect(result.gained).toEqual({ sock: 31 });
    expect(result.lossFraction.gull).toBeCloseTo(31 / 150, 8);
  });
});

describe("loot", () => {
  it("takes 40% of a fair decisive win and 20% of a Victory", () => {
    const losers = [party("l", { carriedValue: 1000 })];
    expect(settle({ outcome: "decisive", winners: [party("w")], losers }).totalGold).toBe(400);
    expect(settle({ outcome: "victory", winners: [party("w")], losers }).totalGold).toBe(200);
  });

  it("caps one battle at 600 times the Boom", () => {
    const result = settle({ winners: [party("w")], losers: [party("l", { carriedValue: 100_000 })] });
    expect(result.totalGold).toBe(Math.round(B.loot.capPerBattle * boom(10)));
  });

  it("takes nothing from an empty hold", () => {
    const result = settle({ winners: [party("w")], losers: [party("l")] });
    expect(result.totalGold).toBe(0);
    expect(result.loot).toEqual([]);
    expect(result.lossFraction.l).toBe(0);
  });

  it("pays more to a weaker winner (David's Due) and less to a stronger one, within the limits", () => {
    const losers = [party("l", { pr: 12, carriedValue: 1000 })];
    expect(settle({ winners: [party("w", { pr: 8 })], losers }).fairness).toBeCloseTo(1.5, 8);   // capped
    expect(settle({ winners: [party("w", { pr: 10 })], losers }).fairness).toBeCloseTo(1.2, 8);
    expect(settle({ winners: [party("w", { pr: 20 })], losers: [party("l", { pr: 10, carriedValue: 1000 })] }).fairness)
      .toBeCloseTo(0.25, 8);   // (10 / 20) ** 2, exactly the floor
    expect(settle({ winners: [party("w", { pr: 40 })], losers: [party("l", { pr: 10, carriedValue: 1000 })] }).fairness)
      .toBe(B.fairness.floor);
  });

  it("scales loot by zone: Crown Waters and Calm Seas week", () => {
    const losers = [party("l", { carriedValue: 1000 })];
    expect(settle({ winners: [party("w")], losers, zone: "crown" }).totalGold).toBe(200);
    expect(settle({ winners: [party("w")], losers, tide: 3 }).totalGold).toBe(200);
    expect(settle({ winners: [party("w")], losers, zone: "crown", tide: 3 }).totalGold).toBe(100);
  });

  it("makes ganging up poor: three equal ships take about 3% each, not 40%", () => {
    const gang = [party("a"), party("b"), party("c")];
    const result = settle({ winners: gang, losers: [party("victim", { carriedValue: 1000 })] });
    expect(result.fairness).toBe(B.fairness.floor);
    expect(result.totalGold).toBe(100);
    expect(Object.values(result.gained).sort()).toEqual([33, 33, 34]);
    expect(result.totalGold / 3 / 1000).toBeCloseTo(0.033, 3);
  });

  it("splits winners' gold in proportion to the damage they dealt", () => {
    const result = settle({
      winners: [party("a", { damageDealt: 300 }), party("b", { damageDealt: 100 })],
      losers: [party("v", { carriedValue: 1000 })],
      outcome: "victory",
    });
    // Two ships against one: fairness is (10 / 20) ** 2 = 0.25, so 1000 x 0.2 x 0.25 = 50.
    expect(result.totalGold).toBe(50);
    expect(result.gained).toEqual({ a: 38, b: 12 });
  });

  it("keeps every doubloon: losers pay exactly what winners gain, whoever pays whom", () => {
    const result = settle({
      winners: [party("w1", { damageDealt: 70, pr: 20 }), party("w2", { damageDealt: 30, pr: 20 })],
      losers: [party("l1", { carriedValue: 333, pr: 15 }), party("l2", { carriedValue: 211, pr: 15 }), party("l3", { carriedValue: 0, pr: 15 })],
    });
    const paid = result.loot.reduce((t, r) => t + r.gold, 0);
    expect(paid).toBe(result.totalGold);
    for (const w of ["w1", "w2"]) {
      expect(result.loot.filter((r) => r.toId === w).reduce((t, r) => t + r.gold, 0)).toBe(result.gained[w]);
    }
    const lostGold = (id: string, carried: number) => result.lossFraction[id]! * carried;
    expect(lostGold("l1", 333) + lostGold("l2", 211)).toBeCloseTo(result.totalGold, 8);
    expect(result.loot.every((r) => r.gold > 0)).toBe(true);
  });

  it("is the same whichever order the parties are listed in", () => {
    const winners = [party("a", { damageDealt: 60 }), party("b", { damageDealt: 40 })];
    const losers = [party("x", { carriedValue: 500 }), party("y", { carriedValue: 300 })];
    expect(settle({ winners: [...winners].reverse(), losers: [...losers].reverse() }))
      .toEqual(settle({ winners, losers }));
  });

  it("refuses a settlement with nobody on one side", () => {
    expect(() => settle({ winners: [], losers: [party("l")] })).toThrow();
    expect(() => settle({ winners: [party("w")], losers: [] })).toThrow();
  });
});

describe("bounties", () => {
  const rich = [party("prey", { carriedValue: 1000 })];

  it("puts no bounty on a winner who did not hunt", () => {
    const result = settle({ winners: [party("w")], losers: rich, winnersHunted: false, zone: "crown" });
    expect(result.bountiesAdded).toEqual([]);
  });

  it("puts no bounty on a fair hunt in Free Waters", () => {
    const result = settle({ winners: [party("w")], losers: rich, winnersHunted: true });
    expect(result.bountiesAdded).toEqual([]);
  });

  it("puts a bounty equal to the loot on a hunter who picks on a ship below two thirds of their PR", () => {
    const weak = [party("prey", { pr: 6, carriedValue: 1000 })];
    const result = settle({ winners: [party("w")], losers: weak, winnersHunted: true });
    expect(result.bountiesAdded).toEqual([{ captainId: "w", amount: result.gained.w, reasons: ["huntedWeaker"] }]);
    expect(result.gained.w).toBeGreaterThan(0);
    // Exactly two thirds is still fair.
    const edge = [party("prey", { pr: 20 / 3, carriedValue: 1000 })];
    expect(settle({ winners: [party("w")], losers: edge, winnersHunted: true }).bountiesAdded).toEqual([]);
  });

  it("puts a bounty on hunting in Crown Waters and on refusing parley", () => {
    expect(settle({ winners: [party("w")], losers: rich, winnersHunted: true, zone: "crown" }).bountiesAdded[0]!.reasons)
      .toEqual(["crownWaters"]);
    expect(settle({ winners: [party("w")], losers: rich, winnersHunted: true, refusedParley: true }).bountiesAdded[0]!.reasons)
      .toEqual(["refusedParley"]);
  });

  it("lists every reason that applies", () => {
    const weak = [party("prey", { pr: 4, carriedValue: 1000 })];
    const result = settle({ winners: [party("w")], losers: weak, winnersHunted: true, zone: "crown", refusedParley: true });
    expect(result.bountiesAdded[0]!.reasons).toEqual(["huntedWeaker", "refusedParley", "crownWaters"]);
  });

  it("puts a bounty on each ganging ship, equal to what each took", () => {
    const gang = [party("a"), party("b"), party("c")];
    const result = settle({ winners: gang, losers: rich, winnersHunted: true });
    expect(result.bountiesAdded.map((b) => b.captainId)).toEqual(["a", "b", "c"]);
    expect(result.bountiesAdded.map((b) => b.amount)).toEqual(Object.values(result.gained));
    expect(result.bountiesAdded.every((b) => b.reasons.includes("huntedWeaker"))).toBe(true);
  });

  it("adds no bounty when the hunter took nothing", () => {
    const result = settle({ winners: [party("w")], losers: [party("prey", { pr: 4 })], winnersHunted: true, zone: "crown" });
    expect(result.bountiesAdded).toEqual([]);
  });

  it("pays a loser's bounty to whoever beat them, new money, and clears it", () => {
    const result = settle({
      winners: [party("a", { damageDealt: 50 }), party("b", { damageDealt: 50 })],
      losers: [party("hunted", { carriedValue: 100, bounty: 90 })],
    });
    expect(result.bountiesPaid).toEqual({ a: 45, b: 45 });
    expect(result.bountiesCleared).toEqual(["hunted"]);
    expect(result.totalGold).toBe(result.loot.reduce((t, r) => t + r.gold, 0));   // the bounty is not taken from the loser
  });

  it("clears and pays nothing if the loser had no bounty", () => {
    const result = settle({ winners: [party("w")], losers: [party("l", { carriedValue: 100 })] });
    expect(result.bountiesPaid).toEqual({ w: 0 });
    expect(result.bountiesCleared).toEqual([]);
  });
});

describe("shields and Legend", () => {
  it("shields every loser for 2 Tides after the Tide they lost", () => {
    const result = settle({ winners: [party("w")], losers: [party("a"), party("b")], tide: 9 });
    expect(result.shieldUntilTide).toEqual({ a: 9 + B.shieldTidesAfterPvpLoss, b: 9 + B.shieldTidesAfterPvpLoss });
  });

  it("pays 25 Legend for a fair win, scaled by the fairness factor", () => {
    expect(settle({ winners: [party("w")], losers: [party("l")] }).legend).toEqual({ w: B.legend.pvpWin });
    const gang = settle({ winners: [party("a"), party("b"), party("c")], losers: [party("l")] });
    expect(gang.legend.a).toBe(Math.round(B.legend.pvpWin * B.fairness.floor));
    expect(Object.keys(gang.legend)).toEqual(["a", "b", "c"]);
  });

  it("pays 50% more Legend for beating the Most Wanted", () => {
    const result = settle({ winners: [party("w")], losers: [party("boss", { mostWanted: true })] });
    expect(result.legend.w).toBe(Math.round(B.legend.pvpWin * B.legend.mostWantedMult));
  });
});
