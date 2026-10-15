import { describe, expect, it } from "vitest";
import { B, maxHullPoints, powerRating, statValue } from "@engine/balance.ts";
import { resolveBattle, type Combatant } from "@engine/combat.ts";
import { createRng } from "@engine/rng.ts";
import type { Battle, Maneuver } from "@engine/types.ts";
import { brineMap } from "../../../supabase/functions/_shared/api/testing.ts";
import { MANEUVER_STYLE, buildReplay, shortName } from "./replayModel.ts";

// The replay is worked out from the saved Battle record alone. These build real battles with the
// engine and check that the model says exactly what the engine did.

type Plan = [Maneuver, Maneuver, Maneuver];

function ship(id: string, plan: Plan, over: Partial<Combatant> = {}): Combatant {
  const stat = statValue("sloop", 0);
  const hull = maxHullPoints("sloop", 0);
  return {
    id, kind: "player", cannons: stat, sails: stat, crew: stat, hullPoints: hull, maxHull: hull, plan,
    pr: powerRating({ hull, cannons: stat, sails: stat, crew: stat }), ...over,
  };
}

function battleOf(sides: [Combatant[], Combatant[]], seed = 3): Battle {
  const r = resolveBattle(sides, createRng(seed));
  return {
    id: "b1", tide: 4, nodeId: brineMap.nodeIds.find((id) => brineMap.node(id).type === "sea")!,
    sides: r.sides, rounds: r.rounds, ships: r.ships, outcome: r.outcome, winner: r.winner, loot: [], bountiesAdded: [],
  };
}

const NAMES = {
  captains: { ann: "Black Gull", bob: "Salt Widow", cat: "Red Tern" },
  npcs: { galleon: "galleon" as const, trader: "smallTrader" as const },
};

const ANN: Plan = ["broadside", "outmaneuver", "board"];
const BOB: Plan = ["board", "broadside", "outmaneuver"];   // ann's plan beats bob's every round

