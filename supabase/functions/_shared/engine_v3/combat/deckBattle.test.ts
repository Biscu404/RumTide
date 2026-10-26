// The deck fight in a battle (P3.B2 piece 2, docs/specs/boarding.md): the great guns quiet while Grappled, the guns of the grapple
// round at Close, the boarder's edge, quiet guns on cutting free, overtime, the records, and the streams.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, Chooser } from "./battle.ts";
import { battleRng } from "./helm.ts";
import { always, battleOf, scripted, testShip } from "./testing.ts";
import type { BattleRecord, BattleShip, GunsOrder, HelmMove } from "./types.ts";

const C = B.combat;
const SEED = 1234;
const FLAGS: [string, string] = ["ship_hunter", "ship_target"];
const NEAR: Partial<BattleInput> = { ambush: "medium" };
const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);
const big = { hands: 60, maxHands: 60 };

const run = (h: Chooser, t: Chooser, hs: Partial<BattleShip> = {}, ts: Partial<BattleShip> = {}, input: Partial<BattleInput> = {}): BattleRecord =>
  runBattle(battleOf(hunter(hs), target(ts), { hunter: h, target: t }, { ...NEAR, ...input }));

/** The first Tide seed from 1 up for which a battle satisfies `wanted`. The engine is pure, so this is a fixed answer. */
function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean): number {
  for (let seed = 1; seed < 800; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

/**
 * The hunter closes in and Boards in rounds 1 and 2 against a target that Holds, so it grapples in round 2 with the edge; from
 * round 3 on it plays `after`. The target plays `then` from round 1.
 */
const boardsInRound2 = (after: [HelmMove, GunsOrder], then: [HelmMove, GunsOrder]) => ({
  hunter: scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, after),
  target: always(...then),
});

describe("the great guns are quiet while Grappled (boarding spec section 1)", () => {
  const play = (seed = SEED) => {
    const { hunter: h, target: t } = boardsInRound2(["hold", "roundShot"], ["hold", "grapeshot"]);
    return run(h, t, big, big, { seed });
  };

  it("fires nothing from any ship once the ships are Grappled: no damage, no Powder, no luck", () => {
    const r = play();
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    for (const round of r.rounds.slice(2, 5)) {
      expect(round.rangeBefore).toBe("grappled");
      for (const s of round.ships) expect(s.shot).toEqual({ track: null, damage: 0, powderUsed: 0 });
    }
    // Round 2 burns the target's Powder once (its Grapeshot of the grapple round), then nothing more is burnt.
    expect(r.rounds.map((x) => x.ships[1]!.powder)).toEqual([5, 4, 4, 4, 4]);
    expect(r.rounds.map((x) => x.ships[0]!.powder)).toEqual([6, 6, 6, 6, 6]); // the hunter played Board, then a quiet Round shot
  });

  it("makes the order a Guns order gives while Grappled Fists, whatever the order", () => {
    const r = play();
    for (const round of r.rounds.slice(2, 5)) expect(round.ships.map((s) => s.deck!.order)).toEqual(["fists", "fists"]);
  });

  it("fires the guns of the round the ships grapple at Close, as they come together, and then the grapple happens", () => {
    const r = play();
    const round = r.rounds[1]!;
    expect(round.rangeBefore).toBe("short");
    expect(round.rangeAfter).toBe("grappled");
    expect(round.ships[0]!.shot).toEqual({ track: null, damage: 0, powderUsed: 0 }); // the boarder fires nothing that round (D29)
    // The target's Grapeshot comes in at Close: 22 x 1.2 / 3 Hands, with its luck.
    const luck = battleRng(SEED, ...FLAGS, 2).stream("guns", "ship_target").range(C.luckMin, C.luckMax);
    expect(round.ships[1]!.shot).toMatchObject({ track: "hands", powderUsed: 1 });
    expect(round.ships[1]!.shot.damage).toBe(Math.round((C.k * C.range.grape.close * luck) / C.grapeDamagePerHand));
    // Not at the Grappled range: that column is gone, and Grapeshot at Close is far from nothing.
    expect(round.ships[1]!.shot.damage).toBeGreaterThan(0);
  });

  it("burns no Powder for a Deck order played at another range, and fires nothing", () => {
    const orders: GunsOrder[] = ["charge", "volley", "repel", "firePots"];
    for (const order of orders) {
      const r = run(always("hold", order), always("hold", "holdFire"), { firePots: 2, drill: 5 }, {}, { ambush: "long" });
      for (const round of r.rounds) {
        expect(round.rangeBefore, order).not.toBe("grappled");
        expect(round.ships[0]!.shot, order).toEqual({ track: null, damage: 0, powderUsed: 0 });
        expect(round.ships[0]!.deck, order).toBeUndefined();
        expect(round.ships[0]!.powder, order).toBe(6);
        expect(round.ships[0]!.firePots, order).toBe(2);
      }
    }
  });
});

describe("the Deck orders in a battle (boarding spec section 2)", () => {
  // The hunter grapples in round 2 and fights from round 3 with the given Deck order; the target plays `then` throughout.
  const deck = (order: GunsOrder, then: GunsOrder, hs: Partial<BattleShip> = {}, ts: Partial<BattleShip> = {}, seed = SEED) => {
    const { hunter: h, target: t } = boardsInRound2(["hold", order], ["hold", then]);
    return run(h, t, { ...big, ...hs }, { ...big, ...ts }, { seed });
  };

  it("lets a Repel beat a Charge in the record and in the Hands lost", () => {
    const r = deck("charge", "repel");
    const round = r.rounds[2]!;
    expect(round.ships.map((s) => [s.deck!.order, s.deck!.pairing])).toEqual([["charge", "lost"], ["repel", "won"]]);
    // Both crews started the round at the same strength, so the pairing alone says who lost more.
    expect(round.melee!.lost.hunter).toBeGreaterThan(round.melee!.lost.target);
  });

  it("lets a Charge beat a Volley, and a Volley beat a Repel", () => {
    const cv = deck("charge", "volley");
    expect(cv.rounds[2]!.ships.map((s) => [s.deck!.order, s.deck!.pairing])).toEqual([["charge", "won"], ["volley", "lost"]]);
    const vr = deck("volley", "repel");
    expect(vr.rounds[2]!.ships.map((s) => [s.deck!.order, s.deck!.pairing])).toEqual([["volley", "won"], ["repel", "lost"]]);
  });

  it("burns Powder for a Volley like a round of guns, and falls back to Fists with none", () => {
    const withPowder = deck("volley", "charge", {}, { powder: 6 });
    expect(withPowder.rounds[2]!.ships[0]!.deck!.order).toBe("volley");
    expect(withPowder.rounds[2]!.ships[0]!.shot.powderUsed).toBe(1);
    expect(withPowder.rounds.map((r) => r.ships[0]!.powder)).toEqual([6, 6, 5, 4, 3].slice(0, withPowder.rounds.length));
    const dry = deck("volley", "charge", { powder: 0 });
    expect(dry.rounds[2]!.ships[0]!.deck!.order).toBe("fists"); // it does not fire at half strength: it fights with Fists
    expect(dry.rounds[2]!.ships[0]!.shot.powderUsed).toBe(0);
    expect(dry.rounds[2]!.ships[0]!.powder).toBe(0);
    // A Volley that runs out of Powder in the middle of the fight falls back the round after.
    const thin = deck("volley", "charge", { powder: 1 });
    expect(thin.rounds.slice(2).map((r) => r.ships[0]!.deck!.order)).toEqual(["volley", "fists", "fists"]);
  });

  it("burns more Powder from a bigger hull, as a round of its guns does", () => {
    const brig = runBattle(battleOf(testShip("hunter", "brigantine", big), target(big), boardsInRound2(["hold", "volley"], ["hold", "charge"]), { ...NEAR, seed: SEED }));
    const volleyRound = brig.rounds[2]!;
    expect(volleyRound.ships[0]!.deck!.order).toBe("volley");
    expect(volleyRound.ships[0]!.shot.powderUsed).toBe(B.hulls.brigantine.powderPerRound);
    expect(B.hulls.brigantine.powderPerRound).toBeGreaterThan(B.hulls.sloop.powderPerRound);
  });

  it("throws a Fire Pot with Drill 5 and a pot, uses it up, and falls back to Fists without the Drill or the pot", () => {
    const thrown = deck("firePots", "charge", { drill: 5, firePots: 1 });
    expect(thrown.rounds.slice(2, 4).map((r) => r.ships[0]!.deck!.order)).toEqual(["firePots", "fists"]);
    expect(thrown.rounds.slice(2, 4).map((r) => r.ships[0]!.firePots)).toEqual([0, 0]);
    expect(thrown.rounds[2]!.ships[0]!.deck!.thrown).toMatchObject({ fire: expect.any(Boolean) });
    expect(thrown.rounds[3]!.ships[0]!.deck!.thrown).toBeUndefined(); // nothing left to throw
    const two = deck("firePots", "charge", { drill: 5, firePots: 2 });
    expect(two.rounds.slice(2, 4).map((r) => r.ships[0]!.firePots)).toEqual([1, 0]); // one pot a throw
    expect(deck("firePots", "charge", { drill: 4, firePots: 2 }).rounds[2]!.ships[0]!.deck!.order).toBe("fists");
    expect(deck("firePots", "charge", { drill: 5 }).rounds[2]!.ships[0]!.deck!.order).toBe("fists");
    expect(deck("firePots", "charge", { drill: 5, firePots: 2 }).rounds[1]!.ships[0]!.firePots).toBe(2);
  });
});

describe("the boarder's edge (boarding spec section 3, D117)", () => {
  const edge = (seed = SEED) => {
    const { hunter: h, target: t } = boardsInRound2(["hold", "charge"], ["hold", "repel"]);
    return run(h, t, big, big, { seed });
  };

  it("gives First over the rail to the ship whose Board made the grapple: its Board fights as a Charge at x1.25", () => {
    const r = edge();
    const round = r.rounds[1]!;
    expect(round.grapples).toEqual([{ side: "hunter", ok: true, why: expect.any(String) }]);
    expect(round.edge).toBe("hunter");
    expect(round.melee!.firstOver).toBe("hunter");
    expect(round.ships[0]!.guns).toBe("board");
    expect(round.ships.map((s) => s.deck!.order)).toEqual(["charge", "fists"]);
    expect(round.melee!.strength).toEqual({ hunter: 60 * C.edge.firstOverTheRail, target: 60 });
  });

  it("makes the other crew fight with Fists in the grapple round, even if it played Repel: the first round cannot be Repelled", () => {
    const round = edge().rounds[1]!;
    expect(round.ships[1]!.guns).toBe("repel");
    expect(round.ships[1]!.deck!.order).toBe("fists");
    expect(round.ships[1]!.deck!.pairing).toBe("even");
    // The Charge met Fists: 60 x 0.2 x 1.5 x 1.25 x 1.25 (the guard of Fists is 1), not the 0.75 and 0.6 of a Repel.
    expect(round.melee!.lost.target).toBe(Math.round(0.2 * 60 * C.edge.firstOverTheRail * C.deck.hit.charge));
  });

  it("lets a Repel work in the rounds after: Repel still beats Charge, on purpose", () => {
    const r = edge();
    const after = r.rounds[2]!;
    expect(after.ships.map((s) => s.deck!.order)).toEqual(["charge", "repel"]);
    expect(after.ships.map((s) => s.deck!.pairing)).toEqual(["lost", "won"]);
  });

  it("keeps the edge as long as the grapple lasts, but First over the rail is for the grapple round only", () => {
    const r = edge();
    expect(r.rounds.slice(1).every((x) => x.edge === "hunter")).toBe(true);
    expect(r.rounds.slice(2).every((x) => x.melee!.firstOver === undefined)).toBe(true);
    expect(r.rounds[2]!.melee!.strength.hunter).toBeLessThan(60 * C.edge.firstOverTheRail); // plain strength, from the Hands left
  });

  it("gives nobody the edge when both ships Board: they grapple and both fight as a Charge, without the bonus", () => {
    const board = scripted({}, ["closeIn", "board"]);
    const r = run(board, board, big, big);
    const round = r.rounds.find((x) => x.rangeBefore !== "grappled" && x.rangeAfter === "grappled")!;
    expect(round.grapples.map((g) => g.ok)).toEqual([true, true]);
    expect(round.edge).toBeUndefined();
    expect(round.melee!.firstOver).toBeUndefined();
    expect(round.ships.map((s) => s.deck!.order)).toEqual(["charge", "charge"]);
    expect(round.melee!.strength).toEqual({ hunter: 60, target: 60 });
  });

  it("gives nobody the edge when Close In meets Close In at Close: both crews fight with Fists that round, a Board played or not", () => {
    // Round 1 brings them to Close; in round 2 both Close In and the table grapples them, so the Board is never tried.
    const r = run(scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "board"]), always("closeIn", "chainShot"), big, big);
    const round = r.rounds[1]!;
    expect(round.rangeBefore).toBe("close");
    expect(round.rangeAfter).toBe("grappled");
    expect(round.grapples).toEqual([]);
    expect(round.edge).toBeUndefined();
    expect(round.ships.map((s) => s.deck!.order)).toEqual(["fists", "fists"]);
    expect(round.melee!.strength).toEqual({ hunter: 60, target: 60 });
  });

  it("ends the edge with the grapple: a Cut Free returns the range to Close with no melee, and a new grapple makes a new boarder", () => {
    // The target Opens Range in round 3 to cut free, then Boards in round 4 against a hunter that Holds.
    const play = (seed: number) => run(
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"], 3: ["hold", "charge"] }, ["hold", "holdFire"]),
      scripted({ 3: ["openRange", "roundShot"], 4: ["closeIn", "board"] }, ["hold", "roundShot"]),
      big, big, { seed },
    );
    const seed = findSeed(play, (r) => r.rounds[2]!.rangeAfter === "close" && r.rounds[3]?.rangeAfter === "grappled");
    const r = play(seed);
    expect(r.rounds[2]!.edge).toBe("hunter"); // in force for the contest to cut free of it
    expect(r.rounds[2]!.melee).toBeNull();
    expect(r.rounds[3]!.edge).toBe("target"); // a new grapple, a new boarder
    expect(r.rounds[3]!.melee!.firstOver).toBe("target");
    expect(r.rounds[3]!.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]);
  });

  it("has no edge in a battle that never grapples", () => {
    const r = run(always("hold", "roundShot"), always("hold", "roundShot"));
    for (const round of r.rounds) expect(round.edge).toBeUndefined();
  });
});

