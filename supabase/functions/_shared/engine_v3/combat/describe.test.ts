import { describe, expect, it } from "vitest";
import { formatReplay, resolveTide } from "../index.ts";
import type { Orders, ReplayEvent } from "../types.ts";
import { season, world } from "../testing.ts";
import { runBattle } from "./battle.ts";
import { describeBattle, describeCarried } from "./describe.ts";
import type { BattleAftermath } from "./types.ts";
import { always, battleOf, scripted, surrendersAt, testShip } from "./testing.ts";

const words = { place: (id: string) => `<${id}>` };
const none: BattleAftermath = {
  pvp: true, winner: null, loser: null, loot: null, wreck: null, flotsam: [], bounty: { added: 0, collected: 0 }, shieldUntil: null, towed: false,
};

describe("carried goods in words", () => {
  it("lists doubloons then goods, with and", () => {
    expect(describeCarried({ plunder: 0, goods: {} })).toBe("nothing");
    expect(describeCarried({ plunder: 1, goods: {} })).toBe("1 doubloon");
    expect(describeCarried({ plunder: 30, goods: { rum: 2 } })).toBe("30 doubloons and 2 rum");
    expect(describeCarried({ plunder: 30, goods: { rum: 2, spice: 1 } })).toBe("30 doubloons, 2 rum and 1 spice");
    expect(describeCarried({ plunder: 0, goods: { sugar: 5 } })).toBe("5 sugar");
  });
});

describe("a battle in words (P2.4)", () => {
  const fight = (hunter = always("closeIn", "roundShot"), target = always("closeIn", "roundShot"), over = {}) =>
    runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter, target }, over));

  it("opens with who, where, the doctrines, the ground, the start range and the gauge", () => {
    const record = fight();
    const lines = describeBattle(record, none, words);
    expect(lines[0]).toBe(
      "BATTLE at <dw_shallows>: The hunter (Scripted hunter) against The target (Scripted target). "
      + "They fight on open water, in a breeze. They start at Long range. Nobody holds the wind gauge.",
    );
  });

  it("names the gauge holder, the ground and the wind", () => {
    const hunter = testShip("hunter", "sloop", { sails: 14 });
    const record = runBattle(battleOf(hunter, testShip("target"), { hunter: always("hold", "holdFire"), target: always("hold", "holdFire") }, { terrain: "reef", wind: "gale" }));
    expect(describeBattle(record, none, words)[0]).toContain("They fight on a Reef, in a gale. They start at Long range. The hunter holds the wind gauge.");
  });

  it("tells each round: the plays, the range, the shots", () => {
    const lines = describeBattle(fight(), none, words);
    expect(lines).toContain("  Round 1, at Long range.");
    expect(lines).toContain("    The hunter plays Close In and Round shot (rule 1).");
    expect(lines).toContain("    The range goes from Long to Close.");
    expect(lines.some((l) => /^ {4}The hunter's Round shot takes \d+ Hull off The target\.$/.test(l))).toBe(true);
  });

  it("tells a grapple and the fight hand to hand", () => {
    const lines = describeBattle(fight(always("closeIn", "board"), always("closeIn", "board"), { }), none, words);
    const text = lines.join("\n");
    expect(text).toMatch(/grapples the enemy/);
    expect(text).toMatch(/The crews fight hand to hand: The hunter \(strength \d+\) loses \d+ Hands, The target \(strength \d+\) loses \d+ Hands\. \d+ and \d+ Hands are left\./);
  });

  it("tells Hold Fire, a Helm contest, a reef scrape and a Crippled ship", () => {
    const holdFire = describeBattle(fight(always("hold", "holdFire"), always("hold", "holdFire")), none, words).join("\n");
    expect(holdFire).toContain("holds fire and saves the shot for next round.");
    const reef = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("closeIn", "roundShot"), target: always("closeIn", "roundShot") }, { terrain: "reef" }));
    expect(describeBattle(reef, none, words).join("\n")).toContain("scrapes the reef and loses 10 Hull.");
    const chase = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("closeIn", "roundShot"), target: always("openRange", "roundShot") }));
    expect(describeBattle(chase, none, words).join("\n")).toMatch(/Helm contest for the chase: .* wins \(The hunter had a \d+% chance\)\./);
    const cripple = runBattle(battleOf(testShip("hunter"), testShip("target", "sloop", { riggingPoints: 5 }), { hunter: always("hold", "chainShot"), target: always("hold", "roundShot") }, { terrain: "open" }));
    expect(describeBattle(cripple, none, words).join("\n")).toContain("The target's Rigging is gone. It is Crippled");
  });

  it("tells a ship that strikes its colours, and a pair that part", () => {
    const struck = describeBattle(fight(always("closeIn", "roundShot"), surrendersAt(2, always("closeIn", "roundShot"))), none, words).join("\n");
    expect(struck).toContain("The target strikes its colours. Nothing else happens this round.");
    expect(struck).toContain("The target has struck its colours. The hunter wins.");
    const apart = describeBattle(fight(always("openRange", "roundShot"), always("openRange", "roundShot")), none, words).join("\n");
    expect(apart).toContain("Both ships turn away past Long range, and the fight is over.");
    expect(apart).toContain("Escaped: the ships part in round 1.");
  });

  it("tells the end of a battle that goes the distance", () => {
    const draw = describeBattle(fight(always("hold", "holdFire"), always("hold", "holdFire")), none, words).join("\n");
    expect(draw).toContain("A draw after round 5. Nobody wins and nobody loses anything.");
    const sunk = runBattle(battleOf(testShip("hunter"), testShip("target", "sloop", { hullPoints: 4 }), { hunter: always("hold", "roundShot"), target: scripted({}, ["hold", "holdFire"]) }));
    expect(describeBattle(sunk, none, words).join("\n")).toContain("The target is sunk in round 1. The hunter wins.");
  });

  it("tells what the winner took and what was left behind", () => {
    const record = fight();
    const aftermath: BattleAftermath = {
      pvp: true, winner: record.hunter, loser: record.target, towed: true, shieldUntil: 9,
      loot: { share: 0.25, fairness: 0.25, cradle: 0.5, capped: true, taken: { plunder: 12, goods: { rum: 2 } }, lost: { plunder: 90, goods: { rum: 8 } } },
      wreck: { id: "wreck_t5_ship_target", water: "dw_shallows", goods: { rum: 6 }, plunder: 78, untilTide: 9 },
      flotsam: [{ id: "flotsam_t5_ship_hunter", water: "dw_shallows", goods: { sugar: 3 }, plunder: 0, untilTide: 7 }],
      bounty: { added: 52, collected: 70 },
    };
    const text = describeBattle(record, aftermath, words).join("\n");
    expect(text).toContain("The hunter takes 12 doubloons and 2 rum (25% of what The target carried, the fairness factor is 0.25, loot is halved in the Cradle, the per battle cap applies).");
    expect(text).toContain("78 doubloons and 6 rum is left in a Wreck at <dw_shallows> until Tide 9.");
    expect(text).toContain("3 sugar floats free at <dw_shallows> until Tide 7.");
    expect(text).toContain("The hunter collects the 70 doubloon bounty on The target.");
    expect(text).toContain("The Admiralty puts a 52 doubloon bounty on The hunter.");
    expect(text).toContain("The target is shielded from other players until Tide 9.");
  });

  it("does not mention the fairness factor against an NPC", () => {
    const record = fight();
    const aftermath: BattleAftermath = {
      ...none, pvp: false, winner: record.hunter, loser: record.target,
      loot: { share: 0.4, fairness: 1, cradle: 1, capped: false, taken: { plunder: 5, goods: {} }, lost: { plunder: 5, goods: {} } },
    };
    expect(describeBattle(record, aftermath, words).join("\n")).toContain("The hunter takes 5 doubloons (40% of what The target carried).");
  });
});

