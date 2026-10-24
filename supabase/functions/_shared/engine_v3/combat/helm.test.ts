import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { rngFor } from "../rng.ts";
import type { Rng } from "../rng.ts";
import type { Terrain } from "../types.ts";
import {
  applyPair, battleRng, hasLocalKnowledge, helmContest, helmScore, isCrippled, pairRow, resolveHelm, startingRange, windGauge,
} from "./helm.ts";
import type { HelmInput, HelmResult } from "./helm.ts";
import { deepFreeze, ScriptedRng, testShip } from "./testing.ts";
import { BATTLE_SIDES, HELM_MOVES, RANGES } from "./types.ts";
import type { BattleShip, BattleSide, HelmMove, HelmRow, Range } from "./types.ts";

const C = B.combat;
const HUNTER_WINS = 0; // a roll of 0 is below any chance above 0
const TARGET_WINS = 0.99;

const sloopH = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
const sloopT = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);

function helm(
  moves: Record<BattleSide, HelmMove>,
  range: Range,
  opts: { terrain?: Terrain; hunter?: BattleShip; target?: BattleShip; gauge?: BattleSide | null; rng?: Rng } = {},
): HelmResult {
  const input: HelmInput = {
    range,
    terrain: opts.terrain ?? "open",
    hunter: opts.hunter ?? sloopH(),
    target: opts.target ?? sloopT(),
    moves,
    gauge: opts.gauge ?? null,
  };
  return resolveHelm(input, opts.rng ?? new ScriptedRng(HUNTER_WINS));
}

describe("Helm score (P2.1, GAMEPLAY 8.4)", () => {
  const open = (ship: BattleShip, other = sloopT(), gauge = false) => helmScore(ship, other, "open", gauge);

  it("is Sails times the share of Rigging left", () => {
    expect(open(sloopH())).toBe(10);
    expect(open(sloopH({ riggingPoints: 50 }))).toBe(5);
    expect(open(testShip("hunter", "brigantine"))).toBeCloseTo(13.5);
  });

  it("is zero for a Crippled ship, and for a monster with no Rigging", () => {
    expect(open(sloopH({ riggingPoints: 0 }))).toBe(0);
    expect(open(sloopH({ maxRiggingPoints: 0, riggingPoints: 0 }))).toBe(0);
  });

  it("adds Helmsman, skill and trait bonuses", () => {
    expect(open(sloopH({ helmBonus: 0.25 }))).toBeCloseTo(12.5);
  });

  it("gives the wind gauge bonus to its holder", () => {
    expect(open(sloopH(), sloopT(), true)).toBeCloseTo(10 * C.windGaugeBonus);
  });

  it("gives Sloops the Shallows bonus, and no one else", () => {
    expect(helmScore(sloopH(), sloopT(), "shallows", false)).toBeCloseTo(10 * C.terrainHelm.shallowsSloop);
    expect(helmScore(testShip("hunter", "brigantine"), sloopT(), "shallows", false)).toBeCloseTo(13.5);
    expect(helmScore(sloopH(), sloopT(), "open", false)).toBe(10);
  });

  it("gives Local Knowledge only to a ship that has the water Charted when its opponent does not", () => {
    expect(hasLocalKnowledge(sloopH({ charted: true }), sloopT())).toBe(true);
    expect(hasLocalKnowledge(sloopH({ charted: true }), sloopT({ charted: true }))).toBe(false);
    expect(hasLocalKnowledge(sloopH(), sloopT({ charted: true }))).toBe(false);
    expect(open(sloopH({ charted: true }))).toBeCloseTo(10 * C.terrainHelm.localKnowledge);
    expect(open(sloopH({ charted: true }), sloopT({ charted: true }))).toBe(10);
  });

  it("gives a ship moving with a Strong Current its bonus", () => {
    expect(open(sloopH({ withCurrent: true }))).toBeCloseTo(10 * C.terrainHelm.withStrongCurrent);
  });

  it("multiplies every bonus together", () => {
    const score = helmScore(sloopH({ charted: true, withCurrent: true, helmBonus: 0.1 }), sloopT(), "shallows", true);
    const expected = 10 * 1.1 * C.windGaugeBonus * C.terrainHelm.shallowsSloop * C.terrainHelm.localKnowledge * C.terrainHelm.withStrongCurrent;
    expect(score).toBeCloseTo(expected);
  });

  it("knows what Crippled means", () => {
    expect(isCrippled(sloopH({ riggingPoints: 0 }))).toBe(true);
    expect(isCrippled(sloopH({ riggingPoints: 1 }))).toBe(false);
    expect(isCrippled(sloopH({ maxRiggingPoints: 0, riggingPoints: 0 }))).toBe(false); // no Rigging to lose
  });
});