describe("Lashed fast (boarding spec section 3, acceptance 3)", () => {
  // The hunter grapples in round 2 with the edge. From round 3 the target Opens Range to cut free of it, the hunter Holds.
  const play = (seed: number, edgeHeld = true) => run(
    edgeHeld
      ? scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "holdFire"])
      : scripted({}, ["closeIn", "holdFire"]), // Close In meets Close In: the table grapples them and nobody has the edge
    scripted({ 3: ["openRange", "holdFire"] }, edgeHeld ? ["hold", "holdFire"] : ["closeIn", "holdFire"]),
    big, big, { seed },
  );
  const firstTry = (r: BattleRecord) => r.rounds.flatMap((x) => x.contests).find((c) => c.kind === "cutFree");

  it("counts the boarder's Helm score twice in every Cut Free contest, and the record shows the scores as the contest used them", () => {
    const c = firstTry(play(SEED))!;
    expect(c.side).toBe("target");
    expect(c.scores).toEqual({ hunter: 2 * 10, target: 10 });
    expect(c.chance).toBeCloseTo(1 / 3);
  });

  it("lets an equal ship cut free of its boarder about a third of the time, and of an equal ship that has no edge half the time", () => {
    const tries = 900;
    let freed = 0, freedWithoutEdge = 0;
    for (let seed = 1; seed <= tries; seed++) {
      const c = firstTry(play(seed))!;
      if (c.winner === "target") freed++;
      const plain = firstTry(play(seed, false));
      if (plain && plain.winner === "target") freedWithoutEdge++;
    }
    expect(freed / tries).toBeGreaterThan(0.28);
    expect(freed / tries).toBeLessThan(0.39); // at most about a third
    expect(freedWithoutEdge / tries).toBeGreaterThan(0.42);
    expect(freedWithoutEdge / tries).toBeLessThan(0.58);
  });

  it("does not help the boarder when it is the one trying to get away: its own score is what counts", () => {
    const r = run(
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"], 3: ["openRange", "holdFire"] }, ["hold", "holdFire"]),
      always("hold", "holdFire"), big, big,
    );
    expect(firstTry(r)!.scores).toEqual({ hunter: 10, target: 10 });
  });
});

