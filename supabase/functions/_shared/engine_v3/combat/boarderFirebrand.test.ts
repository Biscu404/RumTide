// The Boarder and the Firebrand (P3.B2 piece 2, docs/specs/fighting-styles.md section 3): the traits, Grapnels, Hot Shot and the other
// styles that meet them.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, Chooser } from "./battle.ts";
import { fireGuns } from "./guns.ts";
import { battleRng } from "./helm.ts";
import {
  boardsFromShort, canThrowPots, emberChance, fightersFactor, grapnelBonus, hasGrapnels, playableOrder, ramHull, shotFireChance, styleHelmFactor,
  tinderboxFactor,
} from "./styles.ts";
import { ScriptedRng, always, battleOf, scripted, styleShip, testShip } from "./testing.ts";
import type { FightingStyle } from "../types.ts";
import type { BattleRecord, BattleShip, BattleSide } from "./types.ts";

const C = B.combat;
const S = B.styles;
const FLAGS: [string, string] = ["ship_hunter", "ship_target"];
const NEAR: Partial<BattleInput> = { ambush: "medium" };
const styled = (side: BattleSide, style: FightingStyle, over: Partial<BattleShip> = {}) => styleShip(side, style, "sloop", over);
const plain = (side: BattleSide, over: Partial<BattleShip> = {}) => testShip(side, "sloop", over);
const big = { hands: 60, maxHands: 60 };

const fight = (hunter: BattleShip, target: BattleShip, h: Chooser, t: Chooser, input: Partial<BattleInput> = {}): BattleRecord =>
  runBattle(battleOf(hunter, target, { hunter: h, target: t }, { ...NEAR, ...input }));