describe("the wind gauge (P2.1, GAMEPLAY 8.1)", () => {
  it("goes to the higher Helm score", () => {
    const brig = testShip("hunter", "brigantine");
    expect(windGauge(brig, sloopT(), "open", "breeze")).toBe("hunter");
    expect(windGauge(sloopH(), testShip("target", "brigantine"), "open", "breeze")).toBe("target");
  });

  it("is judged with terrain, Local Knowledge and crew bonuses, but not with the gauge itself", () => {
    const brig = testShip("hunter", "brigantine", { sails: 11 });
    expect(windGauge(brig, sloopT(), "open", "breeze")).toBe("hunter");
    expect(windGauge(brig, sloopT(), "shallows", "breeze")).toBe("target"); // 11.5 against 11
    expect(windGauge(sloopH({ helmBonus: 0.1 }), sloopT({ charted: true }), "open", "breeze")).toBe("target"); // 11 against 11.5
  });

  it("gives a Lurker a bonus on the check", () => {
    expect(windGauge(sloopH({ helmBonus: 0.1 }), sloopT({ lurker: true }), "open", "breeze")).toBe("target"); // 11 against 12
    expect(windGauge(sloopH({ helmBonus: 0.25 }), sloopT({ lurker: true }), "open", "breeze")).toBe("hunter"); // 12.5 against 12
    expect(windGauge(sloopH(), sloopT(), "open", "breeze")).toBeNull();
  });

  it("does not carry the Lurker bonus into the Helm score", () => {
    expect(helmScore(sloopT({ lurker: true }), sloopH(), "open", false)).toBe(10);
  });

  it("is never held in a Calm", () => {
    const brig = testShip("hunter", "brigantine");
    expect(windGauge(brig, sloopT({ lurker: true }), "open", "calm")).toBeNull();
    expect(windGauge(brig, sloopT(), "open", "gale")).toBe("hunter");
  });

  it("is held by nobody when the scores tie", () => {
    expect(windGauge(sloopH(), sloopT(), "open", "breeze")).toBeNull();
  });
});

describe("starting range (P2.1, GAMEPLAY 8.1)", () => {
  it("is Long, and Medium in Fog", () => {
    expect(startingRange("open")).toBe("long");
    expect(startingRange("rocky")).toBe("long");
    expect(startingRange("fog")).toBe("medium");
  });

  it("is what a Lurker chooses, Fog or not", () => {
    expect(startingRange("open", "medium")).toBe("medium");
    expect(startingRange("open", "long")).toBe("long");
    expect(startingRange("fog", "long")).toBe("long");
    expect(startingRange("fog", "medium")).toBe("medium");
  });

  it("never starts beyond Medium in Kelp", () => {
    expect(startingRange("kelp")).toBe("medium");
    expect(startingRange("kelp", "long")).toBe("medium");
    expect(startingRange("kelp", undefined, true)).toBe("medium");
  });

  it("is Far when a Bombardier's spotters see them first, which turns only a start at Long into Far", () => {
    expect(startingRange("open", undefined, true)).toBe("far");
    expect(startingRange("rocky", undefined, true)).toBe("far");
    expect(startingRange("open", "long", true)).toBe("far");
    expect(startingRange("open", "medium", true)).toBe("medium"); // a Lurker who sprang its ambush at Medium
    expect(startingRange("fog", undefined, true)).toBe("medium"); // Fog still starts at Medium
    expect(startingRange("open", undefined, false)).toBe("long");
  });
});