describe("quiet guns when a ship cuts free (D135)", () => {
  // The target cuts free in round 3 while both ships name a gun. In the round it happens the great guns of both stay quiet.
  const cut = (seed: number) => run(
    scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "grapeshot"]),
    scripted({ 3: ["openRange", "grapeshot"] }, ["hold", "holdFire"]), big, big, { seed },
  );

  it("fires nothing from either ship in the round a ship cuts free, and the range returns to Close with no melee (D61)", () => {
    expect(C.quietCutFree).toBe(true);
    const seed = findSeed(cut, (r) => r.rounds[2]!.rangeAfter === "close");
    const round = cut(seed).rounds[2]!;
    expect(round.contests.map((c) => [c.kind, c.winner])).toEqual([["cutFree", "target"]]);
    expect(round.melee).toBeNull();
    for (const s of round.ships) expect(s.shot).toEqual({ track: null, damage: 0, powderUsed: 0 });
    // The round after, with the ships apart at Close, the guns fire again.
    expect(C.range.grape.close).toBeGreaterThan(0);
  });

  it("keeps them quiet when the contest is lost too: the ships are still Grappled", () => {
    const seed = findSeed(cut, (r) => r.rounds[2]!.rangeAfter === "grappled");
    const round = cut(seed).rounds[2]!;
    for (const s of round.ships) expect(s.shot).toEqual({ track: null, damage: 0, powderUsed: 0 });
    expect(round.melee).not.toBeNull();
  });
});