function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean): number {
  for (let seed = 1; seed < 1500; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

describe("the Boarder's traits (fighting styles spec section 3)", () => {
  it("has the starting numbers of the spec", () => {
    expect(S.boarder).toEqual({ grapnelLines: true, grapnelBonus: 3, fighters: 1.2, ramWhileBoarding: 0.5, chase: 1.3 });
  });

  it("Fighters: a Boarder's crew fights with 20% more boarding strength, and no other style's does", () => {
    expect(fightersFactor(styled("hunter", "boarder"))).toBe(1.2);
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "firebrand", "smuggler"] as const) expect(fightersFactor(styled("hunter", style))).toBe(1);
    expect(fightersFactor(plain("hunter"))).toBe(1);
  });

  it("The chase: its Helm score counts 1.3 times in a round it Closes In, and in no other", () => {
    const boarder = styled("hunter", "boarder");
    expect(styleHelmFactor(boarder, "closeIn")).toBe(S.boarder.chase);
    for (const move of ["hold", "openRange", "crossTheirBow"] as const) expect(styleHelmFactor(boarder, move)).toBe(1);
    expect(styleHelmFactor(styled("hunter", "rammer"), "closeIn")).toBe(1);
    // In the record: 13 in a round it Closes In, 10 in a round it Holds.
    const r = fight(styled("hunter", "boarder", big), plain("target", big), scripted({ 1: ["closeIn", "roundShot"] }, ["hold", "holdFire"]), always("hold", "holdFire"));
    expect(r.rounds.map((x) => x.ships[0]!.helmScore)).toEqual([13, 10, 10, 10, 10]);
    expect(r.rounds.map((x) => x.ships[1]!.helmScore)).toEqual([10, 10, 10, 10, 10]);
  });

  it("The chase: a ship that runs from a Boarder needs a better Helm, because the contest uses the boosted score", () => {
    const r = fight(styled("hunter", "boarder", big), plain("target", big), always("closeIn", "holdFire"), always("openRange", "holdFire"));
    const chase = r.rounds[0]!.contests.find((c) => c.kind === "chase")!;
    expect(chase.scores).toEqual({ hunter: 13, target: 10 });
    expect(chase.chance).toBeCloseTo(13 / 23);
  });

  it("The chase: counts for a Boarder that is a fleet mate, judged against the enemy flagship", () => {
    const mate = { ...styled("hunter", "boarder"), shipId: "ship_mate", side: "hunter" as const };
    const record = runBattle({
      ...battleOf(plain("hunter", big), plain("target", big), { hunter: always("hold", "holdFire"), target: always("hold", "holdFire") }, NEAR),
      mates: { hunter: [{ ship: mate, doctrine: "Mate", chooser: always("closeIn", "holdFire") }], target: [] },
    });
    expect(record.rounds[0]!.ships.find((s) => s.ship === "ship_mate")!.helmScore).toBe(13);
  });

  it("Grapnels catch the prow: a Ram against a Boarder that plays Board does half, and against one that does not, all", () => {
    expect(ramHull(styled("target", "boarder"), "closeIn", "board")).toBe(Math.round(S.rammer.ramHull * S.boarder.ramWhileBoarding)); // 15
    expect(ramHull(styled("target", "boarder"), "closeIn", "roundShot")).toBe(S.rammer.ramHull);
    expect(ramHull(styled("target", "boarder"), "closeIn")).toBe(S.rammer.ramHull);
    expect(ramHull(plain("target"), "closeIn", "board")).toBe(S.rammer.ramHull); // only a Boarder has grapnels
    expect(ramHull(styled("target", "gunline"), "hold", "board")).toBe(Math.round(S.rammer.ramHull * S.gunline.bracedRam));
    // In a battle: the Boarder Boards while the Rammer Rams.
    const play = (order: "board" | "roundShot") => (seed: number) => fight(
      styled("hunter", "rammer", { hullPoints: 900, maxHullPoints: 900 }), styled("target", "boarder", { hullPoints: 900, maxHullPoints: 900 }),
      always("closeIn", "holdFire"), scripted({ 1: ["hold", "holdFire"] }, ["hold", order]), { seed },
    );
    // Round 1 brings the Rammer to Close; in round 2 it Rams, and the Boarder plays Board (or Round shot).
    const seed = findSeed(play("board"), (r) => r.rounds[1]?.rams?.[0]?.hit === true);
    const hit = (order: "board" | "roundShot") => play(order)(seed).rounds[1]!.rams![0]!;
    expect(hit("board")).toMatchObject({ hit: true, hull: 15, self: S.rammer.ramSelf });
    expect(hit("roundShot")).toMatchObject({ hit: true, hull: 30, self: S.rammer.ramSelf });
  });

  it("Grapnel lines: Board works from Short as well as Close, for a Boarder only", () => {
    expect(boardsFromShort(styled("hunter", "boarder"))).toBe(true);
    expect(boardsFromShort(plain("hunter"))).toBe(false);
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "firebrand", "smuggler"] as const) expect(boardsFromShort(styled("hunter", style)), style).toBe(false);
    // A Boarder that Closes In and Boards against a ship that Holds grapples in round 1: the range after the Helm step is Short.
    const play = (hunter: BattleShip) => fight(hunter, plain("target", big), always("closeIn", "board"), always("hold", "roundShot"));
    const boarder = play(styled("hunter", "boarder", big));
    expect(boarder.rounds[0]!.rangeAfter).toBe("grappled");
    expect(boarder.rounds[0]!.grapples).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    expect(boarder.rounds[0]!.edge).toBe("hunter");
    // Anyone else waits for Close, one round later.
    const other = play(plain("hunter", big));
    expect(other.rounds[0]!.rangeAfter).toBe("short");
    expect(other.rounds[0]!.grapples).toEqual([]);
    expect(other.rounds[1]!.rangeAfter).toBe("grappled");
  });

  it("Grapnel lines: the guns of the round fire at Close, though the grapple came from Short", () => {
    const r = fight(styled("hunter", "boarder", big), plain("target", big), always("closeIn", "board"), always("hold", "grapeshot"));
    const luck = battleRng(1234, ...FLAGS, 1).stream("guns", "ship_target").range(C.luckMin, C.luckMax);
    expect(r.rounds[0]!.rangeAfter).toBe("grappled");
    expect(r.rounds[0]!.ships[1]!.shot.damage).toBe(Math.round((C.k * C.range.grape.close * luck) / C.grapeDamagePerHand)); // the Close factor, not Short's
  });

  it("Grapnel lines: a Board that fails on Helm score becomes a Helm contest with the Boarder's score counted three times", () => {
    // The target (Sails 30) crosses the Boarder's bow, so its Helm score is high against the Boarder's 13, and a Board against a Cross Their Bow fails.
    const play = (seed: number) => fight(styled("hunter", "boarder", big), plain("target", { ...big, sails: 30 }), always("closeIn", "board"), always("crossTheirBow", "holdFire"), { seed });
    const first = play(1).rounds[0]!;
    expect(first.rangeAfter === "short" || first.rangeAfter === "grappled").toBe(true);
    const contest = first.contests.find((c) => c.kind === "grapnel")!;
    // Sails 30 holds the wind gauge, so the target's 30 counts 1.2 times: 36. The Boarder's 10 x 1.3 (the chase) x 3 is 39.
    expect(contest).toMatchObject({ side: "hunter", scores: { hunter: 39, target: 36 } });
    expect(contest.chance).toBeCloseTo(39 / 75);
    expect(contest.roll).toBe(battleRng(1, ...FLAGS, 1).stream("grapnel", "ship_hunter").next());
    // A won contest grapples, and the record says why. A lost one leaves the ships apart.
    const won = findSeed(play, (r) => r.rounds[0]!.grapples[0]?.why === "grapnels");
    expect(play(won).rounds[0]!.grapples).toEqual([{ side: "hunter", ok: true, why: "grapnels" }]);
    expect(play(won).rounds[0]!.rangeAfter).toBe("grappled");
    const lost = findSeed(play, (r) => r.rounds[0]!.grapples[0]?.ok === false);
    expect(play(lost).rounds[0]!.grapples).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
    expect(play(lost).rounds[0]!.rangeAfter).not.toBe("grappled");
    let grapnels = 0;
    for (let seed = 1; seed <= 600; seed++) if (play(seed).rounds[0]!.grapples[0]?.why === "grapnels") grapnels++;
    expect(grapnels / 600).toBeGreaterThan(0.46);
    expect(grapnels / 600).toBeLessThan(0.58);
  });

  it("holds Grapnels from the start (Drill 0) for a Boarder, and unlocks them at Drill 10 for any other style", () => {
    expect(hasGrapnels(styled("hunter", "boarder"))).toBe(true);
    expect(hasGrapnels(styled("hunter", "boarder", { drill: 0 }))).toBe(true);
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "firebrand", "smuggler"] as const) {
      expect(hasGrapnels(styled("hunter", style, { drill: 9 })), `${style} at 9`).toBe(false);
      expect(hasGrapnels(styled("hunter", style, { drill: 10 })), `${style} at 10`).toBe(true);
    }
    expect(hasGrapnels(plain("hunter"))).toBe(false);
    expect(hasGrapnels(plain("hunter", { drill: 10 }))).toBe(true);
    expect(grapnelBonus(styled("hunter", "boarder"))).toBe(3);
    expect(grapnelBonus(plain("hunter", { drill: 10 }))).toBe(1);
  });

  it("Grapnels at Drill 10: a failed Board gets a Helm contest at the plain score, and a ship without them gets none", () => {
    const play = (drill: number) => fight(
      plain("hunter", { ...big, drill }), plain("target", { ...big, sails: 30 }),
      scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "board"]), scripted({ 1: ["hold", "roundShot"] }, ["crossTheirBow", "holdFire"]), { seed: 5 },
    );
    const withGrapnels = play(10);
    const attempt = withGrapnels.rounds[1]!;
    expect(attempt.rangeBefore).toBe("short");
    const contest = attempt.contests.find((c) => c.kind === "grapnel");
    expect(contest).toMatchObject({ side: "hunter", scores: { hunter: 10, target: 36 } }); // once, not three times
    expect(play(9).rounds[1]!.contests.some((c) => c.kind === "grapnel")).toBe(false);
    expect(play(9).rounds[1]!.grapples).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
  });

  it("Grapnels at Drill 10: Lashed fast holds in every grapple the ship is in, the ones it did not make as well", () => {
    // The target boards the hunter; the hunter has Grapnels, so when the target tries to cut free its contest faces the hunter's doubled score.
    const r = fight(
      plain("hunter", { ...big, drill: 10 }), plain("target", big),
      always("hold", "holdFire"), scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"], 3: ["openRange", "holdFire"] }, ["hold", "holdFire"]),
    );
    const grapple = r.rounds.find((x) => x.edge === "target")!;
    expect(grapple).toBeDefined();
    const free = r.rounds.flatMap((x) => x.contests).find((c) => c.kind === "cutFree" && c.side === "target")!;
    // The target holds the edge, so the hunter is lashed to nothing it made: both ships are lashed fast, and the target's own score is not doubled.
    expect(free.scores).toEqual({ hunter: 10 * C.edge.lashedFast, target: 10 });
  });
});

