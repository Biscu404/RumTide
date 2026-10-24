import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import type { BattleInput, Chooser, RoundView } from "./battle.ts";
import { damageShare, pointsOutcome, runBattle } from "./battle.ts";
import { fireGuns } from "./guns.ts";
import { battleRng } from "./helm.ts";
import { always, battleOf, deepFreeze, scripted, surrendersAt, testShip } from "./testing.ts";
import type { BattleRecord, BattleShip, OutcomeKind } from "./types.ts";

const C = B.combat;
const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);
const idle = always("hold", "holdFire");

const fight = (h: Chooser, t: Chooser, hs: Partial<BattleShip> = {}, ts: Partial<BattleShip> = {}, over: Partial<BattleInput> = {}) =>
  runBattle(battleOf(hunter(hs), target(ts), { hunter: h, target: t }, over));
/** An ambush sprung at Medium: two ships that both Close In reach Close in one round, as they did from Long with four distances. */
const NEAR: Partial<BattleInput> = { ambush: "medium" };

/** The first Tide seed from 1 up for which a battle satisfies `wanted`. The engine is pure, so this is a fixed answer. */
function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean): number {
  for (let seed = 1; seed < 400; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

describe("the seven outcomes of GAMEPLAY 8.7 (P2.2)", () => {
  it("Draw: five quiet rounds, no one ahead", () => {
    const r = fight(idle, idle);
    expect(r.rounds).toHaveLength(C.rounds);
    expect(r.outcome).toEqual({ kind: "draw", winner: null, loser: null, round: C.rounds });
  });

  it("Escaped: the range goes past Far, and the guns of that round stay silent", () => {
    const run = always("openRange", "roundShot");
    const r = fight(run, run);
    expect(r.outcome).toEqual({ kind: "escaped", winner: null, loser: null, round: 1 });
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0]!.escaped).toBe(true);
    expect(r.rounds[0]!.rangeAfter).toBe("far");
    expect(r.rounds[0]!.ships.map((s) => s.shot)).toEqual([{ track: null, damage: 0, powderUsed: 0 }, { track: null, damage: 0, powderUsed: 0 }]);
    expect(r.final.map((s) => s.powder)).toEqual([6, 6]);
  });

  it("Struck Colours: the loser's doctrine says Surrender", () => {
    const r = fight(always("hold", "roundShot"), surrendersAt(2, always("hold", "roundShot")));
    expect(r.outcome).toEqual({ kind: "struckColours", winner: "hunter", loser: "target", round: 2 });
    expect(r.rounds).toHaveLength(2);
    expect(r.rounds[1]!.struck).toEqual(["target"]);
  });

  it("Sunk: Hull reaches 0", () => {
    const r = fight(always("closeIn", "roundShot"), always("hold", "roundShot"), {}, { hullPoints: 5 });
    expect(r.outcome).toEqual({ kind: "sunk", winner: "hunter", loser: "target", round: 1 });
    expect(r.final[1]!.hullPoints).toBe(0);
  });

  it("Captured: the boarding melee leaves one side too weak to go on", () => {
    const r = fight(always("closeIn", "board"), always("closeIn", "roundShot"), {}, { hands: 8 }, NEAR);
    expect(r.outcome).toEqual({ kind: "captured", winner: "hunter", loser: "target", round: 1 });
    expect(r.rounds[0]!.grapples).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    // The Board made the grapple, so the hunter charges over the rail (30 x 0.2 x 1.5 x 1.25, and First over the rail x1.25 of that)
    // against a crew that fights with Fists: the target's 8 Hands are gone, and its fists took 2 of the hunter's 30.
    expect(r.rounds[0]!.melee).toMatchObject({ lost: { hunter: 2, target: 8 }, hands: { hunter: 28, target: 0 }, firstOver: "hunter" });
  });

  it("Victory on points: a 5 point lead in damage share after five rounds (D132)", () => {
    const r = fight(always("hold", "roundShot"), idle);
    expect(r.rounds).toHaveLength(C.rounds);
    expect(r.outcome).toMatchObject({ kind: "victory", winner: "hunter", loser: "target", round: C.rounds });
    expect(r.dealt.hunter - r.dealt.target).toBeGreaterThanOrEqual(C.victoryMargin);
    expect(r.final[1]!.hullPoints).toBeGreaterThan(0);
  });

  it("Crippled: Rigging reaches 0, the battle goes on, and the ship can no longer Open or Cross", () => {
    const r = fight(always("closeIn", "chainShot"), scripted({ 1: ["hold", "roundShot"] }, ["openRange", "roundShot"]), {}, { riggingPoints: 10 });
    expect(r.rounds[0]!.crippled).toEqual(["target"]);
    expect(r.rounds.slice(1).every((round) => round.crippled.length === 0)).toBe(true); // it happens once
    expect(r.rounds).toHaveLength(C.rounds); // the battle went on
    for (const round of r.rounds.slice(1)) {
      expect(round.ships[1]!.helm).toBe("hold"); // it asked to Open Range and could not
      expect(round.row).toBe("closeHold"); // so the hunter closes on a ship that holds, not one that runs
    }
    // Crippled is a state, not a way for a battle to end (D52).
    expect(["sunk", "captured", "struckColours", "escaped", "victory", "draw"]).toContain(r.outcome.kind);
  });

  it("can end each of the six outcomes that end a battle", () => {
    const kinds = new Set<OutcomeKind>([
      fight(idle, idle).outcome.kind,
      fight(always("openRange", "roundShot"), always("openRange", "roundShot")).outcome.kind,
      fight(idle, surrendersAt(1, idle)).outcome.kind,
      fight(always("closeIn", "roundShot"), idle, {}, { hullPoints: 5 }).outcome.kind,
      fight(always("closeIn", "board"), always("closeIn", "roundShot"), {}, { hands: 8 }, NEAR).outcome.kind,
      fight(always("hold", "roundShot"), idle).outcome.kind,
    ]);
    expect([...kinds].sort()).toEqual(["captured", "draw", "escaped", "struckColours", "sunk", "victory"]);
  });
});

