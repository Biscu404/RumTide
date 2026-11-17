// P3.2b, D218 to D221: what makes Old Shellback beatable and not farmable. His claws stay behind the shell until he rears up, the
// cycle of Deck orders is set aside in a deck fight with him, and each fight he has a temper, one seeded roll of its own.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { newBoss } from "../season.ts";
import { world } from "../testing.ts";
import { runBattle } from "./battle.ts";
import { boardingStrength } from "./boarding.ts";
import { doctrineChooser } from "./doctrine.ts";
import { battleShipOf } from "./encounter.ts";
import { SHELLBACK_ID, outsideDeckCycle, shellFactor, shellbackDoctrine, temperFor } from "./shellback.ts";
import { always, battleOf, testShip } from "./testing.ts";
import type { BattleRecord, BattleShip } from "./types.ts";

const S = B.shellback;
const SHIP = `ship_${SHELLBACK_ID}`;
const crab = (): BattleShip => battleShipOf(newBoss(world, "season0", world.map.bosses[0]!)!.ship, { id: SHELLBACK_ID }, "target", { charted: true, withCurrent: false, lurker: false });
const sturdy = (): BattleShip => testShip("hunter", "sloop", { maxHullPoints: 400, hullPoints: 400, maxHands: 60, hands: 60 });
const fight = (guns: "repel" | "grapeshot" | "charge", seed: number): BattleRecord =>
  runBattle(battleOf(sturdy(), crab(), { hunter: always("closeIn", guns), target: doctrineChooser(shellbackDoctrine(), { enemyType: "player" }) }, { terrain: "shallows", seed }));
const melees = (r: BattleRecord) => r.rounds.filter((x) => x.melee !== null);

describe("his claws behind the shell (D218)", () => {
  it("lets no Grapeshot through to his claws, except in the round he rears up", () => {
    expect(S.clawShell).toBe(0);
    expect(shellFactor(crab(), "grapeshot", false)).toBe(0);
    expect(shellFactor(crab(), "grapeshot", true)).toBe(1);
    expect(shellFactor(testShip("target"), "grapeshot", false)).toBe(1); // any other ship has no shell
  });

  it("fights with 36 claws", () => {
    expect(S.clawHands).toBe(36);
    expect(crab()).toMatchObject({ hands: 36, maxHands: 36 });
  });
});

describe("no Deck order beats claws (D219)", () => {
  it("sets the cycle aside for both crews in a deck fight with him", () => {
    expect(S.deckCycle).toBe(false);
    expect(outsideDeckCycle(crab(), [sturdy()])).toBe(true);
    expect(outsideDeckCycle(sturdy(), [crab()])).toBe(true);
    expect(outsideDeckCycle(sturdy(), [testShip("target")])).toBe(false);
  });

  it("makes a Repel against his Charge an even pairing, where it wins against any other ship", () => {
    let seen = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const round of melees(fight("repel", seed)).slice(1)) { // after the grapple round, where a crew that did not Board uses Fists
        const [mine, his] = [round.ships.find((s) => s.ship !== SHIP)!, round.ships.find((s) => s.ship === SHIP)!];
        if (mine.deck?.order !== "repel" || his.deck?.order !== "charge") continue;
        seen++;
        expect([mine.deck.pairing, his.deck.pairing]).toEqual(["even", "even"]);
      }
    }
    expect(seen).toBeGreaterThan(0);
    const plain = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("closeIn", "repel"), target: always("closeIn", "charge") }, { ambush: "medium", seed: 1 }));
    const later = melees(plain)[1]!;
    expect(later.ships.map((s) => s.deck?.pairing)).toEqual(["won", "lost"]);
  });
});

describe("his temper (D220)", () => {
  it("counts from a quarter to one and three quarters of his claws' strength", () => {
    expect(S.temper).toBe(0.75);
    expect(temperFor(0)).toBe(0.25);
    expect(temperFor(0.5)).toBe(1);
    expect(temperFor(0.999999)).toBeCloseTo(1.75, 4);
    const ship = crab();
    expect(boardingStrength(ship, "open", { temper: 0.5 })).toBeCloseTo(0.5 * boardingStrength(ship, "open"));
  });

  it("is one roll for the whole fight, written on every round of the deck fight, and differs from fight to fight", () => {
    const tempers = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rounds = melees(fight("charge", seed));
      expect(rounds.length).toBeGreaterThan(0);
      const first = rounds[0]!.melee!.temper!;
      expect(first).toBeGreaterThanOrEqual(1 - S.temper);
      expect(first).toBeLessThan(1 + S.temper);
      for (const round of rounds) expect(round.melee!.temper).toBe(first);
      tempers.add(first);
    }
    expect(tempers.size).toBeGreaterThan(4);
  });

  it("replays the same from the same seed, and is not written in a deck fight without him", () => {
    expect(fight("charge", 7)).toEqual(fight("charge", 7));
    const plain = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("closeIn", "charge"), target: always("closeIn", "charge") }, { ambush: "medium", seed: 1 }));
    expect(melees(plain).length).toBeGreaterThan(0);
    for (const round of melees(plain)) expect(round.melee!.temper).toBeUndefined();
  });
});