describe("Hot Shot (fighting styles spec section 3)", () => {
  const firebrand = (over: Partial<BattleShip> = {}) => styled("hunter", "firebrand", over);
  const target = (over: Partial<BattleShip> = {}) => plain("target", over);
  const rng = () => new ScriptedRng(0.5);

  it("is a Guns order only a Firebrand fires: any other ship that names it fires Round shot, and the record keeps what was asked", () => {
    expect(playableOrder(firebrand(), "hotShot")).toBe("hotShot");
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "smuggler"] as const) expect(playableOrder(styled("hunter", style), "hotShot"), style).toBe("roundShot");
    expect(playableOrder(plain("hunter"), "hotShot")).toBe("roundShot");
    const r = fight(plain("hunter"), plain("target"), always("hold", "hotShot"), always("hold", "holdFire"));
    expect(r.rounds[0]!.ships[0]).toMatchObject({ guns: "roundShot", asked: "hotShot" });
    // Round shot rolls exactly what Round shot rolls.
    const round = fight(plain("hunter"), plain("target"), always("hold", "roundShot"), always("hold", "holdFire"));
    expect(r.rounds.map((x) => x.ships[0]!.shot)).toEqual(round.rounds.map((x) => x.ships[0]!.shot));
  });

  it("keeps the Mortar to a Bombardier and Hot Shot to a Firebrand: each is Round shot for the other", () => {
    expect(playableOrder(firebrand(), "mortar")).toBe("roundShot");
    expect(playableOrder(styled("hunter", "bombardier"), "hotShot")).toBe("roundShot");
  });

  it("hits Hull by the Hot Shot row of the table: weak beyond Short, 1.0 at Short and Close", () => {
    expect(C.range.hot).toEqual({ far: 0, long: 0.3, medium: 0.3, short: 1.0, close: 1.0 });
    for (const range of ["far", "long", "medium", "short", "close"] as const) {
      const r = fireGuns(firebrand(), target(), range, "hotShot", rng());
      expect(r.track, range).toBe("hull");
      expect(r.factors?.range, range).toBe(C.range.hot[range]);
      expect(r.raw, range).toBeCloseTo(C.k * C.range.hot[range]);
    }
    expect(fireGuns(firebrand(), target(), "far", "hotShot", rng()).damage).toBe(0);
    expect(fireGuns(firebrand(), target(), "grappled", "hotShot", rng())).toMatchObject({ track: null, damage: 0, powderUsed: 0 });
  });

  it("uses twice the Powder of other shot, and with less left it fires and uses up the rest", () => {
    expect(S.firebrand.hotShotPowder).toBe(2);
    expect(fireGuns(firebrand({ powder: 6 }), target(), "short", "hotShot", rng()).powderUsed).toBe(2);
    expect(fireGuns(firebrand({ powder: 6 }), target(), "short", "roundShot", rng()).powderUsed).toBe(1);
    const last = fireGuns(firebrand({ powder: 1 }), target(), "short", "hotShot", rng());
    expect(last.powderUsed).toBe(1);
    expect(last.damage).toBeGreaterThan(0); // it still fires, at the full factor
    expect(last.factors?.powder).toBe(1);
    // A bigger hull burns more: a brigantine's round of guns is 2 Powder, so its Hot Shot is 4.
    const brig = styleShip("hunter", "firebrand", "brigantine", { powder: 6 });
    expect(fireGuns(brig, target(), "short", "hotShot", rng()).powderUsed).toBe(B.hulls.brigantine.powderPerRound * 2);
  });

  it("fires dry like any gun once the Powder is gone: half strength, and no Powder burnt", () => {
    const dry = fireGuns(firebrand({ powder: 0 }), target(), "short", "hotShot", rng());
    expect(dry.powderUsed).toBe(0);
    expect(dry.factors?.powder).toBe(C.outOfPowder);
    expect(dry.raw).toBeCloseTo(C.k * C.outOfPowder);
  });

  it("burns Powder in a battle at double rate, from its own record", () => {
    const r = fight(styled("hunter", "firebrand", { hullPoints: 900, maxHullPoints: 900 }), plain("target", { hullPoints: 900, maxHullPoints: 900 }), scripted({ 1: ["closeIn", "roundShot"] }, ["hold", "hotShot"]), always("hold", "holdFire"));
    expect(r.rounds.map((x) => x.ships[0]!.shot.powderUsed)).toEqual([1, 2, 2, 1, 0]); // 6 Powder: 1 + 2 + 2, then the last 1, then dry
    expect(r.rounds.map((x) => x.ships[0]!.powder)).toEqual([5, 3, 1, 0, 0]);
  });

  it("starts a fire in 3 hits in 10 and a Mortar hit in 4 in 10", () => {
    expect(shotFireChance("hotShot")).toBe(0.3);
    expect(shotFireChance("mortar")).toBe(0.4);
    for (const order of ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel", "charge", "volley", "firePots"] as const) expect(shotFireChance(order), order).toBe(0);
  });
});