describe("the Helm contest (P2.1, GAMEPLAY 8.4)", () => {
  it("lets A win with probability A over A plus B", () => {
    const c = helmContest(new ScriptedRng(0.5), 6, 4);
    expect(c.chance).toBeCloseTo(0.6);
    expect(c.aWins).toBe(true);
    expect(helmContest(new ScriptedRng(0.7), 6, 4).aWins).toBe(false);
    expect(helmContest(new ScriptedRng(0.7), 4, 6).chance).toBeCloseTo(0.4);
  });

  it("is even when both scores are zero, and certain when only one is", () => {
    expect(helmContest(new ScriptedRng(0.49), 0, 0).aWins).toBe(true);
    expect(helmContest(new ScriptedRng(0.51), 0, 0).aWins).toBe(false);
    expect(helmContest(new ScriptedRng(0), 0, 5).aWins).toBe(false);
    expect(helmContest(new ScriptedRng(0.999), 5, 0).aWins).toBe(true);
  });

  it("wins about as often as its chance says", () => {
    let wins = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (helmContest(battleRng(i, "a", "b", 1), 6, 4).aWins) wins++;
    expect(wins / n).toBeGreaterThan(0.56);
    expect(wins / n).toBeLessThan(0.64);
  });

  it("draws from the named battle stream, one per round", () => {
    expect(battleRng(77, "ship_a", "ship_b", 3).next()).toBe(rngFor(77, "battle", "ship_a", "ship_b", 3).next());
    expect(battleRng(77, "ship_a", "ship_b", 3).next()).not.toBe(battleRng(77, "ship_a", "ship_b", 4).next());
    const roll = rngFor(77, "battle", "ship_a", "ship_b", 3).stream("helm", "chase").next();
    const r = resolveHelm(
      { range: "long", terrain: "open", hunter: sloopH(), target: sloopT(), moves: { hunter: "closeIn", target: "openRange" }, gauge: null },
      battleRng(77, "ship_a", "ship_b", 3),
    );
    expect(r.contests[0]?.roll).toBe(roll);
  });
});

// The pair table of GAMEPLAY 8.4, written out by hand. Each case is a row, read from A's point of view.
type Pos = Range | "escaped";
type Open = "far" | "long" | "medium" | "short" | "close"; // the five distances the pair table moves between
interface PairCase {
  name: string;
  a: HelmMove;
  b: HelmMove;
  row: HelmRow;
  chaseWinner?: "a" | "b"; // only the Close In against Open Range chase has a contest
  at: Record<Open, Pos>;
  modA: number;
  modB: number;
}

// One band nearer, two bands nearer, one band farther, two bands farther, and staying, over the six distances (D121).
const NEAR1: Record<Open, Pos> = { far: "long", long: "medium", medium: "short", short: "close", close: "close" };
const NEAR2: Record<Open, Pos> = { far: "medium", long: "short", medium: "close", short: "close", close: "grappled" };
const FAR1: Record<Open, Pos> = { far: "escaped", long: "far", medium: "long", short: "medium", close: "short" };
const FAR2: Record<Open, Pos> = { far: "escaped", long: "escaped", medium: "far", short: "long", close: "medium" };
const STAY: Record<Open, Pos> = { far: "far", long: "long", medium: "medium", short: "short", close: "close" };