describe("Victory on points (P2.2, GAMEPLAY 8.7)", () => {
  it("goes to a lead of exactly 5 points (D132)", () => {
    expect(C.victoryMargin).toBe(0.05);
    expect(pointsOutcome({ hunter: 0.05, target: 0 }, 5)).toEqual({ kind: "victory", winner: "hunter", loser: "target", round: 5 });
    expect(pointsOutcome({ hunter: 0, target: 0.05 }, 5)).toEqual({ kind: "victory", winner: "target", loser: "hunter", round: 5 });
    expect(pointsOutcome({ hunter: 0.0999, target: 0 }, 5).kind).toBe("victory"); // a draw under the old 10 points
  });

  it("does not go to a smaller lead", () => {
    expect(pointsOutcome({ hunter: 0.0499, target: 0 }, 5).kind).toBe("draw");
    expect(pointsOutcome({ hunter: 0.4, target: 0.36 }, 5).kind).toBe("draw");
  });

  it("is not fooled by floating point: 0.25 less 0.2 is still a lead of 5 points", () => {
    expect(0.25 - 0.2).toBeLessThan(0.05);
    expect(pointsOutcome({ hunter: 0.25, target: 0.2 }, 5).kind).toBe("victory");
  });

  it("measures damage as a share of the victim's whole health, averaged over its tracks (D56)", () => {
    const ship = hunter();
    expect(damageShare(ship, "hull", 30)).toBeCloseTo(0.3 / 3);
    expect(damageShare(ship, "rigging", 30)).toBeCloseTo(0.3 / 3);
    expect(damageShare(ship, "hands", 15)).toBeCloseTo(0.5 / 3);
  });

  it("counts two tracks for a ship with no Rigging", () => {
    const monster = target({ maxRiggingPoints: 0, riggingPoints: 0 });
    expect(damageShare(monster, "hull", 50)).toBeCloseTo(0.5 / 2);
    expect(damageShare(monster, "rigging", 10)).toBe(0);
  });

  it("adds up what each side dealt, Reef scrapes not included", () => {
    const r = fight(always("closeIn", "holdFire"), idle, {}, {}, { terrain: "reef" });
    expect(r.rounds[0]!.ships[0]!.scrape).toBe(C.reefScrape);
    expect(r.dealt).toEqual({ hunter: 0, target: 0 });
  });

  it("counts the melee's Hands as damage dealt", () => {
    const r = fight(always("closeIn", "board"), always("closeIn", "roundShot"), {}, { hands: 8 }, NEAR);
    expect(r.dealt.hunter).toBeGreaterThan(damageShare(target(), "hands", 5));
    expect(r.dealt.target).toBeGreaterThan(0);
  });
});

