import { describe, expect, it } from "vitest";
import { B, escapeChance } from "./balance.ts";
import {
  encounterBetween, huntMatches, huntsPlayers, isProtected, pairKey, parleyResult, rollEscape,
  shieldUntilAfterLoss, type EncounterShip,
} from "./encounter.ts";
import { createRng } from "./rng.ts";

const ship = (id: string, over: Partial<EncounterShip> = {}): EncounterShip => ({
  id, kind: "player", fleetId: null, docked: false, shieldUntilTide: null, intent: "trade",
  sails: 10, pr: 10, parley: "off", noQuarter: false, ...over,
});
const hunter = (id: string, huntFilter: EncounterShip["huntFilter"], over: Partial<EncounterShip> = {}) =>
  ship(id, { intent: "hunt", huntFilter, ...over });
const npc = (id: string) => ship(id, { kind: "npc" });

describe("huntMatches", () => {
  it("never matches unless the ship is Hunting", () => {
    for (const intent of ["trade", "quiet", "explore", "escort"] as const) {
      expect(huntMatches(ship("a", { intent, huntFilter: "anyone" }), ship("b"))).toBe(false);
    }
  });

  it("matches merchants, players, anyone or one named captain", () => {
    expect(huntMatches(hunter("a", "merchants"), npc("n"))).toBe(true);
    expect(huntMatches(hunter("a", "merchants"), ship("b"))).toBe(false);
    expect(huntMatches(hunter("a", "players"), ship("b"))).toBe(true);
    expect(huntMatches(hunter("a", "players"), npc("n"))).toBe(false);
    expect(huntMatches(hunter("a", "anyone"), ship("b"))).toBe(true);
    expect(huntMatches(hunter("a", "anyone"), npc("n"))).toBe(true);
    expect(huntMatches(hunter("a", { captainId: "b" }), ship("b"))).toBe(true);
    expect(huntMatches(hunter("a", { captainId: "b" }), ship("c"))).toBe(false);
    expect(huntMatches(hunter("a", { captainId: "b" }), npc("b"))).toBe(false);
  });

  it("treats a Hunt with no filter as merchants only", () => {
    expect(huntMatches(hunter("a", undefined), npc("n"))).toBe(true);
    expect(huntMatches(hunter("a", undefined), ship("b"))).toBe(false);
  });

  it("never lets fleet mates hunt each other", () => {
    const a = hunter("a", "anyone", { fleetId: "f1" });
    expect(huntMatches(a, ship("b", { fleetId: "f1" }))).toBe(false);
    expect(huntMatches(a, ship("b", { fleetId: "f2" }))).toBe(true);
    expect(huntMatches(a, ship("b", { fleetId: null }))).toBe(true);
  });
});

describe("huntsPlayers", () => {
  it("is true for players, anyone and a named captain, false for merchants and for not hunting", () => {
    expect(huntsPlayers(hunter("a", "players"))).toBe(true);
    expect(huntsPlayers(hunter("a", "anyone"))).toBe(true);
    expect(huntsPlayers(hunter("a", { captainId: "x" }))).toBe(true);
    expect(huntsPlayers(hunter("a", "merchants"))).toBe(false);
    expect(huntsPlayers(hunter("a", undefined))).toBe(false);
    expect(huntsPlayers(ship("a", { huntFilter: "anyone" }))).toBe(false);
  });
});