const PAIRS: PairCase[] = [
  { name: "Close In against Close In", a: "closeIn", b: "closeIn", row: "closeClose", at: NEAR2, modA: 1, modB: 1 },
  { name: "Close In against Hold", a: "closeIn", b: "hold", row: "closeHold", at: NEAR1, modA: 1, modB: 1 },
  { name: "Close In wins the chase against Open Range", a: "closeIn", b: "openRange", row: "closeOpen", chaseWinner: "a", at: NEAR1, modA: C.flank, modB: 1 },
  { name: "Open Range wins the chase against Close In", a: "closeIn", b: "openRange", row: "closeOpen", chaseWinner: "b", at: FAR1, modA: 1, modB: 1 },
  { name: "Hold against Hold", a: "hold", b: "hold", row: "holdHold", at: STAY, modA: 1, modB: 1 },
  { name: "Hold against Open Range", a: "hold", b: "openRange", row: "holdOpen", at: FAR1, modA: 1, modB: C.weakened },
  { name: "Open Range against Open Range", a: "openRange", b: "openRange", row: "openOpen", at: FAR2, modA: 1, modB: 1 },
  { name: "Cross Their Bow against Close In", a: "crossTheirBow", b: "closeIn", row: "crossClose", at: NEAR1, modA: C.rake, modB: C.weakened },
  { name: "Cross Their Bow against Hold", a: "crossTheirBow", b: "hold", row: "crossHold", at: STAY, modA: C.rake, modB: C.weakened },
  { name: "Cross Their Bow against Open Range", a: "crossTheirBow", b: "openRange", row: "crossOpen", at: FAR1, modA: C.weakened, modB: C.flank },
  { name: "Cross Their Bow against Cross Their Bow", a: "crossTheirBow", b: "crossTheirBow", row: "crossCross", at: STAY, modA: C.weakened, modB: C.weakened },
];

describe("the Helm pair table (P2.1, GAMEPLAY 8.4)", () => {
  it("has a row for every pair of moves, whichever ship plays which", () => {
    for (const a of HELM_MOVES) {
      for (const b of HELM_MOVES) {
        expect(pairRow(a, b), `${a} against ${b}`).toBe(pairRow(b, a));
        expect(PAIRS.some((p) => p.row === pairRow(a, b))).toBe(true);
      }
    }
    expect(new Set(PAIRS.map((p) => p.row)).size).toBe(10);
  });

  for (const p of PAIRS) {
    describe(p.name, () => {
      // Play it with A as the hunter and again with A as the target.
      for (const aSide of BATTLE_SIDES) {
        const bSide: BattleSide = aSide === "hunter" ? "target" : "hunter";
        for (const range of ["far", "long", "medium", "short", "close"] as const) {
          it(`moves the range from ${range} (A is the ${aSide})`, () => {
            const moves = { [aSide]: p.a, [bSide]: p.b } as Record<BattleSide, HelmMove>;
            const chaseWinner = p.chaseWinner === "b" ? bSide : aSide;
            const out = applyPair(moves, range, chaseWinner);
            const want = p.at[range];
            if (want === "escaped") expect(out.position).toBeLessThan(RANGES.indexOf("far"));
            else expect(RANGES[out.position]).toBe(want);
            expect(out.row).toBe(p.row);
            expect(out.gunsMod[aSide]).toBeCloseTo(p.modA);
            expect(out.gunsMod[bSide]).toBeCloseTo(p.modB);
          });
        }
      }
    });
  }

  it("reports an escape when the range goes past Far, and keeps the range at Far", () => {
    const r = helm({ hunter: "openRange", target: "openRange" }, "long");
    expect(r.escaped).toBe(true);
    expect(r.range).toBe("far");
    const stays = helm({ hunter: "openRange", target: "openRange" }, "medium");
    expect(stays).toMatchObject({ escaped: false, range: "far" });
  });

  it("makes a ship that runs need one more good turn: Open Range at Long reaches Far, not freedom", () => {
    expect(helm({ hunter: "hold", target: "openRange" }, "long")).toMatchObject({ escaped: false, range: "far" });
    expect(helm({ hunter: "hold", target: "openRange" }, "far")).toMatchObject({ escaped: true, range: "far" });
  });

  it("decides the chase with a Helm contest, and only the chase", () => {
    const chase = helm({ hunter: "closeIn", target: "openRange" }, "medium", { rng: new ScriptedRng(TARGET_WINS) });
    expect(chase.contests).toHaveLength(1);
    expect(chase.contests[0]).toMatchObject({ kind: "chase", side: "hunter", winner: "target" });
    expect(chase.range).toBe("long");
    const won = helm({ hunter: "closeIn", target: "openRange" }, "medium", { rng: new ScriptedRng(HUNTER_WINS) });
    expect(won.contests[0]?.winner).toBe("hunter");
    expect(won.range).toBe("short");
    expect(helm({ hunter: "closeIn", target: "hold" }, "medium").contests).toEqual([]);
  });

  it("weighs the chase by Helm score, with the gauge", () => {
    const r = helm({ hunter: "closeIn", target: "openRange" }, "long", { gauge: "target" });
    expect(r.scores.target).toBeCloseTo(10 * C.windGaugeBonus);
    expect(r.contests[0]?.chance).toBeCloseTo(10 / (10 + 10 * C.windGaugeBonus));
  });

  it("returns the guns modifiers a ship fires with", () => {
    const rake = helm({ hunter: "crossTheirBow", target: "closeIn" }, "medium");
    expect(rake.gunsMod).toEqual({ hunter: C.rake, target: C.weakened });
    expect(rake.row).toBe("crossClose");
  });

  it("leaves the range alone while Grappled, because Cut Free belongs to boarding", () => {
    const r = helm({ hunter: "openRange", target: "closeIn" }, "grappled");
    expect(r).toMatchObject({ row: "grappled", range: "grappled", escaped: false, contests: [] });
    expect(r.gunsMod).toEqual({ hunter: 1, target: 1 });
  });
});

