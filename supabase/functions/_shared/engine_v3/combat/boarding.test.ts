import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { Rng } from "../rng.ts";
import type { Terrain } from "../types.ts";
import { boardingStrength, captureCheck, cutFree, grappleAttempts, meleeRound, surrenders } from "./boarding.ts";
import { battleRng, helmScore, resolveHelm } from "./helm.ts";
import { deepFreeze, ScriptedRng, testShip } from "./testing.ts";
import type { BattleShip, BattleSide, GunsOrder, HelmMove } from "./types.ts";

const C = B.combat;
const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);
const sides = <T>(h: T, t: T): Record<BattleSide, T> => ({ hunter: h, target: t });

describe("boarding strength (P2.2, GAMEPLAY 8.6)", () => {
  it("is Hands, a fresh sloop's 30", () => {
    expect(boardingStrength(hunter(), "grapeshot", "open")).toBe(30);
  });

  it("grows with the Bosun, trait and Background bonuses", () => {
    expect(boardingStrength(hunter({ boardingBonus: 0.1 }), "roundShot", "open")).toBeCloseTo(33);
  });

  it("is the Repel factor times for a ship that plays Repel, and no other order", () => {
    expect(boardingStrength(hunter(), "repel", "open")).toBeCloseTo(30 * C.boarding.repel);
    for (const order of ["roundShot", "chainShot", "grapeshot", "holdFire", "board"] as const) {
      expect(boardingStrength(hunter(), order, "open")).toBe(30);
    }
  });

  it("is 15% more in Kelp (2.2), and in no other water", () => {
    expect(boardingStrength(hunter(), "grapeshot", "kelp")).toBeCloseTo(30 * C.kelpBoarding);
    for (const terrain of ["open", "shallows", "reef", "rocky", "fog"] as const) {
      expect(boardingStrength(hunter(), "grapeshot", terrain)).toBe(30);
    }
  });

  it("multiplies the bonuses together", () => {
    expect(boardingStrength(hunter({ boardingBonus: 0.2 }), "repel", "kelp")).toBeCloseTo(30 * 1.2 * C.boarding.repel * C.kelpBoarding);
  });

  it("is zero for a ship with no Hands", () => {
    expect(boardingStrength(hunter({ hands: 0 }), "repel", "kelp")).toBe(0);
  });
});

describe("the boarding melee (P2.2, GAMEPLAY 8.6)", () => {
  const melee = (h: BattleShip, t: BattleShip, orders = sides<GunsOrder>("grapeshot", "grapeshot"), terrain: Terrain = "open") =>
    meleeRound(sides(h, t), orders, terrain);

  it("removes Hands from the other side equal to 20% of its own boarding strength", () => {
    const m = melee(hunter(), target());
    expect(m.strength).toEqual({ hunter: 30, target: 30 });
    expect(m.lost).toEqual({ hunter: 6, target: 6 });
    expect(m.hands).toEqual({ hunter: 24, target: 24 });
  });

  it("is each side's own strength that counts, so the bigger crew kills more", () => {
    const m = melee(hunter({ hands: 30 }), target({ hands: 20 }));
    expect(m.lost).toEqual({ hunter: 4, target: 6 }); // the hunter loses 20% of 20, the target 20% of 30
  });

  it("happens at the same time: a side wiped out in the round still strikes back", () => {
    const m = melee(hunter({ hands: 30 }), target({ hands: 5 }));
    expect(m.lost).toEqual({ hunter: 1, target: 5 });
    expect(m.hands.target).toBe(0);
  });

  it("never takes more Hands than a side has", () => {
    const m = melee(hunter(), target({ hands: 2 }));
    expect(m.lost.target).toBe(2);
    expect(m.hands.target).toBe(0);
  });

  it("makes a Repelling ship fight as if its crew were the Repel factor times as big", () => {
    const m = melee(hunter(), target(), sides<GunsOrder>("grapeshot", "repel"));
    expect(m.strength.target).toBeCloseTo(30 * C.boarding.repel);
    // The hunter loses 20% of the Repelling target's strength, and the target 20% of the hunter's 30.
    expect(m.lost).toEqual({ hunter: Math.round(C.boarding.killShare * 30 * C.boarding.repel), target: Math.round(C.boarding.killShare * 30) });
    expect(m.lost.hunter).toBeGreaterThan(m.lost.target);
  });

  it("makes Repel cancel when both ships play it", () => {
    const m = melee(hunter(), target(), sides<GunsOrder>("repel", "repel"));
    expect(m.lost.hunter).toBe(m.lost.target);
  });

  it("adds the crew bonus to a side, and Kelp to both", () => {
    const m = melee(hunter({ boardingBonus: 0.5 }), target(), sides<GunsOrder>("grapeshot", "grapeshot"), "kelp");
    expect(m.strength.hunter).toBeCloseTo(30 * 1.5 * C.kelpBoarding);
    expect(m.strength.target).toBeCloseTo(30 * C.kelpBoarding);
  });

  it("does not change its inputs", () => {
    const h = deepFreeze(hunter());
    const t = deepFreeze(target());
    expect(() => meleeRound(sides(h, t), sides<GunsOrder>("repel", "board"), "kelp")).not.toThrow();
  });
});