describe("isProtected", () => {
  it("protects a docked ship", () => {
    expect(isProtected(ship("a", { docked: true }), 5)).toBe(true);
  });

  it("protects a shielded ship through the last shield Tide, not after", () => {
    const shielded = ship("a", { shieldUntilTide: 6 });
    expect(isProtected(shielded, 5)).toBe(true);
    expect(isProtected(shielded, 6)).toBe(true);
    expect(isProtected(shielded, 7)).toBe(false);
    expect(isProtected(ship("a"), 5)).toBe(false);
  });

  it("lasts two Tides after the Tide the battle was lost", () => {
    const until = shieldUntilAfterLoss(5);
    const shielded = ship("a", { shieldUntilTide: until });
    expect(until).toBe(5 + B.shieldTidesAfterPvpLoss);
    expect(isProtected(shielded, 5)).toBe(true);   // the Tide it was lost: the fight already happened
    expect(isProtected(shielded, 6)).toBe(true);
    expect(isProtected(shielded, 7)).toBe(true);
    expect(isProtected(shielded, 8)).toBe(false);
  });

  it("ends a shield early when its owner hunts players, but not when they hunt merchants", () => {
    expect(isProtected(hunter("a", "players", { shieldUntilTide: 9 }), 5)).toBe(false);
    expect(isProtected(hunter("a", "anyone", { shieldUntilTide: 9 }), 5)).toBe(false);
    expect(isProtected(hunter("a", "merchants", { shieldUntilTide: 9 }), 5)).toBe(true);
  });

  it("never protects an NPC except while docked", () => {
    expect(isProtected(ship("n", { kind: "npc", shieldUntilTide: 9 }), 5)).toBe(false);
  });
});

describe("encounterBetween", () => {
  it("is nothing when nobody is hunting", () => {
    expect(encounterBetween(ship("a"), ship("b"), 5)).toBeNull();
  });

  it("is nothing when the filter does not match", () => {
    expect(encounterBetween(hunter("a", "merchants"), ship("b"), 5)).toBeNull();
  });

  it("makes the hunter the hunter and the other ship the hunted, in either argument order", () => {
    expect(encounterBetween(hunter("a", "players"), ship("b"), 5)).toEqual({ hunters: ["a"], hunted: "b" });
    expect(encounterBetween(ship("b"), hunter("a", "players"), 5)).toEqual({ hunters: ["a"], hunted: "b" });
  });

  it("is nothing against a docked or shielded ship", () => {
    expect(encounterBetween(hunter("a", "anyone"), ship("b", { docked: true }), 5)).toBeNull();
    expect(encounterBetween(hunter("a", "anyone"), ship("b", { shieldUntilTide: 6 }), 5)).toBeNull();
    expect(encounterBetween(hunter("a", "anyone"), ship("b", { shieldUntilTide: 4 }), 5)).toEqual({ hunters: ["a"], hunted: "b" });
  });

  it("has no hunted ship when both are hunting each other", () => {
    const result = encounterBetween(hunter("b", "players"), hunter("a", "players"), 5);
    expect(result).toEqual({ hunters: ["a", "b"], hunted: null });
  });

  it("keeps the shield of a ship that only hunts merchants", () => {
    const prey = hunter("b", "merchants", { shieldUntilTide: 9 });
    expect(encounterBetween(hunter("a", "players"), prey, 5)).toBeNull();
  });

  it("lets a shielded ship that hunts players be caught, and catch back", () => {
    const rash = hunter("b", "players", { shieldUntilTide: 9 });
    expect(encounterBetween(hunter("a", "players"), rash, 5)).toEqual({ hunters: ["a", "b"], hunted: null });
  });

  it("is nothing between fleet mates, hunting or not", () => {
    expect(encounterBetween(hunter("a", "anyone", { fleetId: "f" }), ship("b", { fleetId: "f" }), 5)).toBeNull();
  });

  it("lets a player hunt an NPC merchant", () => {
    expect(encounterBetween(hunter("a", "merchants"), npc("n"), 5)).toEqual({ hunters: ["a"], hunted: "n" });
  });
});