describe("a Cut Free that wins (D61)", () => {
  // The hunter keeps playing Board, even Grappled. In round 3 the target cuts free; the hunter's Board is not tried in that round.
  const play = (seed: number) => run(
    scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["closeIn", "board"]),
    scripted({ 3: ["openRange", "holdFire"] }, ["hold", "holdFire"]), big, big, { seed },
  );

  it("returns the range to Close with no melee and no new grapple in that round, whatever the other ship plays", () => {
    const seed = findSeed(play, (r) => r.rounds[2]!.rangeAfter === "close");
    const round = play(seed).rounds[2]!;
    expect(round.melee).toBeNull();
    expect(round.grapples).toEqual([]); // the Board waits for the next round
    expect(round.ships.every((s) => s.deck === undefined)).toBe(true);
  });

  it("lets the Board try again the round after, and a new grapple makes a new boarder", () => {
    const seed = findSeed(play, (r) => r.rounds[2]!.rangeAfter === "close" && r.rounds[3]?.rangeAfter === "grappled");
    const r = play(seed);
    expect(r.rounds[3]!.grapples).toMatchObject([{ side: "hunter", ok: true }]);
    expect(r.rounds[3]!.edge).toBe("hunter");
    expect(r.rounds[3]!.melee!.firstOver).toBe("hunter");
  });
});