describe("the Crippled rule (P2.1, GAMEPLAY 6.3)", () => {
  it("turns a Crippled ship's Open Range and Cross Their Bow into Hold", () => {
    const crippled = { riggingPoints: 0 };
    expect(helm({ hunter: "openRange", target: "hold" }, "long", { hunter: sloopH(crippled) }).moves.hunter).toBe("hold");
    expect(helm({ hunter: "crossTheirBow", target: "hold" }, "long", { hunter: sloopH(crippled) }).moves.hunter).toBe("hold");
    const r = helm({ hunter: "openRange", target: "hold" }, "long", { hunter: sloopH(crippled) });
    expect(r).toMatchObject({ row: "holdHold", escaped: false, range: "long" });
  });

  it("lets a Crippled ship Close In or Hold", () => {
    const crippled = sloopH({ riggingPoints: 0 });
    expect(helm({ hunter: "closeIn", target: "hold" }, "long", { hunter: crippled }).moves.hunter).toBe("closeIn");
    expect(helm({ hunter: "hold", target: "hold" }, "long", { hunter: crippled }).moves.hunter).toBe("hold");
  });

  it("lets a monster with no Rigging at all play any move", () => {
    const monster = sloopH({ maxRiggingPoints: 0, riggingPoints: 0 });
    expect(helm({ hunter: "openRange", target: "hold" }, "long", { hunter: monster }).moves.hunter).toBe("openRange");
  });
});