describe("a round, step by step (P2.2, GAMEPLAY 8.3)", () => {
  it("records the doctrines, the starting range, the wind gauge and both ships as round 1 began", () => {
    const quick = hunter({ sails: 14 });
    const r = runBattle(battleOf(quick, target(), { hunter: idle, target: idle }, { doctrines: { hunter: "Boarders", target: "Runner" } }));
    expect(r.doctrines).toEqual({ hunter: "Boarders", target: "Runner" });
    expect(r.startRange).toBe("long");
    expect(r.gauge).toBe("hunter");
    expect(r.hunter).toBe("ship_hunter");
    expect(r.target).toBe("ship_target");
    expect(r.ships.map((s) => [s.side, s.shipId])).toEqual([["hunter", "ship_hunter"], ["target", "ship_target"]]);
    expect(r.ships[0]!.hullPoints).toBe(100);
  });

  it("holds no wind gauge in a Calm (8.1)", () => {
    const r = runBattle(battleOf(hunter({ sails: 14 }), target(), { hunter: idle, target: idle }, { wind: "calm" }));
    expect(r.gauge).toBeNull();
  });

  it("starts at Medium in Fog, and at the range a Lurker chose", () => {
    expect(fight(idle, idle, {}, {}, { terrain: "fog" }).startRange).toBe("medium");
    expect(fight(idle, idle, {}, {}, { ambush: "medium" }).startRange).toBe("medium");
    expect(fight(idle, idle, {}, {}, { terrain: "fog", ambush: "long" }).startRange).toBe("long");
  });

  it("hands each captain the state as the round begins, and what the other played last", () => {
    const views: RoundView[] = [];
    const spy: Chooser = (view) => {
      if (view.side === "hunter") views.push(view);
      return { kind: "fight", rule: 0, abilities: [], helm: "closeIn", guns: "grapeshot" };
    };
    fight(spy, always("hold", "roundShot"));
    expect(views[0]).toMatchObject({ round: 1, side: "hunter", range: "long", terrain: "open", wind: "breeze", last: { hunter: null, target: null } });
    expect(views[1]).toMatchObject({ round: 2, range: "medium", last: { hunter: { helm: "closeIn", guns: "grapeshot" }, target: { helm: "hold", guns: "roundShot" } } });
    expect(views[1]!.ships.target.hands).toBeLessThan(30); // the round-1 grapeshot has landed
    expect(views[1]!.ships.hunter.hullPoints).toBeLessThan(100); // and so has the round-1 round shot
    expect(views[0]!.ships.target.hands).toBe(30);
  });

  it("shows the Crippled rule in what a ship played last", () => {
    const views: RoundView[] = [];
    const spy: Chooser = (view) => {
      if (view.side === "target") views.push(view);
      return { kind: "fight", rule: 0, abilities: [], helm: "openRange", guns: "roundShot" };
    };
    fight(always("hold", "roundShot"), spy, {}, { riggingPoints: 0 });
    expect(views[1]!.last.target).toEqual({ helm: "hold", guns: "roundShot" });
  });

  it("records the rule that fired and the abilities above it", () => {
    const rule: Chooser = () => ({ kind: "fight", rule: 3, abilities: [{ rule: 1, ability: "gunner.heated_shot" }], helm: "hold", guns: "holdFire" });
    const r = fight(rule, idle);
    expect(r.rounds[0]!.ships[0]).toMatchObject({ rule: 3, abilities: [{ rule: 1, ability: "gunner.heated_shot" }], helm: "hold", guns: "holdFire" });
    expect(r.rounds[0]!.ships[1]).toMatchObject({ rule: 0, abilities: [] });
  });

  it("uses up the abilities a Chooser fired, and shows the choosers who has already jettisoned (P2.3)", () => {
    const views: RoundView[] = [];
    const caster: Chooser = (view) => {
      if (view.side === "hunter") views.push(view);
      const abilities = view.round === 2 ? [{ rule: 1, ability: "gunner.heated_shot" }] : [];
      return { kind: "fight", rule: 0, abilities, helm: "hold", guns: "holdFire", jettison: view.round === 3 };
    };
    const r = fight(caster, idle, { abilities: ["gunner.heated_shot", "helmsman.hard_about"] });
    expect(views.map((v) => v.ships.hunter.abilities)).toEqual([
      ["gunner.heated_shot", "helmsman.hard_about"], ["gunner.heated_shot", "helmsman.hard_about"],
      ["helmsman.hard_about"], ["helmsman.hard_about"], ["helmsman.hard_about"],
    ]);
    expect(views.map((v) => v.jettisoned.hunter)).toEqual([false, false, false, true, true]);
    expect(views.map((v) => v.jettisoned.target)).toEqual([false, false, false, false, false]);
    expect(r.ships[0]!.abilities).toEqual(["gunner.heated_shot", "helmsman.hard_about"]); // the record keeps round 1's state
    expect(r.final[0]!.abilities).toEqual(["helmsman.hard_about"]);
    expect(r.final[1]!.abilities).toEqual([]);
  });

  it("uses up an ability fired in the round the colours came down", () => {
    const strike: Chooser = () => ({ kind: "surrender", rule: 1, abilities: [{ rule: 0, ability: "gunner.heated_shot" }] });
    const r = fight(always("hold", "roundShot"), strike, {}, { abilities: ["gunner.heated_shot"] });
    expect(r.outcome.kind).toBe("struckColours");
    expect(r.final[1]!.abilities).toEqual([]);
  });

  it("fires the guns at the new range, with luck from the round's own stream", () => {
    const r = fight(always("closeIn", "roundShot"), always("hold", "holdFire"));
    expect(r.rounds[0]!.rangeAfter).toBe("medium");
    const expected = fireGuns(hunter(), target(), "medium", "roundShot", battleRng(1234, "ship_hunter", "ship_target", 1), { terrain: "open", helmMod: 1 });
    expect(r.rounds[0]!.ships[0]!.shot).toEqual({ track: "hull", damage: expected.damage, powderUsed: 1 });
    expect(r.rounds[0]!.ships[0]!.shot.damage).toBeGreaterThanOrEqual(19);
    expect(r.rounds[0]!.ships[0]!.shot.damage).toBeLessThanOrEqual(25);
  });

  it("fires both ships' guns at the same time, so a ship sunk in the round still shoots", () => {
    const r = fight(always("closeIn", "roundShot"), always("closeIn", "roundShot"), {}, { hullPoints: 5 });
    expect(r.outcome.kind).toBe("sunk");
    expect(r.final[0]!.hullPoints).toBeLessThan(100);
    expect(r.rounds[0]!.ships[1]!.shot.damage).toBeGreaterThan(0);
  });

  it("burns Powder and carries the staleness streak from round to round", () => {
    const r = fight(always("hold", "roundShot"), idle);
    expect(r.final[0]!.powder).toBe(6 - C.rounds);
    expect(r.final[0]!.guns).toEqual({ order: "roundShot", repeats: C.rounds, charged: false });
  });

  it("stops after five rounds", () => {
    expect(fight(idle, idle).rounds.map((x) => x.round)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("terrain and the Helm in a battle (P2.2)", () => {
  it("charges a Reef scrape to the Hull of a ship that Closes In without a chart (8.4, D44)", () => {
    const r = fight(always("closeIn", "holdFire"), idle, {}, {}, { terrain: "reef" });
    expect(r.rounds[0]!.ships.map((s) => s.scrape)).toEqual([C.reefScrape, 0]);
    expect(r.final[0]!.hullPoints).toBe(100 - C.reefScrape * C.rounds); // every round it Closes In scrapes again
  });

  it("spares a ship whose captain has the water Charted", () => {
    const r = fight(always("closeIn", "holdFire"), idle, { charted: true }, {}, { terrain: "reef" });
    expect(r.rounds[0]!.ships[0]!.scrape).toBe(0);
    expect(r.final[0]!.hullPoints).toBe(100);
  });

  it("can sink a ship that scrapes its last Hull away", () => {
    const r = fight(always("closeIn", "holdFire"), idle, { hullPoints: 5 }, {}, { terrain: "reef" });
    expect(r.outcome).toEqual({ kind: "sunk", winner: "target", loser: "hunter", round: 1 });
  });

  it("lets a ship that is Crippled hold instead of Opening Range", () => {
    const r = fight(always("openRange", "roundShot"), always("openRange", "roundShot"), { riggingPoints: 0 }, {}, { ambush: "medium" });
    expect(r.rounds[0]!.ships[0]!.helm).toBe("hold");
    expect(r.rounds[0]!.row).toBe("holdOpen"); // not openOpen, which would grow the range two bands and end it
    expect(r.rounds[0]!.escaped).toBe(false);
    expect(r.rounds[0]!.rangeAfter).toBe("long");
  });
});

describe("boarding in a battle (P2.2, GAMEPLAY 8.6)", () => {
  it("grapples when both ships Close In at Close, and the melee runs the same round", () => {
    const r = fight(always("closeIn", "grapeshot"), always("closeIn", "grapeshot"));
    expect(r.rounds.map((x) => x.rangeAfter).slice(0, 3)).toEqual(["short", "close", "grappled"]); // from Long, two bands a round
    expect(r.rounds[1]!.melee).toBeNull();
    expect(r.rounds[2]!.melee).not.toBeNull();
    const near = fight(always("closeIn", "grapeshot"), always("closeIn", "grapeshot"), {}, {}, NEAR);
    expect(near.rounds[0]!.rangeAfter).toBe("close");
    expect(near.rounds[1]!.rangeAfter).toBe("grappled");
  });

  it("runs the melee after the guns, on the Hands that are left", () => {
    const r = fight(always("closeIn", "grapeshot"), always("closeIn", "grapeshot"), {}, {}, NEAR);
    const round = r.rounds[1]!;
    const handsAfterGuns = round.ships.map((s, i) => s.hands + round.melee!.lost[i === 0 ? "hunter" : "target"]);
    expect(round.melee!.strength.hunter).toBe(handsAfterGuns[0]);
    expect(round.melee!.strength.target).toBe(handsAfterGuns[1]);
  });

  it("keeps fighting the melee every round while Grappled", () => {
    const r = fight(always("closeIn", "repel"), always("closeIn", "repel"), { hands: 60, maxHands: 60 }, { hands: 60, maxHands: 60 }, NEAR);
    expect(r.rounds.slice(1).every((round) => round.melee !== null)).toBe(true);
  });

  it("makes a Board order grapple at Close, and fire no guns", () => {
    const r = fight(always("closeIn", "board"), always("hold", "roundShot"), {}, { hands: 60, maxHands: 60 }, NEAR);
    expect(r.rounds[0]!.rangeAfter).toBe("short"); // Close In against Hold shrinks one band: Board waits for Close
    expect(r.rounds[0]!.grapples).toEqual([]);
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(r.rounds[1]!.grapples).toEqual([{ side: "hunter", ok: true, why: expect.any(String) }]);
    expect(r.rounds[1]!.ships[0]!.shot.track).toBeNull();
  });

  it("fails to grapple against a faster ship that does not Board or Hold", () => {
    const r = fight(always("closeIn", "board"), always("closeIn", "roundShot"), {}, { sails: 20 }, NEAR);
    expect(r.rounds[0]!.grapples).toEqual([{ side: "hunter", ok: false, why: "failed" }]);
    expect(r.rounds[0]!.rangeAfter).toBe("close");
    expect(r.rounds[0]!.melee).toBeNull();
  });

  it("does not capture a ship just because it has few Hands: it has to be boarded", () => {
    const r = fight(idle, idle, {}, { hands: 1 });
    expect(r.outcome.kind).toBe("draw");
  });

  it("can be Cut Free of: Open Range wins a Helm contest and the range returns to Close", () => {
    const grapple = always("closeIn", "grapeshot");
    const play = (seed: number) => runBattle(battleOf(hunter({ hands: 60, maxHands: 60 }), target({ hands: 60, maxHands: 60 }), {
      hunter: grapple,
      target: scripted({ 3: ["openRange", "grapeshot"] }, ["closeIn", "grapeshot"]),
    }, { seed, ...NEAR }));
    const freed = findSeed(play, (r) => r.rounds[2]?.rangeAfter === "close");
    const record = play(freed);
    expect(record.rounds[1]!.rangeAfter).toBe("grappled");
    expect(record.rounds[2]!.contests.map((c) => [c.kind, c.side, c.winner])).toEqual([["cutFree", "target", "target"]]);
    expect(record.rounds[2]!.melee).toBeNull(); // not Grappled when the melee would have run
  });

  it("keeps the ships Grappled when the Cut Free contest is lost", () => {
    const play = (seed: number) => runBattle(battleOf(hunter({ hands: 60, maxHands: 60 }), target({ hands: 60, maxHands: 60 }), {
      hunter: always("closeIn", "grapeshot"),
      target: scripted({ 3: ["openRange", "grapeshot"] }, ["closeIn", "grapeshot"]),
    }, { seed, ...NEAR }));
    const held = findSeed(play, (r) => r.rounds[2]?.rangeAfter === "grappled");
    const record = play(held);
    expect(record.rounds[2]!.contests.map((c) => [c.kind, c.side, c.winner])).toEqual([["cutFree", "target", "hunter"]]);
    expect(record.rounds[2]!.melee).not.toBeNull();
  });
});

describe("Struck Colours (P2.2, GAMEPLAY 8.7)", () => {
  it("ends the battle in the round it is played, before anything else happens", () => {
    const r = fight(always("closeIn", "roundShot"), surrendersAt(1, idle));
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0]!.struck).toEqual(["target"]);
    expect(r.rounds[0]!.rangeAfter).toBe("long");
    expect(r.rounds[0]!.ships.map((s) => s.shot.damage)).toEqual([0, 0]);
    expect(r.final.map((s) => s.hullPoints)).toEqual([100, 100]);
  });

  it("is a Draw if both sides strike", () => {
    const r = fight(surrendersAt(2, idle), surrendersAt(2, idle));
    expect(r.outcome).toEqual({ kind: "draw", winner: null, loser: null, round: 2 });
    expect(r.rounds[1]!.struck).toEqual(["hunter", "target"]);
  });

  it("records the rule that said Surrender", () => {
    const r = fight(idle, surrendersAt(1, idle));
    expect(r.rounds[0]!.ships[1]!.rule).toBe(1);
  });
});

describe("two ships sinking in the same round (P2.2, D54)", () => {
  it("goes to whoever dealt more damage in the battle", () => {
    const r = fight(always("closeIn", "roundShot"), always("closeIn", "roundShot"), { hullPoints: 5 }, { hullPoints: 8 });
    expect(r.final.map((s) => s.hullPoints)).toEqual([0, 0]);
    expect(r.outcome).toEqual({ kind: "sunk", winner: "hunter", loser: "target", round: 1 }); // the hunter took 8 Hull from its rival, the target only 5
  });

  it("is a Draw when they dealt the same", () => {
    const r = fight(always("closeIn", "roundShot"), always("closeIn", "roundShot"), { hullPoints: 5 }, { hullPoints: 5 });
    expect(r.outcome).toEqual({ kind: "draw", winner: null, loser: null, round: 1 });
  });
});

describe("Jettison (P2.2, GAMEPLAY 8.7)", () => {
  it("is recorded for the ship that threw its cargo overboard", () => {
    const r = fight(idle, always("hold", "holdFire", { jettison: true }));
    expect(r.jettisoned).toEqual(["target"]);
    expect(r.rounds[0]!.ships.map((s) => s.jettison)).toEqual([false, true]);
  });

  it("is recorded once however many rounds it is played", () => {
    expect(fight(always("hold", "holdFire", { jettison: true }), always("hold", "holdFire", { jettison: true })).jettisoned).toEqual(["hunter", "target"]);
  });

  it("is empty when no one threw anything", () => {
    expect(fight(idle, idle).jettisoned).toEqual([]);
  });
});

describe("runBattle is pure and reproducible (P2.2)", () => {
  const play = (seed: number) =>
    runBattle(battleOf(hunter(), target(), {
      hunter: scripted({ 1: ["closeIn", "chainShot"], 2: ["crossTheirBow", "roundShot"] }, ["closeIn", "grapeshot"]),
      target: scripted({ 1: ["hold", "roundShot"] }, ["crossTheirBow", "roundShot"]),
    }, { seed }));

  it("gives an identical BattleRecord for the same battle and seed", () => {
    expect(JSON.stringify(play(77))).toBe(JSON.stringify(play(77)));
    expect(play(77)).toEqual(play(77));
  });

  it("gives a different battle on a different seed", () => {
    expect(JSON.stringify(play(77))).not.toBe(JSON.stringify(play(78)));
  });

  it("survives a JSON round trip", () => {
    const record = play(5);
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });

  it("does not change its inputs", () => {
    const input = deepFreeze(battleOf(hunter(), target(), { hunter: always("closeIn", "board"), target: always("closeIn", "repel") }));
    expect(() => runBattle(input)).not.toThrow();
  });

  it("draws the rolls of a battle with no styles from the same streams as before: the chase and the guns' luck (D16)", () => {
    // The Fighting Styles add their own streams (ram, mortar, helm/dash) and move none of the old ones.
    const r = fight(always("closeIn", "roundShot"), always("openRange", "roundShot"), {}, {}, NEAR);
    const rng = battleRng(1234, "ship_hunter", "ship_target", 1);
    const chase = r.rounds[0]!.contests[0]!;
    expect(chase.kind).toBe("chase");
    expect(chase.roll).toBe(battleRng(1234, "ship_hunter", "ship_target", 1).stream("helm", "chase").next());
    const after = r.rounds[0]!.rangeAfter as "short" | "long";
    const mods = chase.winner === "hunter" ? { hunter: C.flank, target: 1 } : { hunter: 1, target: 1 };
    const expected = fireGuns(hunter(), target(), after, "roundShot", rng, { terrain: "open", helmMod: mods.hunter });
    expect(r.rounds[0]!.ships[0]!.shot.damage).toBe(expected.damage);
    expect(r.rounds[0]!.contests.map((c) => c.kind)).toEqual(["chase"]);
    expect(r.rounds.every((x) => x.rams === undefined && x.ships.every((s) => s.mortar === undefined && s.asked === undefined))).toBe(true);
  });

  it("returns ships that are copies, not the ones it was given", () => {

    const h = hunter();
    const r = runBattle(battleOf(h, target(), { hunter: idle, target: idle }));
    expect(r.ships[0]).toEqual(h);
    expect(r.ships[0]).not.toBe(h);
    expect(r.final[0]).not.toBe(r.ships[0]);
  });

  it("gives the sides the sides they play, whatever the ships were labelled", () => {
    const r = runBattle(battleOf(hunter({ side: "target" }), target({ side: "hunter" }), { hunter: idle, target: idle }));
    expect(r.ships.map((s) => s.side)).toEqual(["hunter", "target"]);
  });
});
