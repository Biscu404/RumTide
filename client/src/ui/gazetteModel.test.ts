import { describe, expect, it } from "vitest";
import brineJson from "../../../supabase/functions/_shared/maps/brine.json";
import { loadMap } from "@engine/map.ts";
import { resolveTide } from "@engine/resolve.ts";
import { startSeason } from "@engine/season.ts";
import type { Maneuver, Orders } from "@engine/types.ts";
import { battleFromRow } from "../net/rows.ts";
import { describeBattle, listOf, shipLabel } from "./gazetteModel.ts";

const map = loadMap(brineJson);
const PLAN: [Maneuver, Maneuver, Maneuver] = ["broadside", "outmaneuver", "board"];
const order = (id: string, o: Partial<Orders> = {}): Orders => ({
  tide: 1, captainId: id, course: [], intent: "trade", plan: PLAN, parley: "off", noQuarter: false, ready: true, ...o,
});

/** A real Tide in which ann hunts bob at sea, played by the engine, until a fight happens. */
function fight() {
  for (let seed = 1; seed < 200; seed++) {
    const snap = startSeason(map, "s1", "season0", [{ id: "ann", fleetId: null }, { id: "bob", fleetId: null }], 1);
    const placed = { ...snap, npcs: [], ships: snap.ships.map((s) => ({ ...s, nodeId: "sea06", docked: false })) };
    const result = resolveTide(map, placed, [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob")], seed);
    if (result.battles.length > 0) return result;
  }
  throw new Error("no fight in 200 seeds");
}

const names = { captains: { ann: "Ann's Revenge", bob: "Bob's Folly" }, npcs: {} };

describe("Battle text", () => {
  it("lists every round with every ship and the damage the record holds", () => {
    const { battles } = fight();
    const battle = battles[0]!;
    const text = describeBattle(battle, names, map);
    expect(text.rounds).toHaveLength(battle.rounds.length);
    battle.rounds.forEach((round, i) => {
      expect(text.rounds[i]!.ships).toHaveLength(round.ships.length);
      round.ships.forEach((record, j) => {
        expect(text.rounds[i]!.ships[j]).toContain(`dealt ${Math.round(record.damage)}.`);
      });
      expect(text.rounds[i]!.summary).toContain(`dealt ${Math.round(round.sideDamage[0])}`);
    });
    expect(text.place).toBe(map.node("sea06").name);
  });

  it("names the winner of a battle that has one, and says draw otherwise", () => {
    const battle = fight().battles[0]!;
    const text = describeBattle(battle, names, map);
    if (battle.winner === null) expect(text.result).toMatch(/draw/i);
    else expect(text.result).toContain(battle.winner === 0 ? text.title.split(" against ")[0]! : text.title.split(" against ")[1]!);
  });

  it("reads the same after a trip through the database column names", () => {
    const battle = fight().battles[0]!;
    const row = {
      id: battle.id, tide: battle.tide, node_id: battle.nodeId, sides: battle.sides, rounds: battle.rounds,
      ships: battle.ships, outcome: battle.outcome, winner: battle.winner, loot: battle.loot, bounties_added: battle.bountiesAdded,
    };
    expect(battleFromRow(row)).toEqual(battle);
    expect(battle.ships).toBeDefined();
  });

  it("reads a battle saved before the record held starting hulls, without them", () => {
    const { ships: _ships, ...old } = fight().battles[0]!;
    const row = {
      id: old.id, tide: old.tide, node_id: old.nodeId, sides: old.sides, rounds: old.rounds, ships: null,
      outcome: old.outcome, winner: old.winner, loot: old.loot, bounties_added: old.bountiesAdded,
    };
    expect(battleFromRow(row)).toEqual(old);
    expect("ships" in battleFromRow(row)).toBe(false);
  });

  it("lists loot and bounties from the record", () => {
    const real = fight().battles[0]!;
    const battle = {
      ...real,
      loot: [{ fromId: "bob", toId: "ann", gold: 120.4 }],
      bountiesAdded: [{ captainId: "ann", amount: 60, reasons: ["huntedWeaker" as const] }],
    };
    expect(describeBattle(battle, names, map).aftermath).toEqual([
      "Ann's Revenge took 120 doubloons from Bob's Folly.",
      "A bounty of 60 doubloons was put on Ann's Revenge.",
    ]);
    expect(describeBattle({ ...real, loot: [], bountiesAdded: [] }, names, map).aftermath).toEqual([]);
  });

  it("names merchants by kind and falls back for unknown ids", () => {
    const n = { captains: { ann: "Ann's Revenge" }, npcs: { "npc-1": "galleon" as const } };
    expect(shipLabel("npc-1", n)).toBe("the Treasure Galleon");
    expect(shipLabel("ghost", n)).toBe("an unknown ship");
    expect(listOf(["a", "b", "c"])).toBe("a, b and c");
  });
});