describe("overtime (D127)", () => {
  // Two big crews that Repel: they hurt each other too little to end it, so the deck fight is still going after round 5.
  const long = (seed = SEED) => run(
    scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "repel"]),
    always("hold", "repel"), { hands: 120, maxHands: 120 }, { hands: 120, maxHands: 120 }, { seed },
  );

  it("goes on for up to two more rounds with the guns quiet", () => {
    expect(C.overtime).toBe(2);
    const r = long();
    expect(r.rounds.map((x) => x.round)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.rounds.map((x) => x.overtime)).toEqual([undefined, undefined, undefined, undefined, undefined, true, true]);
    for (const round of r.rounds.slice(5)) {
      expect(round.rangeBefore).toBe("grappled");
      expect(round.melee).not.toBeNull();
      for (const s of round.ships) expect(s.shot.track).toBeNull();
    }
    expect(r.outcome.round).toBe(7);
  });

  it("ends the same way as before: a Draw or a Victory on points after the last round", () => {
    const r = long();
    expect(["draw", "victory"]).toContain(r.outcome.kind);
    expect(r.outcome.round).toBe(r.rounds.length);
  });

  it("lets a ship still cut free in overtime, which ends the fight when the range is Close again", () => {
    const play = (seed: number) => run(
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "repel"]),
      scripted({ 6: ["openRange", "repel"] }, ["hold", "repel"]), { hands: 120, maxHands: 120 }, { hands: 120, maxHands: 120 }, { seed },
    );
    const seed = findSeed(play, (r) => r.rounds.length >= 6 && r.rounds[5]!.rangeAfter === "close");
    const r = play(seed);
    expect(r.rounds).toHaveLength(6); // not grappled when round 6 ends, so there is no round 7
    expect(r.rounds[5]!.overtime).toBe(true);
    expect(r.rounds[5]!.contests.map((c) => c.kind)).toEqual(["cutFree"]);
  });

  it("gives no overtime to a battle that is not Grappled after round 5, or to one that ended before it", () => {
    const apart = run(always("hold", "roundShot"), always("hold", "roundShot"));
    expect(apart.rounds).toHaveLength(C.rounds);
    expect(apart.rounds.every((x) => x.overtime === undefined)).toBe(true);
    const captured = run(always("closeIn", "board"), always("hold", "roundShot"), {}, { hands: 6 });
    expect(captured.outcome.kind).toBe("captured");
    expect(captured.rounds.length).toBeLessThan(C.rounds);
  });

  it("can end in a Capture in overtime, the way a deck fight ends before it", () => {
    // Two equal crews that Volley at each other grind each other down past round 5.
    const sixty = { hands: 60, maxHands: 60 };
    const r = run(scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "volley"]), always("hold", "volley"), sixty, sixty);
    expect(r.outcome).toMatchObject({ kind: "captured", round: 6 });
    expect(r.rounds).toHaveLength(6);
    expect(r.rounds[5]!.overtime).toBe(true);
    expect(r.outcome.loser).not.toBeNull();
  });
});

