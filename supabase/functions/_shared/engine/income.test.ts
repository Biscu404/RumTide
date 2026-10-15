import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B } from "./balance.ts";
import {
  bonusRate, convoyMatesOf, describeBonus, hasFairWinds, incomeBonus, incomeFacts, incomeRoster, shoreLeaveActive,
  type IncomeRosterEntry,
} from "./income.ts";
import { hopsFrom, loadMap } from "./map.ts";
import { newCaptain } from "./state.ts";
import type { Captain } from "./types.ts";

const map = loadMap(brineJson);
const captain = (patch: Partial<Captain> = {}): Captain => ({ ...newCaptain("ann", "s1"), ...patch });
const NONE = { convoyMates: 0 };

// A node, one next to it, and one at least two hops from both.
const HOME = "sea06";
const NEXT = map.neighbours(HOME)[0]!;
const fromNext = hopsFrom(map, NEXT);
const FAR = [...hopsFrom(map, HOME)].find(([id, hops]) => hops >= 2 && fromNext.get(id)! >= 2)![0];

const entry = (id: string, fleetId: string | null, nodeId: string): IncomeRosterEntry => ({ id, fleetId, nodeId });

describe("Fair Winds", () => {
  it("goes to captains below 70% of the median Legend, and not at exactly 70%", () => {
    expect(hasFairWinds(60, 100)).toBe(true);
    expect(hasFairWinds(69.9, 100)).toBe(true);
    expect(hasFairWinds(70, 100)).toBe(false);
    expect(hasFairWinds(150, 100)).toBe(false);
  });

  it("goes to nobody while the median Legend is zero", () => {
    expect(hasFairWinds(0, 0)).toBe(false);
  });
});

describe("the convoy", () => {
  it("counts fleet mates on the same node or an adjacent one, and no one else", () => {
    const roster = [
      entry("ann", "f1", HOME), entry("bob", "f1", HOME), entry("cat", "f1", NEXT), entry("dan", "f1", FAR),
      entry("eve", "f2", HOME), entry("fay", null, NEXT),
    ];
    expect(convoyMatesOf(map, roster[0]!, roster)).toBe(2);   // bob (same node) and cat (next to it), not dan or the other fleet
    expect(convoyMatesOf(map, roster[3]!, roster)).toBe(0);   // dan is two or more hops from everyone
  });

  it("is zero without a fleet, and a ship is not its own mate", () => {
    const roster = [entry("ann", null, HOME), entry("bob", null, HOME)];
    expect(convoyMatesOf(map, roster[0]!, roster)).toBe(0);
    expect(convoyMatesOf(map, entry("ann", "f1", HOME), [entry("ann", "f1", HOME)])).toBe(0);
  });

  it("is read from a snapshot's captains and ships, and refuses an unknown captain", () => {
    const roster = incomeRoster({
      captains: [{ id: "ann", fleetId: "f1" }, { id: "bob", fleetId: "f1" }],
      ships: [{ captainId: "ann", nodeId: HOME }, { captainId: "bob", nodeId: NEXT }],
    });
    expect(incomeFacts(map, "ann", roster)).toEqual({ convoyMates: 1 });
    expect(() => incomeFacts(map, "zed", roster)).toThrow(/Unknown captain/);
  });
});

describe("the income bonus", () => {
  it("is nothing for a captain with no Shore Leave, no Fair Winds and no convoy", () => {
    const b = incomeBonus(captain(), 3, 100, NONE);
    expect(b).toMatchObject({ rate: 0, extra: 0, shoreLeave: false, fairWinds: false });
    expect(b.captain).toEqual(captain());
  });

  it("adds the three bonuses together instead of multiplying them", () => {
    const c = captain({ shoreLeaveTides: 1, fairWinds: true });
    const b = incomeBonus(c, 3, 100, { convoyMates: 2 });
    const rate = B.catchUp.shoreLeaveBonus + B.catchUp.fairWindsBonus + 2 * B.fleet.convoyPerMate;
    expect(b.rate).toBeCloseTo(rate);
    expect(rate).toBeCloseTo(0.9);                              // not 1.5 * 1.2 * 1.2 - 1
    expect(b.extra).toBe(90);
  });

  it("pays each bonus on its own", () => {
    expect(incomeBonus(captain({ shoreLeaveTides: 1 }), 3, 100, NONE).extra).toBe(50);
    expect(incomeBonus(captain({ fairWinds: true }), 3, 100, NONE).extra).toBe(20);
    expect(incomeBonus(captain(), 3, 100, { convoyMates: 1 }).extra).toBe(10);
  });

  it("rounds the extra gold to a whole doubloon", () => {
    expect(incomeBonus(captain({ fairWinds: true }), 3, 12.4, NONE).extra).toBe(2);    // 2.48
    expect(incomeBonus(captain({ shoreLeaveTides: 1 }), 3, 7, NONE).extra).toBe(4);    // 3.5
  });

  it("spends one stored Tide of Shore Leave on the first income of a Tide, and not again in that Tide", () => {
    const first = incomeBonus(captain({ shoreLeaveTides: 2 }), 5, 100, NONE);
    expect(first.captain).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 5 });
    expect(first.extra).toBe(50);
    const second = incomeBonus(first.captain, 5, 40, NONE);
    expect(second.captain).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 5 });   // nothing more spent
    expect(second.extra).toBe(20);                                                          // but still paid
    const nextTide = incomeBonus(second.captain, 6, 100, NONE);
    expect(nextTide.captain).toMatchObject({ shoreLeaveTides: 0, shoreLeaveUsedTide: 6 });
    expect(nextTide.extra).toBe(50);
    const after = incomeBonus(nextTide.captain, 7, 100, NONE);
    expect(after.extra).toBe(0);
  });

  it("spends nothing on a Tide with no income", () => {
    const c = captain({ shoreLeaveTides: 2 });
    for (const base of [0, -30, Number.NaN]) {
      const b = incomeBonus(c, 5, base, NONE);
      expect(b.captain).toBe(c);
      expect(b.extra).toBe(0);
      expect(b.shoreLeave).toBe(false);
    }
  });

  it("does not spend Shore Leave on a Tide that Fair Winds or the convoy pay for alone", () => {
    const c = captain({ fairWinds: true });
    expect(incomeBonus(c, 4, 100, { convoyMates: 1 }).captain).toBe(c);
  });

  it("knows whether Shore Leave pays in a Tide without spending it", () => {
    expect(shoreLeaveActive(captain(), 4)).toBe(false);
    expect(shoreLeaveActive(captain({ shoreLeaveTides: 1 }), 4)).toBe(true);
    expect(shoreLeaveActive(captain({ shoreLeaveUsedTide: 4 }), 4)).toBe(true);
    expect(shoreLeaveActive(captain({ shoreLeaveUsedTide: 3 }), 4)).toBe(false);
    expect(bonusRate(captain({ shoreLeaveTides: 1 }), 4, NONE)).toBe(B.catchUp.shoreLeaveBonus);
  });

  it("describes the sources in words", () => {
    const none = { shoreLeave: false, fairWinds: false, convoyMates: 0 };
    expect(describeBonus(none)).toBeNull();
    expect(describeBonus({ ...none, shoreLeave: true })).toBe("Shore Leave");
    expect(describeBonus({ ...none, convoyMates: 1 })).toBe("a convoy mate");
    expect(describeBonus({ shoreLeave: true, fairWinds: true, convoyMates: 3 })).toBe("Shore Leave, Fair Winds and a convoy of 3");
  });
});
