import { describe, expect, it } from "vitest";
import { B, powerRating, statValue } from "./balance.ts";
import { matchup, pickFlagship, resolveBattle, type Combatant } from "./combat.ts";
import { createRng, type Rng } from "./rng.ts";
import type { Maneuver } from "./types.ts";

type Plan = [Maneuver, Maneuver, Maneuver];

/** An Rng whose luck is always the same, so the worked example can be checked by hand. */
const fixedLuck = (luck = 1): Rng => ({
  next: () => 0.5, int: () => 0, range: () => luck, pick: (items) => items[0]!, shuffle: (items) => [...items],
});

/** A sloop with every stat at `level`, hull at full. Extra fields override. */
function sloop(id: string, plan: Plan, over: Partial<Combatant> = {}, level = 0): Combatant {
  const stat = statValue("sloop", level);
  const hull = 100 * (1 + B.upgrade.statPerLevel * level);
  return {
    id, kind: "player", cannons: stat, sails: stat, crew: stat,
    hullPoints: hull, maxHull: hull, plan,
    pr: powerRating({ hull, cannons: stat, sails: stat, crew: stat }),
    ...over,
  };
}

describe("matchup", () => {
  it("is a triangle: broadside beats board beats outmaneuver beats broadside", () => {
    expect(matchup("broadside", "board")).toBe(B.combat.win);
    expect(matchup("board", "outmaneuver")).toBe(B.combat.win);
    expect(matchup("outmaneuver", "broadside")).toBe(B.combat.win);
    expect(matchup("board", "broadside")).toBe(B.combat.lose);
    expect(matchup("outmaneuver", "board")).toBe(B.combat.lose);
    expect(matchup("broadside", "outmaneuver")).toBe(B.combat.lose);
  });

  it("is a tie on the same maneuver", () => {
    for (const m of ["broadside", "board", "outmaneuver"] as const) {
      expect(matchup(m, m)).toBe(B.combat.tie);
    }
  });
});

describe("worked example, section 7.4", () => {
  // The Salty Gull has Cannons level 1 (11.2). The Wet Sock is a fresh sloop. Luck is ignored.
  const gull = (): Combatant => {
    const cannons = statValue("sloop", 1);
    return sloop("gull", ["broadside", "outmaneuver", "board"], {
      cannons, pr: powerRating({ hull: 100, cannons, sails: 10, crew: 10 }), startedHunt: true,
    });
  };
  const sock = () => sloop("sock", ["board", "board", "broadside"]);

  it("deals the damage printed in the table, round by round", () => {
    const result = resolveBattle([[gull()], [sock()]], fixedLuck());
    const damage = result.rounds.map((r) => r.ships.map((s) => s.damage));
    expect(damage[0]![0]).toBeCloseTo(47.1, 1);
    expect(damage[0]![1]).toBeCloseTo(11.0, 1);
    expect(damage[1]![0]).toBeCloseTo(11.0, 1);
    expect(damage[1]![1]).toBeCloseTo(35.2, 1);
    expect(damage[2]![0]).toBeCloseTo(11.0, 1);
    expect(damage[2]![1]).toBeCloseTo(44.0, 1);
  });

  it("gives the Sock a Victory: 69% against 90% of max hull", () => {
    const result = resolveBattle([[gull()], [sock()]], fixedLuck());
    expect(result.shares[0]).toBeCloseTo(0.691, 2);
    expect(result.shares[1]).toBeCloseTo(0.902, 2);
    expect(result.outcome).toBe("victory");
    expect(result.winner).toBe(1);
    expect(result.rounds).toHaveLength(3);
  });

  it("marks the repeated Board in round 2 as stale", () => {
    const result = resolveBattle([[gull()], [sock()]], fixedLuck());
    expect(result.rounds[1]!.ships.find((s) => s.shipId === "sock")!.stale).toBe(true);
    expect(result.rounds[1]!.ships.find((s) => s.shipId === "gull")!.stale).toBe(false);
    expect(result.rounds[0]!.ships.every((s) => !s.stale)).toBe(true);
  });
});