describe("the replay in words (P2.4)", () => {
  const orders: Record<string, Orders> = {
    h: { tide: 6, planA: { steps: [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" } }] } },
    t: { tide: 6, planA: { steps: [{ kind: "sail", to: "gh_lee" }] } },
  };

  it("prints parley, escape, battle and tow events as sentences", () => {
    const state = season([{ id: "h", name: "Hester", shipName: "Hunter", water: "gh_lee" }, { id: "t", name: "Tobias", shipName: "Target", water: "dw_harbour" }], 6);
    const events: ReplayEvent[] = [];
    for (let seed = 1; seed <= 60 && !events.some((e) => e.kind === "battle"); seed++) {
      events.length = 0;
      events.push(...resolveTide({ state, world, orders, seed, windOverride: { cradle: { kind: "breeze", from: 270 } } }).replay);
    }
    const lines = formatReplay(world, state, events);
    expect(lines.some((l) => /BATTLE at the lane between Driftwood Harbour and Gullhaven Lee: Hunter \(Brawler\) against Target \(Brawler\)\./.test(l))).toBe(true);
    expect(lines.some((l) => /^ {7}.*Round 1, at Long range\./.test(l))).toBe(true);
    expect(lines.some((l) => l.includes("tries to slip away from Hunter") && l.includes("it is caught"))).toBe(true);
    expect(lines.every((l) => !l.includes("—") && !l.includes("–"))).toBe(true);

    const text = formatReplay(world, state, [
      { t: 2, kind: "parley", hunter: "ship_h", target: "ship_t", threshold: 1.25, accepted: true, paid: { plunder: 10, goods: { rum: 1 } } },
      { t: 2, kind: "parley", hunter: "ship_h", target: "ship_t", threshold: 1.25, accepted: false, paid: { plunder: 0, goods: {} } },
      { t: 2, kind: "escape", hunter: "ship_h", target: "ship_t", chance: 0.5, roll: 0.12, escaped: true },
      { t: 9, kind: "towed", ship: "ship_t", from: "gh_reefside", to: "gh_harbour", hullPoints: 50, banked: 35 },
    ]).join("\n");
    expect(text).toContain("Target offers parley to Hunter and pays 10 doubloons and 1 rum in tribute. Both sail on.");
    expect(text).toContain("Target offers parley, but Hunter flies No Quarter.");
    expect(text).toContain("Target tries to slip away from Hunter (50% chance, rolled 0.12): it gets clean away.");
    expect(text).toContain("Target is towed from Gullhaven Reefside to Gullhaven Harbour and docked with 50 Hull. It banks 35 doubloons.");
  });
});
