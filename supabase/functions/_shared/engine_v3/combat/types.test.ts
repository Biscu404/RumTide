import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { FIGHTING_STYLES } from "../types.ts";
import { BATTLE_SIDES, DECK_ORDERS, GUNS_ORDERS, HELM_MOVES, RANGES } from "./types.ts";
import type { BattleOutcome, Doctrine, OutcomeKind } from "./types.ts";

describe("combat types (P2.1)", () => {
  it("lists the six distances from far to near (D121)", () => {
    expect(RANGES).toEqual(["far", "long", "medium", "short", "close", "grappled"]);
  });

  it("lists the four Helm moves and the eleven orders a rule can give, the style orders and the Deck orders last", () => {
    expect(HELM_MOVES).toEqual(["closeIn", "hold", "openRange", "crossTheirBow"]);
    expect(GUNS_ORDERS).toEqual([
      "roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "mortar", "hotShot", "charge", "volley", "firePots",
    ]);
    expect(BATTLE_SIDES).toEqual(["hunter", "target"]);
  });

  it("lists the five things a crew fights with on deck: four Deck orders, and Fists, which a rule cannot give", () => {
    expect(DECK_ORDERS).toEqual(["charge", "volley", "repel", "firePots", "fists"]);
    expect(GUNS_ORDERS).not.toContain("fists");
    for (const order of DECK_ORDERS.filter((o) => o !== "fists")) expect(GUNS_ORDERS).toContain(order);
  });

  it("names all seven Fighting Styles", () => {
    expect(FIGHTING_STYLES).toEqual(["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"]);
  });

  it("agrees with the ammo table in balance.ts, which is the table of the Fighting Styles spec, with no Grappled column", () => {
    const fires = RANGES.slice(0, 5); // while Grappled the great guns are quiet
    for (const row of Object.values(B.combat.range)) expect(Object.keys(row)).toEqual([...fires]);
    expect(Object.keys(B.combat.range)).toEqual(["round", "chain", "grape", "mortar", "hot"]);
    const at = (row: keyof typeof B.combat.range) => fires.map((r) => B.combat.range[row][r as Exclude<typeof r, "grappled">]);
    expect(at("round")).toEqual([0.2, 0.6, 1.0, 1.0, 1.0]);
    expect(at("chain")).toEqual([0.4, 1.0, 0.8, 0.6, 0.4]);
    expect(at("grape")).toEqual([0, 0, 0.5, 0.85, 1.2]);
    expect(at("mortar")).toEqual([1.1, 1.1, 0.85, 0, 0]);
    expect(at("hot")).toEqual([0, 0.3, 0.3, 1.0, 1.0]);
  });


  it("covers the seven outcomes of GAMEPLAY 8.7", () => {
    const kinds: OutcomeKind[] = ["sunk", "captured", "struckColours", "crippled", "escaped", "victory", "draw"];
    const outcome: BattleOutcome = { kind: "draw", winner: null, loser: null, round: B.combat.rounds };
    expect(kinds).toHaveLength(7);
    expect(outcome.kind).toBe("draw");
  });

  it("can write down the Boarders doctrine of GAMEPLAY 8.8, and survives a JSON round trip", () => {
    const boarders: Doctrine = {
      name: "Boarders",
      rules: [
        { if: [{ kind: "track", who: "theirs", track: "hull", op: "below", pct: 30 }], then: { kind: "fight", helm: "closeIn", guns: "board" } },
        { if: [{ kind: "range", op: "is", range: "long" }], then: { kind: "fight", helm: "closeIn", guns: "chainShot" } },
        { if: [{ kind: "enemyType", type: "merchant" }], then: { kind: "fight", helm: "closeIn", guns: "grapeshot" } },
        { if: [{ kind: "round", op: "is", n: 3 }, { kind: "abilityUnused", ability: "gunner.double_shot" }], then: { kind: "ability", ability: "gunner.double_shot" } },
        { if: [], then: { kind: "fight", helm: "crossTheirBow", guns: "roundShot" } },
      ],
    };
    expect(boarders.rules).toHaveLength(5);
    expect(boarders.rules.at(-1)?.if).toEqual([]); // Otherwise has no conditions
    expect(JSON.parse(JSON.stringify(boarders))).toEqual(boarders);
  });

  it("can write down the other conditions and actions", () => {
    const rest: Doctrine = {
      name: "Coward",
      rules: [
        { if: [{ kind: "track", who: "mine", track: "hull", op: "below", pct: 50 }], then: { kind: "surrender" } },
        { if: [{ kind: "theirLastHelm", move: "closeIn" }, { kind: "theirLastGuns", order: "grapeshot" }], then: { kind: "jettison" } },
        { if: [{ kind: "windGauge", holder: "mine" }, { kind: "terrain", terrain: "fog" }], then: { kind: "fight", helm: "hold", guns: "holdFire" } },
        { if: [{ kind: "enemyCaptain", captainId: "cap_x" }, { kind: "havePowder" }], then: { kind: "fight", helm: "openRange", guns: "repel" } },
        { if: [], then: { kind: "fight", helm: "openRange", guns: "roundShot" } },
      ],
    };
    expect(rest.rules.map((r) => r.then.kind)).toEqual(["surrender", "jettison", "fight", "fight", "fight"]);
  });
});