describe("outcomes", () => {
  it("is a draw when both sides deal about the same damage", () => {
    const plan: Plan = ["broadside", "board", "outmaneuver"];
    const result = resolveBattle([[sloop("a", plan)], [sloop("b", plan)]], fixedLuck());
    expect(result.outcome).toBe("draw");
    expect(result.winner).toBeNull();
    expect(result.rounds).toHaveLength(3);
  });

  it("needs a margin of 10 points for a Victory", () => {
    // a wins round 1 outright, then both play Board, so the margin is more than 10 points.
    const a = sloop("a", ["broadside", "board", "board"]);
    const b = sloop("b", ["board", "board", "board"]);
    const win = resolveBattle([[a], [b]], fixedLuck());
    expect(win.shares[0] - win.shares[1]).toBeGreaterThan(B.combat.victoryMargin);
    expect(win.outcome).toBe("victory");
    expect(win.winner).toBe(0);
  });

  it("ends the battle after the round in which a hull reaches zero", () => {
    const strong = sloop("strong", ["broadside", "broadside", "broadside"], { cannons: 40 });
    const weak = sloop("weak", ["board", "board", "board"], { hullPoints: 30 });
    const result = resolveBattle([[strong], [weak]], fixedLuck());
    expect(result.outcome).toBe("decisive");
    expect(result.winner).toBe(0);
    expect(result.rounds).toHaveLength(1);
    expect(result.hullAfter.weak).toBe(0);
    expect(result.hullAfter.strong).toBeGreaterThan(0);
  });

  it("never reports a hull below zero", () => {
    const strong = sloop("strong", ["broadside", "broadside", "broadside"], { cannons: 400 });
    const weak = sloop("weak", ["board", "board", "board"]);
    const result = resolveBattle([[strong], [weak]], fixedLuck());
    for (const round of result.rounds) {
      for (const hp of Object.values(round.hullAfter)) expect(hp).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives a double knockout to whoever dealt more damage", () => {
    const a = sloop("a", ["broadside", "broadside", "broadside"], { cannons: 40, hullPoints: 5 });
    const b = sloop("b", ["board", "board", "board"], { crew: 30, hullPoints: 5 });
    const result = resolveBattle([[a], [b]], fixedLuck());
    expect(result.hullAfter).toEqual({ a: 0, b: 0 });
    expect(result.outcome).toBe("decisive");
    expect(result.winner).toBe(0);   // a's matchup is 2.0, b's is 0.5
  });

  it("is a draw if both hulls reach zero and the damage is exactly equal", () => {
    const plan: Plan = ["broadside", "broadside", "broadside"];
    const result = resolveBattle([[sloop("a", plan, { hullPoints: 5 })], [sloop("b", plan, { hullPoints: 5 })]], fixedLuck());
    expect(result.outcome).toBe("draw");
    expect(result.winner).toBeNull();
  });
});

describe("luck and replay", () => {
  const sides = () => [[sloop("a", ["broadside", "board", "outmaneuver"])], [sloop("b", ["board", "board", "broadside"])]] as const;

  it("keeps luck between 0.9 and 1.1", () => {
    const result = resolveBattle(sides(), createRng(7));
    for (const s of result.rounds.flatMap((r) => r.ships)) {
      expect(s.luck).toBeGreaterThanOrEqual(B.combat.luckMin);
      expect(s.luck).toBeLessThan(B.combat.luckMax);
    }
  });

  it("gives the same battle for the same seed, whatever order the ships are listed in", () => {
    const x = resolveBattle(sides(), createRng(42));
    const y = resolveBattle(sides(), createRng(42));
    expect(y).toEqual(x);
    const [one, two] = [
      resolveBattle([[sloop("a", ["board", "board", "board"]), sloop("c", ["broadside", "board", "board"])], [sloop("b", ["board", "board", "board"])]], createRng(5)),
      resolveBattle([[sloop("c", ["broadside", "board", "board"]), sloop("a", ["board", "board", "board"])], [sloop("b", ["board", "board", "board"])]], createRng(5)),
    ];
    expect(two).toEqual(one);
  });

  it("gives different battles for different seeds", () => {
    const x = resolveBattle(sides(), createRng(1));
    const y = resolveBattle(sides(), createRng(2));
    expect(y.rounds[0]!.ships[0]!.luck).not.toBe(x.rounds[0]!.ships[0]!.luck);
  });

  it("does not change the input", () => {
    const [a, b] = sides();
    const before = JSON.stringify([a, b]);
    resolveBattle([a, b], createRng(3));
    expect(JSON.stringify([a, b])).toBe(before);
  });
});

describe("fleet battles, section 7.5", () => {
  const plan: Plan = ["broadside", "board", "outmaneuver"];

  it("picks the highest PR ship as flagship, the hunt starter on a tie, then the lower id", () => {
    expect(pickFlagship([sloop("a", plan, { pr: 10 }), sloop("b", plan, { pr: 12 })]).id).toBe("b");
    expect(pickFlagship([sloop("a", plan, { pr: 10 }), sloop("b", plan, { pr: 10, startedHunt: true })]).id).toBe("b");
    expect(pickFlagship([sloop("b", plan), sloop("a", plan)]).id).toBe("a");
  });

  it("judges each ship against the enemy flagship's maneuver, not against its own opponent", () => {
    const flag = sloop("flag", ["broadside", "broadside", "broadside"], { pr: 20 });
    const mate = sloop("mate", ["board", "board", "board"], { pr: 10 });
    const enemy = sloop("enemy", ["board", "board", "board"]);
    const result = resolveBattle([[flag, mate], [enemy]], fixedLuck());
    const round = result.rounds[0]!.ships;
    expect(round.find((s) => s.shipId === "flag")!.matchup).toBe(B.combat.win);   // broadside vs board
    expect(round.find((s) => s.shipId === "mate")!.matchup).toBe(B.combat.tie);   // board vs board
    expect(round.find((s) => s.shipId === "enemy")!.matchup).toBe(B.combat.lose); // board vs flagship's broadside
  });

  it("adds +10% damage per extra ship, up to +30%", () => {
    const enemy = (n: number) => Array.from({ length: n }, (_, i) => sloop(`e${i}`, plan));
    const mates = (n: number) => Array.from({ length: n }, (_, i) => sloop(`m${i}`, plan));
    const side = (ships: Combatant[]) => resolveBattle([ships, enemy(ships.length)], fixedLuck()).rounds[0]!;
    const one = side(mates(1)).sideDamage[0];
    expect(side(mates(2)).sideDamage[0] / (2 * one)).toBeCloseTo(1.1, 5);
    expect(side(mates(3)).sideDamage[0] / (3 * one)).toBeCloseTo(1.2, 5);
    expect(side(mates(5)).sideDamage[0] / (5 * one)).toBeCloseTo(1.3, 5);   // capped at +30%
    expect(side(mates(6)).sideDamage[0] / (6 * one)).toBeCloseTo(1.3, 5);
  });

  it("gives an outnumbered side of players Desperate Defence: +25% per extra enemy ship", () => {
    const solo = sloop("solo", plan);
    const gang = [sloop("g1", plan), sloop("g2", plan), sloop("g3", plan)];
    const round = resolveBattle([[solo], gang], fixedLuck()).rounds[0]!;
    const base = round.ships.find((s) => s.shipId === "solo")!.damage;
    expect(round.sideDamage[0] / base).toBeCloseTo(1 + 0.25 * 2, 5);
    // The gang has no Desperate Defence, only its fleet bonus.
    const gangBase = round.ships.filter((s) => s.shipId !== "solo").reduce((t, s) => t + s.damage, 0);
    expect(round.sideDamage[1] / gangBase).toBeCloseTo(1.2, 5);
  });

  it("caps Desperate Defence at +75%", () => {
    const gang = Array.from({ length: 6 }, (_, i) => sloop(`g${i}`, plan));
    const round = resolveBattle([[sloop("solo", plan)], gang], fixedLuck()).rounds[0]!;
    const base = round.ships.find((s) => s.shipId === "solo")!.damage;
    expect(round.sideDamage[0] / base).toBeCloseTo(1.75, 5);
  });

  it("does not give Desperate Defence to NPC bosses", () => {
    const boss = sloop("galleon", plan, { kind: "npc" });
    const fleet = [sloop("a", plan), sloop("b", plan), sloop("c", plan)];
    const round = resolveBattle([[boss], fleet], fixedLuck()).rounds[0]!;
    const base = round.ships.find((s) => s.shipId === "galleon")!.damage;
    expect(round.sideDamage[0] / base).toBeCloseTo(1, 5);
  });

  it("splits the damage a side takes across its ships in proportion to max hull", () => {
    const big = sloop("big", plan, { hullPoints: 300, maxHull: 300 });
    const small = sloop("small", plan, { hullPoints: 100, maxHull: 100 });
    const enemy = sloop("enemy", plan, { hullPoints: 1000, maxHull: 1000 });
    const round = resolveBattle([[big, small], [enemy]], fixedLuck()).rounds[0]!;
    const lostBig = 300 - round.hullAfter.big!, lostSmall = 100 - round.hullAfter.small!;
    expect(lostBig / lostSmall).toBeCloseTo(3, 5);
    expect(lostBig + lostSmall).toBeCloseTo(round.sideDamage[1], 5);
  });

  it("ends the whole battle when any ship reaches zero", () => {
    const strong = sloop("strong", ["broadside", "broadside", "broadside"], { cannons: 60 });
    const fragile = sloop("fragile", plan, { hullPoints: 1 });
    const sturdy = sloop("sturdy", plan, { hullPoints: 100 });
    const result = resolveBattle([[strong], [fragile, sturdy]], fixedLuck());
    expect(result.rounds).toHaveLength(1);
    expect(result.outcome).toBe("decisive");
    expect(result.winner).toBe(0);
    expect(result.hullAfter.fragile).toBe(0);
  });

  it("records both sides with their flagships, players and NPCs apart", () => {
    const boss = sloop("galleon", plan, { kind: "npc", pr: 28 });
    const result = resolveBattle([[sloop("b", plan), sloop("a", plan, { startedHunt: true })], [boss]], fixedLuck());
    expect(result.sides[0]).toEqual({ captainIds: ["a", "b"], npcIds: [], flagshipId: "a" });
    expect(result.sides[1]).toEqual({ captainIds: [], npcIds: ["galleon"], flagshipId: "galleon" });
  });

  it("tracks the damage each ship dealt, for splitting loot", () => {
    const result = resolveBattle([[sloop("a", plan), sloop("b", plan)], [sloop("c", plan)]], fixedLuck());
    const total = result.rounds.reduce((t, r) => t + r.ships.filter((s) => s.shipId === "a").reduce((x, s) => x + s.damage, 0), 0);
    expect(result.damageDealt.a).toBeCloseTo(total, 8);
  });
});

describe("bad input", () => {
  const plan: Plan = ["broadside", "board", "outmaneuver"];

  it("refuses an empty side, a ship on both sides, a short plan and a ship with no hull", () => {
    expect(() => resolveBattle([[], [sloop("a", plan)]], fixedLuck())).toThrow(/at least one ship/);
    expect(() => resolveBattle([[sloop("a", plan)], [sloop("a", plan)]], fixedLuck())).toThrow(/twice/);
    expect(() => resolveBattle([[sloop("a", plan, { plan: ["board"] })], [sloop("b", plan)]], fixedLuck())).toThrow(/plan/);
    expect(() => resolveBattle([[sloop("a", plan, { hullPoints: 0 })], [sloop("b", plan)]], fixedLuck())).toThrow(/hull/);
  });
});

describe("the record the replay draws from", () => {
  it("keeps each ship's hull at the start and its maximum, in id order, and the rounds add up to what is left", () => {
    const hurt = sloop("a", ["board", "board", "board"], { hullPoints: 60 });
    const result = resolveBattle([[hurt], [sloop("b", ["broadside", "broadside", "broadside"])]], fixedLuck());
    expect(Object.keys(result.ships)).toEqual(["a", "b"]);
    expect(result.ships.a).toEqual({ hullBefore: 60, maxHull: 100 });
    expect(result.ships.b).toEqual({ hullBefore: 100, maxHull: 100 });

    // Start hull minus what each round took is what the last round says is left, so a replay can
    // show the hull going down without any number the record does not hold.
    let hull = result.ships.b!.hullBefore;
    for (const r of result.rounds) {
      expect(r.hullAfter.b).toBeCloseTo(Math.max(0, hull - r.sideDamage[0]), 6);
      hull = r.hullAfter.b!;
    }
  });

  it("does not change how a battle is fought", () => {
    const sides = () => [[sloop("a", ["board", "outmaneuver", "broadside"])], [sloop("b", ["broadside", "board", "outmaneuver"])]] as const;
    const { ships: _ships, ...rest } = resolveBattle(sides(), createRng(7));
    expect(rest.rounds).toEqual(resolveBattle(sides(), createRng(7)).rounds);
  });
});