describe("rollEscape", () => {
  it("escapes about as often as escapeChance says", () => {
    const hunted = ship("h", { sails: 12 }), chaser = hunter("c", "players", { sails: 10 });
    const rng = createRng(2024);
    let escapes = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) if (rollEscape(hunted, chaser, rng)) escapes++;
    expect(escapes / n).toBeCloseTo(escapeChance(12, 10, false), 1);
  });

  it("escapes more often when sailing quietly", () => {
    const chaser = hunter("c", "players");
    const count = (intent: EncounterShip["intent"]) => {
      const rng = createRng(9);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollEscape(ship("h", { intent }), chaser, rng)) n++;
      return n;
    };
    expect(count("quiet")).toBeGreaterThan(count("trade") * 1.15);
  });

  it("escapes 20% more often under a Mermaid's Song, and stays inside the limits", () => {
    const stub = (x: number) => ({ ...createRng(1), next: () => x });
    const chaser = hunter("c", "players");
    expect(escapeChance(10, 10, false, B.explore.mermaid.escapeMult)).toBeCloseTo(0.5 * B.explore.mermaid.escapeMult);
    expect(rollEscape(ship("h"), chaser, stub(0.55))).toBe(false);                                    // 0.55 is above 0.5
    expect(rollEscape(ship("h", { escapeBoost: B.explore.mermaid.escapeMult }), chaser, stub(0.55))).toBe(true);   // and below 0.6
    expect(escapeChance(1000, 1, false, B.explore.mermaid.escapeMult)).toBe(B.escape.max);
    expect(rollEscape(ship("h", { escapeBoost: 1 }), chaser, stub(0.55))).toBe(false);
  });

  it("uses exactly one random number, so a Tide stays reproducible", () => {
    const a = createRng(5), b = createRng(5);
    rollEscape(ship("h"), hunter("c", "players"), a);
    b.next();
    expect(a.next()).toBe(b.next());
  });

  it("stays between 5% and 75%, however lopsided the sails", () => {
    const rng = createRng(1);
    let always = 0, never = 0;
    for (let i = 0; i < 3000; i++) {
      if (rollEscape(ship("h", { sails: 1000 }), hunter("c", "players", { sails: 1 }), rng)) always++;
      if (rollEscape(ship("h", { sails: 1 }), hunter("c", "players", { sails: 1000 }), rng)) never++;
    }
    expect(always / 3000).toBeCloseTo(B.escape.max, 1);
    expect(never / 3000).toBeCloseTo(B.escape.min, 1);
  });
});

describe("parleyResult", () => {
  const strong = hunter("c", "players", { pr: 15 });

  it("does nothing if the hunted ship set no parley", () => {
    expect(parleyResult(ship("h", { parley: "off" }), strong)).toEqual({ kind: "none" });
  });

  it("accepts when the hunter is at least 25% stronger, and charges the tribute", () => {
    expect(parleyResult(ship("h", { parley: 1.25, pr: 12 }), strong)).toEqual({ kind: "tribute", fraction: B.parley.tribute });
    expect(parleyResult(ship("h", { parley: 1.25, pr: 12 }), hunter("c", "players", { pr: 15 }))).toEqual({ kind: "tribute", fraction: 0.1 });
  });

  it("does nothing when the hunter is not strong enough for the threshold", () => {
    expect(parleyResult(ship("h", { parley: 1.25, pr: 13 }), strong)).toEqual({ kind: "none" });
    expect(parleyResult(ship("h", { parley: 1.5, pr: 11 }), strong)).toEqual({ kind: "none" });
    expect(parleyResult(ship("h", { parley: 1.5, pr: 10 }), strong)).toEqual({ kind: "tribute", fraction: 0.1 });
  });

  it("is refused when the hunter set No Quarter", () => {
    expect(parleyResult(ship("h", { parley: 1.25, pr: 10 }), hunter("c", "players", { pr: 15, noQuarter: true })))
      .toEqual({ kind: "refused" });
  });

  it("is never offered by an NPC", () => {
    expect(parleyResult(ship("n", { kind: "npc", parley: 1.25 }), strong)).toEqual({ kind: "none" });
  });
});

describe("pairKey", () => {
  it("is the same for both orders", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});