describe("Capture (P2.2, GAMEPLAY 8.6)", () => {
  const check = (h: number, t: number) => captureCheck(sides(hunter(), target()), sides(h, t));

  it("is nobody's while both crews are strong", () => {
    expect(check(24, 24)).toEqual({ loser: null, draw: false });
  });

  it("surrenders a side whose Hands fall below 40% of the other side's", () => {
    expect(check(11, 30)).toEqual({ loser: "hunter", draw: false });
    expect(check(30, 11)).toEqual({ loser: "target", draw: false });
  });

  it("does not surrender at exactly 40% of the other side's Hands", () => {
    expect(check(12, 30)).toEqual({ loser: null, draw: false });
  });

  it("surrenders a side whose Hands fall below 20% of its own max", () => {
    const six = Math.floor(C.boarding.captureOwnShare * 30); // 6 of 30
    expect(check(six - 1, six + 1)).toEqual({ loser: "hunter", draw: false });
    expect(check(six, six + 1)).toEqual({ loser: null, draw: false }); // exactly 20% is not below it
  });

  it("measures the 20% against that ship's own max, not the other's", () => {
    const small = hunter({ maxHands: 10 });
    expect(surrenders(small, 2, 2)).toBe(false); // 2 is exactly 20% of 10
    expect(surrenders(small, 1, 2)).toBe(true);
    expect(surrenders(hunter(), 2, 2)).toBe(true); // but below 20% of 30
  });

  it("captures the side with fewer Hands when both are below the line", () => {
    expect(check(2, 3)).toEqual({ loser: "hunter", draw: false });
    expect(check(4, 3)).toEqual({ loser: "target", draw: false });
  });

  it("calls it a draw when both are below the line with equal Hands", () => {
    expect(check(3, 3)).toEqual({ loser: null, draw: true });
    expect(check(0, 0)).toEqual({ loser: null, draw: true });
  });
});

describe("grappling with Board (P2.2, GAMEPLAY 8.5)", () => {
  const attempt = (
    range: "long" | "medium" | "close" | "grappled",
    orders: [GunsOrder, GunsOrder],
    moves: [HelmMove, HelmMove],
    scores: [number, number] = [10, 10],
  ) => grappleAttempts(range, sides(orders[0], orders[1]), sides(moves[0], moves[1]), sides(scores[0], scores[1]));

  it("is only tried at Close", () => {
    for (const range of ["long", "medium", "grappled"] as const) {
      expect(attempt(range, ["board", "board"], ["closeIn", "closeIn"])).toEqual([]);
    }
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "hold"])).toHaveLength(1);
  });

  it("is only tried by a ship that plays Board", () => {
    expect(attempt("close", ["roundShot", "roundShot"], ["closeIn", "closeIn"])).toEqual([]);
    expect(attempt("close", ["roundShot", "board"], ["hold", "closeIn"])).toEqual([{ side: "target", ok: true, why: "helm" }]);
  });

  it("succeeds when your Helm score is at least theirs, a tie included", () => {
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "openRange"], [12, 10])).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "openRange"], [10, 10])).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
  });

  it("fails when your Helm score is lower and they neither Board nor Hold", () => {
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "closeIn"], [9, 10])).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "crossTheirBow"], [9, 10])).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
  });

  it("succeeds against a lower Helm score if they also Board", () => {
    const both = attempt("close", ["board", "board"], ["closeIn", "closeIn"], [9, 10]);
    expect(both).toEqual([
      { side: "hunter", ok: true, why: "theyBoard" },
      { side: "target", ok: true, why: "helm" },
    ]);
  });

  it("succeeds against a lower Helm score if they Hold", () => {
    expect(attempt("close", ["board", "roundShot"], ["closeIn", "hold"], [9, 10])).toEqual([{ side: "hunter", ok: true, why: "theyHold" }]);
  });

  it("does not count Hold Fire as a Hold", () => {
    expect(attempt("close", ["board", "holdFire"], ["closeIn", "closeIn"], [9, 10])).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
  });
});