describe("the records of a battle with no styles and no deck fight (D159)", () => {
  it("carry none of the new fields: a plain battle keeps its old shape", () => {
    const r = run(always("closeIn", "grapeshot"), always("hold", "roundShot"), {}, {}, { seed: 99, ambush: "long" });
    expect(r.rounds.every((x) => x.melee === null)).toBe(true);
    const text = JSON.stringify(r);
    for (const key of ["deck", "edge", "firstOver", "fires", "fire", "overtime", "firePots", "drill", "style"]) expect(text, key).not.toContain(`"${key}":`);
  });

  it("carry them only where they are used: an edge in the rounds of a grapple, a deck record in a melee", () => {
    const r = run(scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "charge"]), always("hold", "roundShot"), big, big);
    expect(r.rounds[0]!).not.toHaveProperty("edge");
    expect(r.rounds[0]!.ships[0]!).not.toHaveProperty("deck");
    expect(r.rounds[1]!).toHaveProperty("edge");
    expect(r.rounds[1]!.ships[0]!).toHaveProperty("deck");
    expect(r.ships[0]!).not.toHaveProperty("firePots");
  });
});

describe("the streams of the deck fight (D16)", () => {
  it("draws the old rolls from the old streams, with every new roll in the battle: guns luck, Cut Free and the chase", () => {
    // A deck fight that rolls a Fire Pot, a Cut Free contest and the guns of the grapple round. Each old roll is still the one its own stream gives.
    const play = (seed: number) => run(
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "firePots"]),
      scripted({ 3: ["openRange", "roundShot"] }, ["hold", "grapeshot"]), { ...big, drill: 5, firePots: 2 }, big, { seed },
    );
    const seed = findSeed(play, (r) => r.rounds[2]?.contests.some((c) => c.kind === "cutFree") === true && r.rounds[2]!.rangeAfter === "grappled");
    const r = play(seed);
    const free = r.rounds[2]!.contests.find((c) => c.kind === "cutFree")!;
    expect(free.roll).toBe(battleRng(seed, ...FLAGS, 3).stream("helm", "cutFree", "target").next());
    // The guns of the grapple round: the luck is the one stream "guns/<id>" gives for that round.
    const luck = battleRng(seed, ...FLAGS, 2).stream("guns", "ship_target").range(C.luckMin, C.luckMax);
    const hit = r.rounds[1]!.ships[1]!.shot.damage;
    expect(hit).toBe(Math.round((C.k * C.range.grape.close * luck) / C.grapeDamagePerHand));
    // The Fire Pot has its own stream, named for the pot.
    const pot = r.rounds[2]!.ships[0]!.deck!.thrown!;
    expect(pot.roll).toBe(battleRng(seed, ...FLAGS, 3).stream("fire", "pots", "ship_hunter").next());
    expect(pot.fire).toBe(pot.roll < C.deck.fireChance);
  });

  it("gives the same record for the same seed, and two different ones for two seeds", () => {
    const play = (seed: number) => run(
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "charge"]), always("hold", "repel"), big, big, { seed },
    );
    expect(play(5)).toEqual(play(5));
    expect(JSON.stringify(play(5))).not.toBe(JSON.stringify(play(6)));
  });
});