describe("the Firebrand's other traits (fighting styles spec section 3)", () => {
  it("Fire Pots from Drill 0 with 2 pots to start, and none to throw once they are gone", () => {
    expect(canThrowPots(styled("hunter", "firebrand", { firePots: 2 }))).toBe(true);
    expect(canThrowPots(styled("hunter", "firebrand", { firePots: 0 }))).toBe(false);
    expect(canThrowPots(styled("hunter", "boarder", { firePots: 2 }))).toBe(false);
    expect(canThrowPots(styled("hunter", "boarder", { firePots: 2, drill: 5 }))).toBe(true);
    expect(canThrowPots(plain("hunter", { firePots: 2, drill: 4 }))).toBe(false);
  });

  it("Tinderbox: a crew fighting a Firebrand fights at 80% of its strength", () => {
    expect(S.firebrand.tinderbox).toBe(0.8);
    expect(tinderboxFactor([styled("target", "firebrand")])).toBe(0.8);
    expect(tinderboxFactor([styled("target", "gunline")])).toBe(1);
    expect(tinderboxFactor([])).toBe(1);
    expect(tinderboxFactor([styled("target", "gunline"), styled("target", "firebrand")])).toBe(0.8); // a Firebrand anywhere on the other side
  });

  it("Fireship: embers catch 40% of the time, for a Firebrand only", () => {
    expect(emberChance(styled("hunter", "firebrand"))).toBe(0.4);
    expect(emberChance(styled("hunter", "boarder"))).toBe(0);
    expect(emberChance(plain("hunter"))).toBe(0);
  });
});