describe("Cut Free (P2.2, GAMEPLAY 8.6)", () => {
  const scores = sides(10, 10);

  it("is only tried by a ship that plays Open Range", () => {
    const none = cutFree(new ScriptedRng(0), sides<HelmMove>("hold", "closeIn"), scores);
    expect(none).toEqual({ freed: false, contests: [] });
    const one = cutFree(new ScriptedRng(0), sides<HelmMove>("openRange", "closeIn"), scores);
    expect(one.contests.map((c) => c.side)).toEqual(["hunter"]);
  });

  it("frees the ships when the opener wins its Helm contest", () => {
    const won = cutFree(new ScriptedRng(0), sides<HelmMove>("openRange", "hold"), scores);
    expect(won.freed).toBe(true);
    expect(won.contests[0]).toMatchObject({ kind: "cutFree", side: "hunter", winner: "hunter", chance: 0.5 });
  });

  it("keeps them Grappled when it loses", () => {
    const lost = cutFree(new ScriptedRng(0.99), sides<HelmMove>("openRange", "hold"), scores);
    expect(lost.freed).toBe(false);
    expect(lost.contests[0]).toMatchObject({ winner: "target" });
  });

  it("weighs the contest by Helm score, A over A plus B", () => {
    const weak = sides(10, 30);
    expect(cutFree(new ScriptedRng(0.2), sides<HelmMove>("openRange", "hold"), weak).freed).toBe(true); // 0.2 < 0.25
    expect(cutFree(new ScriptedRng(0.3), sides<HelmMove>("openRange", "hold"), weak).freed).toBe(false);
  });

  it("lets each Opening ship try, hunter first, and either win frees them", () => {
    const both = cutFree(new ScriptedRng(0.99, 0), sides<HelmMove>("openRange", "openRange"), scores);
    expect(both.contests.map((c) => [c.side, c.winner])).toEqual([["hunter", "target"], ["target", "target"]]);
    expect(both.freed).toBe(true);
  });

  it("does not let a Crippled ship try: its Open Range was turned into a Hold", () => {
    const h = hunter({ riggingPoints: 0 });
    const t = target();
    const helm = resolveHelm(
      { range: "grappled", terrain: "open", hunter: h, target: t, moves: sides<HelmMove>("openRange", "hold"), gauge: null },
      new ScriptedRng(0),
    );
    expect(helm.moves.hunter).toBe("hold");
    expect(cutFree(new ScriptedRng(0), helm.moves, helm.scores)).toEqual({ freed: false, contests: [] });
  });

  it("draws each ship's roll from its own stream, so one ship trying does not shift the other's", () => {
    const rng = () => battleRng(99, "ship_hunter", "ship_target", 2);
    const both = cutFree(rng(), sides<HelmMove>("openRange", "openRange"), scores);
    const hunterOnly = cutFree(rng(), sides<HelmMove>("openRange", "hold"), scores);
    expect(hunterOnly.contests[0]!.roll).toBe(both.contests[0]!.roll);
    const targetOnly = cutFree(rng(), sides<HelmMove>("hold", "openRange"), scores);
    expect(targetOnly.contests[0]!.roll).toBe(both.contests[1]!.roll);
  });

  it("gives the same result for the same stream", () => {
    const a = cutFree(new Rng("x"), sides<HelmMove>("openRange", "openRange"), sides(7, 13));
    const b = cutFree(new Rng("x"), sides<HelmMove>("openRange", "openRange"), sides(7, 13));
    expect(a).toEqual(b);
  });

  it("uses the Helm scores it is given", () => {
    const h = hunter();
    const t = target({ sails: 30 });
    const scoresNow = sides(helmScore(h, t, "open", false), helmScore(t, h, "open", false));
    expect(scoresNow).toEqual({ hunter: 10, target: 30 });
    expect(cutFree(new ScriptedRng(0), sides<HelmMove>("openRange", "hold"), scoresNow).contests[0]!.chance).toBeCloseTo(0.25);
  });
});
