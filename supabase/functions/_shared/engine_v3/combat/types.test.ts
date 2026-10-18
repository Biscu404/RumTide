import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { BATTLE_SIDES, GUNS_ORDERS, HELM_MOVES, RANGES } from "./types.ts";
import type { BattleOutcome, Doctrine, OutcomeKind } from "./types.ts";

describe("combat types (P2.1)", () => {
  it("lists the four range bands from far to near", () => {
    expect(RANGES).toEqual(["long", "medium", "close", "grappled"]);
  });

  it("lists the four Helm moves and the six Guns orders", () => {
    expect(HELM_MOVES).toEqual(["closeIn", "hold", "openRange", "crossTheirBow"]);
    expect(GUNS_ORDERS).toEqual(["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel"]);
    expect(BATTLE_SIDES).toEqual(["hunter", "target"]);
  });

  it("agrees with the ammo table in balance.ts", () => {
    for (const row of Object.values(B.combat.range)) expect(Object.keys(row)).toEqual([...RANGES]);
    expect(Object.keys(B.combat.range)).toEqual(["round", "chain", "grape"]);
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