describe("terrain overrides: Shallows (P2.1, GAMEPLAY 8.4)", () => {
  const brig = (side: BattleSide, over: Partial<BattleShip> = {}) => testShip(side, "brigantine", over);

  it("makes a Brigantine win a Helm contest to reach Close, and stops it at Short when it loses (D42)", () => {
    const moves = { hunter: "closeIn", target: "hold" } as const;
    const won = helm(moves, "short", { terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(HUNTER_WINS) });
    expect(won.range).toBe("close");
    expect(won.contests).toHaveLength(1);
    expect(won.contests[0]).toMatchObject({ kind: "shallows", side: "hunter", winner: "hunter" });
    const lost = helm(moves, "short", { terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(TARGET_WINS) });
    expect(lost.range).toBe("short");
    expect(lost.contests[0]).toMatchObject({ kind: "shallows", winner: "target" });
  });

  it("holds even against Close In, and even when the Brigantine is the one being closed on", () => {
    const both = helm({ hunter: "closeIn", target: "closeIn" }, "medium", { terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(TARGET_WINS) });
    expect(both.range).toBe("short"); // two bands would have reached Close
    const closedOn = helm({ hunter: "closeIn", target: "hold" }, "short", { terrain: "shallows", target: brig("target"), rng: new ScriptedRng(TARGET_WINS) });
    expect(closedOn.range).toBe("short");
    expect(closedOn.contests[0]).toMatchObject({ kind: "shallows", side: "target", winner: "hunter" });
  });

  it("applies to Frigates too, weighing the contest by Helm score", () => {
    const r = helm({ hunter: "closeIn", target: "hold" }, "short", { terrain: "shallows", hunter: testShip("hunter", "frigate"), rng: new ScriptedRng(HUNTER_WINS) });
    expect(r.contests[0]?.chance).toBeCloseTo(18 / (18 + 10 * C.terrainHelm.shallowsSloop));
  });

  it("does not trouble Sloops, or a range that stops short of Close", () => {
    expect(helm({ hunter: "closeIn", target: "closeIn" }, "medium", { terrain: "shallows", rng: new ScriptedRng(TARGET_WINS) })).toMatchObject({ range: "close", contests: [] });
    const short = helm({ hunter: "closeIn", target: "hold" }, "medium", { terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(TARGET_WINS) });
    expect(short).toMatchObject({ range: "short", contests: [] });
  });

  it("does not roll when the ships are already at Close, or in open water", () => {
    const grapple = helm({ hunter: "closeIn", target: "closeIn" }, "close", { terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(TARGET_WINS) });
    expect(grapple).toMatchObject({ range: "grappled", contests: [] });
    const open = helm({ hunter: "closeIn", target: "hold" }, "short", { hunter: brig("hunter"), rng: new ScriptedRng(TARGET_WINS) });
    expect(open).toMatchObject({ range: "close", contests: [] });
  });

  it("is waived for a ship with Local Knowledge, but not when both ships have the water Charted", () => {
    const moves = { hunter: "closeIn", target: "hold" } as const;
    const local = helm(moves, "short", { terrain: "shallows", hunter: brig("hunter", { charted: true }), rng: new ScriptedRng(TARGET_WINS) });
    expect(local).toMatchObject({ range: "close", contests: [] });
    const shared = helm(moves, "short", {
      terrain: "shallows", hunter: brig("hunter", { charted: true }), target: sloopT({ charted: true }), rng: new ScriptedRng(TARGET_WINS),
    });
    expect(shared.range).toBe("short");
    expect(shared.contests).toHaveLength(1);
  });

  it("makes each Brigantine or Frigate win its own contest, hunter first", () => {
    const moves = { hunter: "closeIn", target: "closeIn" } as const;
    const pair = { terrain: "shallows", hunter: brig("hunter"), target: brig("target") } as const;
    const bothWin = helm(moves, "medium", { ...pair, rng: new ScriptedRng(HUNTER_WINS, HUNTER_WINS) });
    expect(bothWin.range).toBe("close");
    expect(bothWin.contests.map((c) => [c.side, c.winner])).toEqual([["hunter", "hunter"], ["target", "target"]]);
    const oneLoses = helm(moves, "medium", { ...pair, rng: new ScriptedRng(HUNTER_WINS, TARGET_WINS) });
    expect(oneLoses.range).toBe("short");
  });

  it("rolls the Shallows contest after the chase", () => {
    const r = helm({ hunter: "closeIn", target: "openRange" }, "short", {
      terrain: "shallows", hunter: brig("hunter"), rng: new ScriptedRng(HUNTER_WINS, TARGET_WINS),
    });
    expect(r.contests.map((c) => c.kind)).toEqual(["chase", "shallows"]);
    expect(r.range).toBe("short"); // the chase was won, the contest to reach Close was lost
  });
});