describe("buildReplay", () => {
  it("lists the two ships, each with the hull it started with, and one step per round", () => {
    const hurt = ship("ann", ANN, { hullPoints: 70 });
    const battle = battleOf([[hurt], [ship("bob", BOB)]]);
    const replay = buildReplay(battle, NAMES, brineMap);

    expect(replay.ships.map((s) => [s.id, s.label, s.side, s.slot, s.flagship])).toEqual([
      ["ann", "Black Gull", 0, 0, true], ["bob", "Salt Widow", 1, 0, true],
    ]);
    expect(replay.ships[0]).toMatchObject({ hullBefore: 70, maxHull: maxHullPoints("sloop", 0), npc: false });
    expect(replay.rounds).toHaveLength(battle.rounds.length);
    expect(replay.rounds.map((r) => r.round)).toEqual(battle.rounds.map((r) => r.round));
    expect(replay.title).toBe("Black Gull against Salt Widow");
    expect(replay.place).toBe(brineMap.node(battle.nodeId).name);
  });

  it("shows each plan as it was fought, with who had the edge", () => {
    const replay = buildReplay(battleOf([[ship("ann", ANN)], [ship("bob", BOB)]]), NAMES, brineMap);
    for (const [i, round] of replay.rounds.entries()) {
      const ann = round.moves.find((m) => m.shipId === "ann")!;
      const bob = round.moves.find((m) => m.shipId === "bob")!;
      expect(ann).toMatchObject({ maneuver: ANN[i], edge: "edge", stale: false });
      expect(bob).toMatchObject({ maneuver: BOB[i], edge: "weak" });
    }
  });

  it("says a maneuver was repeated, and calls an equal match even", () => {
    const repeat: Plan = ["board", "board", "board"];
    const replay = buildReplay(battleOf([[ship("ann", repeat)], [ship("bob", repeat)]]), NAMES, brineMap);
    expect(replay.rounds[0]!.moves.map((m) => m.edge)).toEqual(["even", "even"]);
    expect(replay.rounds[0]!.moves.every((m) => !m.stale)).toBe(true);
    if (replay.rounds.length > 1) expect(replay.rounds[1]!.moves.every((m) => m.stale)).toBe(true);
  });

  it("takes hull off round by round until it matches what the last round left", () => {
    const battle = battleOf([[ship("ann", ANN)], [ship("bob", BOB)]]);
    const replay = buildReplay(battle, NAMES, brineMap);
    const start = battle.ships!.bob!.hullBefore;
    const lost = replay.rounds.reduce((t, r) => t + r.hullLost.bob!, 0);
    expect(start - lost).toBeCloseTo(battle.rounds.at(-1)!.hullAfter.bob!, 6);
    for (const r of replay.rounds) {
      expect(r.hullLost.ann).toBeGreaterThanOrEqual(0);
      expect(r.hullAfter.bob).toBe(battle.rounds[r.round - 1]!.hullAfter.bob);
    }
  });

  it("never loses more hull than a ship had, so a sinking ship's last number is what it really lost", () => {
    const weak = ship("bob", BOB, { hullPoints: 5 });
    const replay = buildReplay(battleOf([[ship("ann", ANN)], [weak]]), NAMES, brineMap);
    expect(replay.rounds[0]!.hullLost.bob).toBe(5);
    expect(replay.rounds[0]!.hullAfter.bob).toBe(0);
    expect(replay.ending.struck).toEqual(["bob"]);
    expect(replay.ending).toMatchObject({ headline: "DECISIVE WIN", winnerSide: 0, winners: "Black Gull" });
  });

  it("puts the flagship first on a side and names a fleet", () => {
    const strong = ship("bob", BOB, { pr: 30 });
    const battle = battleOf([[ship("ann", ANN), strong, ship("cat", ANN)], [ship("galleon", BOB, { kind: "npc" })]]);
    const replay = buildReplay(battle, NAMES, brineMap);
    expect(replay.ships.filter((s) => s.side === 0).map((s) => s.id)).toEqual(["bob", "ann", "cat"]);
    expect(replay.ships.filter((s) => s.side === 0).map((s) => s.slot)).toEqual([0, 1, 2]);
    expect(replay.ships.find((s) => s.id === "galleon")).toMatchObject({ npc: true, label: "the Treasure Galleon" });
    expect(replay.title).toBe("Salt Widow, Black Gull and Red Tern against the Treasure Galleon");
  });

  it("works out starting hulls for a battle saved before the record held them", () => {
    const battle = battleOf([[ship("ann", ANN)], [ship("bob", BOB)]]);
    const { ships: _dropped, ...old } = battle;
    const replay = buildReplay(old, NAMES, brineMap);
    for (const s of replay.ships) expect(s.hullBefore).toBeCloseTo(battle.ships![s.id]!.hullBefore, 6);
    const lost = replay.rounds.reduce((t, r) => t + r.hullLost.bob!, 0);
    expect(replay.ships.find((s) => s.id === "bob")!.hullBefore - lost).toBeCloseTo(battle.rounds.at(-1)!.hullAfter.bob!, 6);
  });

  it("shows the winner's Parting Shot, never a loser's and never an NPC's", () => {
    const battle = battleOf([[ship("ann", ANN)], [ship("bob", BOB)]]);
    const shots = { ann: "  Mind the gulls.  ", bob: "I will be back." };
    expect(buildReplay(battle, NAMES, brineMap, shots).ending.partingShot).toEqual({ shipId: "ann", text: "Mind the gulls." });
    expect(buildReplay(battle, NAMES, brineMap, { bob: "I will be back." }).ending.partingShot).toBeNull();
    expect(buildReplay(battle, NAMES, brineMap, { ann: "   " }).ending.partingShot).toBeNull();

    const npcWin = battleOf([[ship("trader", BOB, { kind: "npc" })], [ship("ann", ANN, { hullPoints: 5 })]]);
    expect(buildReplay(npcWin, NAMES, brineMap, { trader: "Arr" }).ending.partingShot).toBeNull();
  });

  it("calls an even fight a draw, with no winner and no Parting Shot", () => {
    const same: Plan = ["board", "board", "board"];
    const battle = battleOf([[ship("ann", same)], [ship("bob", same)]], 11);
    const replay = buildReplay({ ...battle, outcome: "draw", winner: null }, NAMES, brineMap, { ann: "Hah" });
    expect(replay.ending).toMatchObject({ headline: "A DRAW", winners: "", winnerSide: null, partingShot: null });
  });
});

describe("MANEUVER_STYLE", () => {
  it("tells the three maneuvers apart by shape as well as by colour", () => {
    const styles = Object.values(MANEUVER_STYLE);
    expect(new Set(styles.map((s) => s.shape)).size).toBe(3);
    expect(new Set(styles.map((s) => s.colour)).size).toBe(3);
    expect(MANEUVER_STYLE.broadside.label).toBe("Broadside");
    expect(B.combat.rounds).toBeGreaterThan(0);
  });
});

describe("shortName", () => {
  it("drops the article, keeps what fits, and falls back to the first word", () => {
    expect(shortName("Black Gull")).toBe("Black Gull");
    expect(shortName("the Treasure Galleon")).toBe("Treasure");
    expect(shortName("a Small Trader")).toBe("Small");
    expect(shortName("Crooked Albatross")).toBe("Crooked");
    expect(shortName("Black Gull", 8)).toBe("Black");
    expect(shortName("Extraordinarilylong Name", 8)).toBe("Extraor.");
  });
});