describe("Drill luck in a battle (P3.2, D198)", () => {
  /** Both crews Board, the hunter has Drill 5 and the target none: the deck fight is the whole battle. */
  const fight = (seed: number, drill = 5) => run(always("closeIn", "board"), always("closeIn", "board"), { drill }, {}, { seed });
  const winners = (n = 150) => {
    let drilled = 0, undrilled = 0;
    for (let seed = 1; seed <= n; seed++) {
      const w = fight(seed).outcome.winner;
      if (w === "hunter") drilled++;
      else if (w === "target") undrilled++;
    }
    return { drilled, undrilled };
  };

  it("lets a drilled crew win most deck fights and lose some, where it won them all without luck", () => {
    const { drilled, undrilled } = winners();
    expect(drilled).toBeGreaterThan(undrilled);
    expect(undrilled).toBeGreaterThan(0);
    const drill = B.drill as { luck: number };
    const was = drill.luck;
    drill.luck = 0;
    try {
      const flat = winners();
      expect(flat.undrilled).toBe(0);
      expect(flat.drilled).toBeGreaterThan(0);
    } finally {
      drill.luck = was;
    }
  });

  it("records the draw of a drilled crew in the rounds it fights on deck, and none for a crew without Drill", () => {
    const seed = findSeed((s) => fight(s), (r) => r.rounds.some((x) => x.melee !== null));
    const melees = fight(seed).rounds.flatMap((r) => (r.melee ? [r.melee] : []));
    expect(melees.length).toBeGreaterThan(0);
    for (const m of melees) {
      expect(Object.keys(m.drillLuck ?? {})).toEqual(["ship_hunter"]);
      expect(m.drillLuck!.ship_hunter).toBeGreaterThanOrEqual(1 - B.drill.luck);
      expect(m.drillLuck!.ship_hunter).toBeLessThanOrEqual(1 + B.drill.luck);
    }
  });

  it("leaves a fight between crews with no Drill without any draw, and repeats from the same seed", () => {
    const plain = fight(7, 0);
    expect(plain.rounds.every((r) => r.melee === null || r.melee.drillLuck === undefined)).toBe(true);
    expect(JSON.stringify(plain)).not.toContain("drillLuck");
    expect(fight(7)).toEqual(fight(7));
  });
});