describe("terrain overrides: Kelp (P2.1, GAMEPLAY 8.4)", () => {
  it("never lets the range go beyond Medium, over the six distances", () => {
    expect(helm({ hunter: "hold", target: "openRange" }, "medium", { terrain: "kelp" }).range).toBe("medium");
    expect(helm({ hunter: "hold", target: "openRange" }, "short", { terrain: "kelp" }).range).toBe("medium");
    expect(helm({ hunter: "hold", target: "openRange" }, "close", { terrain: "kelp" }).range).toBe("short");
    expect(helm({ hunter: "openRange", target: "openRange" }, "short", { terrain: "kelp" }).range).toBe("medium"); // two bands would be Long
    expect(helm({ hunter: "openRange", target: "openRange" }, "close", { terrain: "kelp" }).range).toBe("medium");
  });

  it("does not let anyone escape by range", () => {
    expect(helm({ hunter: "openRange", target: "openRange" }, "medium", { terrain: "kelp" })).toMatchObject({ escaped: false, range: "medium" });
    expect(helm({ hunter: "openRange", target: "openRange" }, "long", { terrain: "open" }).escaped).toBe(true);
  });

  it("still lets ships close in", () => {
    expect(helm({ hunter: "closeIn", target: "hold" }, "short", { terrain: "kelp" }).range).toBe("close");
    expect(helm({ hunter: "closeIn", target: "closeIn" }, "medium", { terrain: "kelp" }).range).toBe("close");
  });
});


describe("terrain overrides: Reef scrape (P2.1, GAMEPLAY 8.4)", () => {
  it("costs every ship that plays Close In or Cross Their Bow its Hull, whatever the result", () => {
    const close = helm({ hunter: "closeIn", target: "hold" }, "medium", { terrain: "reef" });
    expect(close.scrape).toEqual({ hunter: C.reefScrape, target: 0 });
    const cross = helm({ hunter: "hold", target: "crossTheirBow" }, "medium", { terrain: "reef" });
    expect(cross.scrape).toEqual({ hunter: 0, target: C.reefScrape });
    const both = helm({ hunter: "closeIn", target: "crossTheirBow" }, "close", { terrain: "reef" });
    expect(both.scrape).toEqual({ hunter: C.reefScrape, target: C.reefScrape });
  });

  it("spares Hold and Open Range", () => {
    expect(helm({ hunter: "hold", target: "openRange" }, "medium", { terrain: "reef" }).scrape).toEqual({ hunter: 0, target: 0 });
  });

  it("spares a ship whose captain has the water Charted", () => {
    const r = helm({ hunter: "closeIn", target: "closeIn" }, "long", { terrain: "reef", hunter: sloopH({ charted: true }) });
    expect(r.scrape).toEqual({ hunter: 0, target: C.reefScrape });
  });

  it("does not charge a Crippled ship for the Cross it could not play", () => {
    const r = helm({ hunter: "crossTheirBow", target: "hold" }, "medium", { terrain: "reef", hunter: sloopH({ riggingPoints: 0 }) });
    expect(r.scrape).toEqual({ hunter: 0, target: 0 });
  });

  it("charges nothing in other water", () => {
    for (const terrain of ["open", "rocky", "fog", "shallows"] as const) {
      expect(helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", { terrain }).scrape).toEqual({ hunter: 0, target: 0 });
    }
  });
});

describe("resolveHelm is pure and reproducible (P2.1)", () => {
  const moves = { hunter: "closeIn", target: "openRange" } as const;

  it("gives the same result for the same inputs and seed", () => {
    const run = () => helm(moves, "medium", { terrain: "shallows", hunter: testShip("hunter", "brigantine"), rng: battleRng(4242, "ship_hunter", "ship_target", 2) });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("does not change its inputs", () => {
    const input = deepFreeze<HelmInput>({
      range: "medium", terrain: "shallows", hunter: testShip("hunter", "brigantine"), target: sloopT(), moves: { ...moves }, gauge: "hunter",
    });
    const before = JSON.stringify(input);
    resolveHelm(input, battleRng(1, "ship_hunter", "ship_target", 1));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("is independent of other rolls in the round", () => {
    const a = battleRng(9, "x", "y", 1);
    a.next();
    a.next(); // other systems drawing from the round's stream do not move the Helm rolls
    const b = battleRng(9, "x", "y", 1);
    const input: HelmInput = { range: "long", terrain: "open", hunter: sloopH(), target: sloopT(), moves: { ...moves }, gauge: null };
    expect(resolveHelm(input, a)).toEqual(resolveHelm(input, b));
  });
});
