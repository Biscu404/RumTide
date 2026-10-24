import { describe, expect, it } from "vitest";
import {
  B, FIGHTING_STYLES as ENGINE_STYLES, Rng, maxHands, powerRating, templateDoctrine, validateDoctrine,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleRecord, GunsOrder, TemplateName } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import {
  FIGHTING_STYLES, OPEN_BREEZE, SCENES, buildShip, duel, evenLevels, ratingOf, sceneByName, seedFor, sloopForRatio, styleFighter, verdictFor,
} from "./arena.ts";
import type { Fighter, WheelStyle } from "./arena.ts";
import { BOSS_HIGH, BOSS_LOW, crabber, gatePace, judgeBoss, spaceFor } from "./boss.ts";
import type { BossData, Scored, StyleBoss } from "./boss.ts";
import { chunked } from "./chunks.ts";
import { judgeDrill, powerLineAt } from "./drill.ts";
import type { DrillData, DrillRow } from "./drill.ts";
import { EFFORTS } from "./effort.ts";
import { WHEEL_STYLES, fieldShares, judgeCap, judgeField, judgeSeats, pairTally, runField } from "./field.ts";
import type { Cells, FieldData } from "./field.ts";
import { emptyBoss, emptyDuels, mergeDuels, runBoss, runDuels, runSituation, runStarts } from "./jobs.ts";
import type { BossJob, DuelsJob, SituationResult } from "./jobs.ts";
import { CUTTER, LASHED_MIN_TRIES, judgeLashed } from "./lashed.ts";
import { applyPatch, parseSet } from "./patch.ts";
import { PLAIN_SPACE, doctrineLines, mutateDoctrine, randomDoctrine, randomPlan } from "./plans.ts";
import { ALL_PLAYS, canTry, ordersFor, playsFor } from "./plays.ts";
import { inlinePool, workerPool } from "./pool.ts";
import type { PowerData, PowerRow } from "./power.ts";
import { CHECK_IDS, CHECK_TITLES, failedChecks, render, runChecks } from "./run.ts";
import type { Results } from "./run.ts";
import {
  REQUIRED, drilledShip, judgeSituations, listPairings, readSituation, showsClearly, situationsOf,
} from "./situations.ts";
import type { Pairing, Situation, SituationData, SituationRow } from "./situations.ts";
import { judgeSmuggler } from "./smuggler.ts";
import { SPENT_ON, spendingLevels, spentLike } from "./spending.ts";
import { addVerdict, decidedShare, emptyTally, flipTally, mean, mergeTally, pairedError, pct, wilson } from "./stats.ts";
import {
  WHEEL_EVEN, WHEEL_EVEN_HIGH, WHEEL_EVEN_LOW, WHEEL_WINS, WHEEL_WIN_HIGH, WHEEL_WIN_LOW, judgeWheel, wheelPairs,
} from "./wheel.ts";

const fighter = (name: TemplateName) => ({ name, doctrine: templateDoctrine(name) });

describe("the arena", () => {
  it("builds a fresh sloop full of everything, and the same builds the engine rates", () => {
    const ship = buildShip("x");
    expect(ship.hullPoints).toBe(100);
    expect(ship.riggingPoints).toBe(100);
    expect(ship.hands).toBe(30);
    expect(powerRating(ship)).toBe(10);
    expect(ratingOf()).toBe(10);
    expect(ratingOf({ levels: evenLevels(5) })).toBeCloseTo(10 * 1.6 ** B.power.exponent); // a D26 sum of 16 (D136)
  });

  it("finds the balanced sloop closest to a Power Rating ratio", () => {
    for (const ratio of [1.25, 1.5, 2]) expect(ratingOf(sloopForRatio(ratio)) / 10).toBeCloseTo(ratio, 1);
    const top = sloopForRatio(99);
    expect(Math.max(...Object.values(top.levels ?? {}))).toBeLessThanOrEqual(10);
    expect(ratingOf(sloopForRatio(1))).toBe(10);
  });

  it("runs the same duel to the same record, and a different seed to a different one", () => {
    const a = duel(fighter("Boarder"), fighter("Boarder"), OPEN_BREEZE, 77);
    expect(duel(fighter("Boarder"), fighter("Boarder"), OPEN_BREEZE, 77)).toEqual(a);
    const others = [1, 2, 3, 4, 5].map((s) => JSON.stringify(duel(fighter("Boarder"), fighter("Boarder"), OPEN_BREEZE, s * 991).rounds));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it("plays every scene the simulator names, and refuses one it does not", () => {
    for (const scene of SCENES) expect(duel(fighter("Boarder"), fighter("Skirmisher"), scene, 5).rounds.length).toBeGreaterThan(0);
    expect(() => sceneByName("the moon")).toThrow("No scene called the moon");
  });

  it("reads a battle from either side: a much stronger Boarder beats a fresh one, and two Smugglers part at once", () => {
    const record = duel({ ...fighter("Boarder"), ship: { levels: evenLevels(10) } }, fighter("Boarder"), OPEN_BREEZE, 31);
    expect(verdictFor(record, "hunter")).toBe("win");
    expect(verdictFor(record, "target")).toBe("loss");
    expect(verdictFor(duel(fighter("Smuggler"), fighter("Smuggler"), OPEN_BREEZE, 31), "hunter")).toBe("escape");
  });

  it("draws every sample from its own stream of seeds", () => {
    expect(seedFor("a", 1)).toBe(seedFor("a", 1));
    expect(seedFor("a", 1)).not.toBe(seedFor("a", 2));
    expect(seedFor("a", 1)).not.toBe(seedFor("b", 1));
  });
});

describe("ships with a Fighting Style (P3.B3)", () => {
  it("really have the style: the Bombardier's crew of 18, the Spotters, and the badge in the record", () => {
    const ship = buildShip("b", { style: "bombardier" });
    expect(ship.style).toBe("bombardier");
    expect(maxHands(ship)).toBe(Math.floor(30 * B.styles.bombardier.handsShare));
    expect(ship.hands).toBe(18);
    expect(buildShip("g", { style: "gunline" }).hands).toBe(30);
    const record = duel(styleFighter("bombardier"), styleFighter("gunline"), OPEN_BREEZE, 9);
    expect(record.ships.map((s) => s.style)).toEqual(["bombardier", "gunline"]);
    expect(record.ships[0]!.maxHands).toBe(18);
    expect(record.startRange).toBe("far"); // Spotters: a Bombardier flagship starts the battle at Far
    expect(duel(styleFighter("gunline"), styleFighter("rammer"), OPEN_BREEZE, 9).startRange).toBe("long");
    expect(duel(fighter("Gunline"), fighter("Rammer"), OPEN_BREEZE, 9).ships.every((s) => s.style === undefined)).toBe(true);
  });

  it("start with the pots the engine gives: a Firebrand its startPots, everyone else none, unless the spec says", () => {
    expect(buildShip("f", { style: "firebrand" }).hold.firePots).toBe(B.styles.firebrand.startPots);
    expect(buildShip("g", { style: "gunline" }).hold.firePots).toBe(0);
    expect(buildShip("g", { style: "gunline", pots: 3 }).hold.firePots).toBe(3);
    expect(buildShip("f", { style: "firebrand", pots: 0 }).hold.firePots).toBe(0);
    const record = duel(styleFighter("firebrand"), styleFighter("gunline", { pots: 1 }), OPEN_BREEZE, 3);
    expect(record.ships[0]!.firePots).toBe(B.styles.firebrand.startPots);
    expect(record.ships[1]!.firePots).toBe(1);
    expect(duel(fighter("Firebrand"), fighter("Gunline"), OPEN_BREEZE, 3).ships[0]!.firePots).toBeUndefined(); // no style, no pots
  });

  it("carry Drill as a level, and the Drill 5 setup is a ship that can throw a pot", () => {
    const record = duel(styleFighter("boarder", { levels: { drill: 5 } }), styleFighter("boarder"), OPEN_BREEZE, 3);
    expect(record.ships[0]!.drill).toBe(5);
    expect(record.ships[1]!.drill).toBeUndefined();
    expect(drilledShip("gunline")).toEqual({ style: "gunline", levels: { drill: B.drill.unlocks.firePots }, pots: B.styles.firebrand.startPots });
    expect(duel(styleFighter("gunline", drilledShip("gunline")), styleFighter("gunline"), OPEN_BREEZE, 3).ships[0]!.firePots).toBe(B.styles.firebrand.startPots);
  });

  it("list the six styles of the wheel, each with its template, and play the template", () => {
    expect(FIGHTING_STYLES.map((f) => f.style)).toEqual(["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand"]);
    expect(FIGHTING_STYLES.map((f) => f.template)).toEqual(["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand"]);
    expect(WHEEL_STYLES).toEqual(FIGHTING_STYLES.map((f) => f.style));
    expect(ENGINE_STYLES).toHaveLength(7); // the engine's own list is the six and the Smuggler
    for (const { style, template } of FIGHTING_STYLES) {
      const f = styleFighter(style);
      expect(f.ship?.style).toBe(style);
      expect(f.doctrine).toEqual(templateDoctrine(template));
    }
    expect(styleFighter("smuggler").doctrine?.name).toBe("Smuggler");
  });
});

describe("random plans and doctrines", () => {
  it("play the same plan from the same seed and side, and only plays that can do something at the range", () => {
    const view = (range: "long" | "close" | "grappled") => ({ range }) as never;
    const first = randomPlan(5, "hunter");
    const again = randomPlan(5, "hunter");
    for (let i = 0; i < 40; i++) {
      const range = (["long", "close", "grappled"] as const)[i % 3]!;
      const choice = first(view(range));
      expect(again(view(range))).toEqual(choice);
      if (choice.kind !== "fight") throw new Error("a plan always fights");
      if (range !== "close") expect(choice.guns).not.toBe("board");
      if (range !== "grappled") expect(choice.guns).not.toBe("repel");
      expect(choice.guns).not.toBe("holdFire");
    }
  });

  it("make doctrines a captain with 3 slots could save, and mutations stay that way", () => {
    const rng = new Rng("test/doctrines");
    let d = randomDoctrine(rng, "r0");
    for (let i = 0; i < 300; i++) {
      d = i % 3 === 0 ? randomDoctrine(rng, `r${i}`) : mutateDoctrine(rng, d, `m${i}`);
      expect(validateDoctrine(d, { slots: 3 })).toEqual([]);
      expect(JSON.stringify(d)).not.toContain("mortar"); // with no space given, the six orders every ship can give
    }
    expect(validateDoctrine(crabber(), { slots: 3 })).toEqual([]);
  });

  it("write only the orders of the space they are given, and a style test only when the space has styles", () => {
    const rng = new Rng("test/space");
    const orders = (d: ReturnType<typeof randomDoctrine>): GunsOrder[] => d.rules.flatMap((r) => [
      ...(r.then.kind === "fight" ? [r.then.guns] : []),
      ...r.if.flatMap((c) => (c.kind === "theirLastGuns" ? [c.order] : [])),
    ]);
    const seen = new Set<GunsOrder>();
    for (const style of ["bombardier", "firebrand", "gunline"] as const) {
      const space = spaceFor(style);
      let d = randomDoctrine(rng, "r", 3, space);
      for (let i = 0; i < 200; i++) {
        d = i % 2 === 0 ? randomDoctrine(rng, "r", 3, space) : mutateDoctrine(rng, d, "m", 3, space);
        expect(validateDoctrine(d, { slots: 3 })).toEqual([]);
        expect(JSON.stringify(d)).not.toContain("theirStyle"); // Old Shellback has no style
        for (const o of orders(d)) { expect(space.orders).toContain(o); seen.add(o); }
      }
    }
    for (const o of ["mortar", "hotShot", "charge", "volley", "firePots"] as const) expect(seen).toContain(o);
    // Only the Bombardier writes the Mortar, only the Firebrand Hot Shot and Fire Pots.
    expect(spaceFor("gunline").orders).not.toContain("mortar");
    expect(spaceFor("gunline").orders).not.toContain("firePots");
    expect(spaceFor("bombardier").orders).toContain("mortar");
    expect(spaceFor("bombardier").orders).not.toContain("hotShot");
    expect(spaceFor("firebrand").orders).toEqual(expect.arrayContaining(["hotShot", "firePots", "charge", "volley"]));
    // A space with styles may write a style test, and it validates.
    const styled = { ...PLAIN_SPACE, styles: ["boarder", "gunline"] as const };
    const found = Array.from({ length: 80 }, (_, i) => randomDoctrine(rng, `s${i}`, 3, styled)).filter((d) => JSON.stringify(d).includes("theirStyle"));
    expect(found.length).toBeGreaterThan(0);
    for (const d of found) expect(validateDoctrine(d, { slots: 3 })).toEqual([]);
  });

  it("print a doctrine in the words of GAMEPLAY 8.8", () => {
    expect(doctrineLines(templateDoctrine("Smuggler"))).toEqual([
      "1. IF my hull below 40% THEN Surrender",
      "2. IF range is Grappled THEN Open Range, Repel",
      "3. Otherwise: Open Range, Chain shot",
    ]);
    expect(doctrineLines(templateDoctrine("Bombardier"))[1]).toBe("2. IF range is at most Short THEN Open Range, Round shot");
    expect(doctrineLines(templateDoctrine("Boarder"))[0]).toBe("1. IF range is Grappled AND their last Guns order was Repel THEN Hold, Volley");
    expect(doctrineLines(templateDoctrine("Firebrand"))[0]).toBe("1. IF range is Grappled THEN Hold, Fire Pots");
  });
});

describe("counting", () => {
  it("tallies verdicts, merges and flips them", () => {
    const t = emptyTally();
    for (const v of ["win", "win", "loss", "draw", "escape"] as const) addVerdict(t, v);
    expect(t).toEqual({ n: 5, win: 2, loss: 1, draw: 1, escape: 1 });
    expect(flipTally(t)).toEqual({ n: 5, win: 1, loss: 2, draw: 1, escape: 1 });
    expect(mergeTally(emptyTally(), t)).toEqual(t);
    expect(decidedShare(t)).toBeCloseTo(2 / 3);
    expect(decidedShare(emptyTally())).toBe(0.5);
  });

  it("gives a Wilson range that holds the share and narrows with more battles", () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
    const [lo2, hi2] = wilson(500, 1000);
    expect(hi2 - lo2).toBeLessThan(hi - lo);
    expect(wilson(0, 0)).toEqual([0, 1]);
    expect(pct(0.625, 1)).toBe("62.5%");
  });

  it("measures a paired difference, which is smaller than the unpaired one when the series move together", () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = a.map((x) => x - 0.5);
    expect(pairedError(a, b)).toBe(0);
    expect(pairedError(a, [6, 5, 4, 3, 2, 1])).toBeGreaterThan(0);
    expect(mean(a)).toBe(3.5);
  });

  it("splits a number of battles into jobs", () => {
    expect(chunked(600, 250)).toEqual([{ from: 0, count: 250 }, { from: 250, count: 250 }, { from: 500, count: 100 }]);
    expect(chunked(0, 250)).toEqual([]);
  });
});

describe("what a ship can try (P3.B3)", () => {
  it("gives a ship with no style the 24 plays of four Helm moves and six Guns orders, with no Mortar and no deck order", () => {
    expect(ALL_PLAYS).toHaveLength(24);
    expect(ALL_PLAYS.some((p) => p.guns === "mortar" || p.guns === "hotShot" || p.guns === "charge")).toBe(false);
    expect(playsFor({}, "open")).toEqual(ALL_PLAYS);
  });

  it("gives the Mortar to a Bombardier only and Hot Shot to a Firebrand only", () => {
    for (const style of ENGINE_STYLES) {
      const orders = ordersFor({ style }, "open");
      expect(orders.includes("mortar")).toBe(style === "bombardier");
      expect(orders.includes("hotShot")).toBe(style === "firebrand");
      for (const six of ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel"] as const) expect(orders).toContain(six);
      for (const deck of ["charge", "volley", "firePots"] as const) expect(orders).not.toContain(deck); // they do nothing in an open fight
    }
    expect(canTry({ style: "bombardier" }, "open", "mortar")).toBe(true);
    expect(canTry({ style: "gunline" }, "open", "mortar")).toBe(false);
    expect(playsFor({ style: "bombardier" }, "open")).toHaveLength(28);
  });

  it("gives Charge and Volley when Grappled, and Fire Pots only to a ship that can throw one", () => {
    expect(ordersFor({ style: "gunline" }, "grappled")).toEqual(expect.arrayContaining(["charge", "volley"]));
    expect(ordersFor({ style: "gunline" }, "grappled")).not.toContain("firePots"); // no pots, Drill 0
    expect(ordersFor({ style: "gunline", pots: 2 }, "grappled")).not.toContain("firePots"); // pots but Drill 0
    expect(ordersFor({ style: "gunline", levels: { drill: 5 } }, "grappled")).not.toContain("firePots"); // Drill 5 but no pots
    expect(ordersFor({ style: "gunline", levels: { drill: 5 }, pots: 2 }, "grappled")).toContain("firePots");
    expect(ordersFor({ style: "firebrand" }, "grappled")).toContain("firePots"); // a Firebrand has pots from the start
    expect(ordersFor({ style: "firebrand", pots: 0 }, "grappled")).not.toContain("firePots");
    expect(ordersFor(drilledShip("boarder"), "grappled")).toContain("firePots");
  });
});

describe("reading a situation (check 2)", () => {
  const plays = ALL_PLAYS.slice();
  /** 24 plays, each with the given mean on 12 seeds and a little spread so the paired error is not 0. */
  const result = (means: (i: number) => number): SituationResult => ({
    plays,
    values: plays.map((_, i) => Array.from({ length: 12 }, (_, s) => means(i) + (s % 2 === 0 ? 0.01 : -0.01))),
    range: "long",
  });
  const situation: Situation = { scene: "open/breeze", me: "boarder", foe: "boarder", k: 1, range: "long", drill: 0, seeds: 12 };

  it("finds the best play and calls its Helm move and Guns order clear when it wins by a wide margin", () => {
    const row = readSituation(situation, result((i) => (i === 7 ? 1 : 0.2)));
    expect(row.top).toEqual(plays[7]);
    expect(row.matters).toBe(true);
    expect(row.clearHelm).toBe(plays[7]!.helm);
    expect(row.clearGuns).toBe(plays[7]!.guns);
  });

  it("says nothing is clear when the plays are alike, and ignores a situation where the choice does not matter", () => {
    const flat = readSituation(situation, result(() => 0.5));
    expect(flat.matters).toBe(false);
    expect(flat.clearHelm).toBeNull();
    // Two plays tie for best with different Helm moves: neither Helm move is clearly best, but they share a Guns order.
    const tie = readSituation(situation, result((i) => (i === 0 || i === ALL_PLAYS.findIndex((p) => p.helm !== plays[0]!.helm && p.guns === plays[0]!.guns) ? 1 : 0.2)));
    expect(tie.matters).toBe(true);
    expect(tie.clearHelm).toBeNull();
    expect(tie.clearGuns).toBe(plays[0]!.guns);
  });

  it("compares a Guns order only with the orders the ship could give, so a Mortar is judged for a Bombardier alone", () => {
    // A Gunline's 24 plays have no Mortar to be compared with, and its best is clear among them.
    const row = readSituation({ ...situation, me: "gunline" }, result((i) => (i === 3 ? 1 : 0.2)));
    expect(row.clearGuns).toBe(plays[3]!.guns);
    expect(playsFor({ style: "gunline" }, "open").some((p) => p.guns === "mortar")).toBe(false);
    const bombardier = playsFor({ style: "bombardier" }, "open");
    const mortar = bombardier.findIndex((p) => p.guns === "mortar" && p.helm === "hold");
    const withMortar = readSituation({ ...situation, me: "bombardier" }, {
      plays: bombardier, range: "long",
      values: bombardier.map((_, i) => Array.from({ length: 12 }, (_, s) => (i === mortar ? 1 : 0.2) + (s % 2 === 0 ? 0.01 : -0.01))),
    });
    expect(withMortar.clearGuns).toBe("mortar");
  });

  const row = (over: Partial<SituationRow>): SituationRow => ({
    ...situation, top: { helm: "hold", guns: "roundShot" }, topValue: 1, spread: 0.5, matters: true, clearHelm: null, clearGuns: null, ...over,
  });

  it("counts a play only where it can show: deck orders when Grappled, great guns in an open fight, Fire Pots at Drill 5", () => {
    expect(showsClearly("roundShot", row({ clearGuns: "roundShot" }))).toBe(true);
    expect(showsClearly("roundShot", row({ clearGuns: "roundShot", range: "grappled" }))).toBe(false);
    expect(showsClearly("repel", row({ clearGuns: "repel" }))).toBe(false); // Repel in an open fight does nothing
    expect(showsClearly("repel", row({ clearGuns: "repel", range: "grappled" }))).toBe(true);
    expect(showsClearly("charge", row({ clearGuns: "charge", range: "grappled" }))).toBe(true);
    expect(showsClearly("charge", row({ clearGuns: "charge" }))).toBe(false);
    expect(showsClearly("volley", row({ clearGuns: "volley", range: "grappled" }))).toBe(true);
    expect(showsClearly("closeIn", row({ clearHelm: "closeIn" }))).toBe(true);
    expect(showsClearly("closeIn", row({ clearHelm: "hold" }))).toBe(false);
    // Fire Pots count only between ships at Drill 5, even for a Firebrand that has pots from the start.
    expect(showsClearly("firePots", row({ me: "firebrand", clearGuns: "firePots", range: "grappled" }))).toBe(false);
    expect(showsClearly("firePots", row({ me: "firebrand", clearGuns: "firePots", range: "grappled", drill: 5 }))).toBe(true);
    expect(showsClearly("firePots", row({ me: "gunline", clearGuns: "firePots", range: "grappled", drill: 5 }))).toBe(true);
    // The Mortar and Hot Shot count for the style that can give them.
    expect(showsClearly("mortar", row({ me: "bombardier", clearGuns: "mortar" }))).toBe(true);
    expect(showsClearly("mortar", row({ me: "gunline", clearGuns: "mortar" }))).toBe(false);
    expect(showsClearly("hotShot", row({ me: "firebrand", clearGuns: "hotShot" }))).toBe(true);
    expect(showsClearly("hotShot", row({ me: "boarder", clearGuns: "hotShot" }))).toBe(false);
  });

  it("calls Ram clearly best for a Rammer at Close with Close In ahead, and Board from Short for a Boarder at Short with Board ahead", () => {
    expect(showsClearly("ram", row({ me: "rammer", range: "close", clearHelm: "closeIn" }))).toBe(true);
    expect(showsClearly("ram", row({ me: "rammer", range: "short", clearHelm: "closeIn" }))).toBe(false);
    expect(showsClearly("ram", row({ me: "rammer", range: "close", clearHelm: "hold" }))).toBe(false);
    expect(showsClearly("ram", row({ me: "boarder", range: "close", clearHelm: "closeIn" }))).toBe(false);
    expect(showsClearly("boardFromShort", row({ me: "boarder", range: "short", clearGuns: "board" }))).toBe(true);
    expect(showsClearly("boardFromShort", row({ me: "boarder", range: "close", clearGuns: "board" }))).toBe(false);
    expect(showsClearly("boardFromShort", row({ me: "rammer", range: "short", clearGuns: "board" }))).toBe(false);
    expect(showsClearly("boardFromShort", row({ me: "boarder", range: "short", clearGuns: "grapeshot" }))).toBe(false);
  });

  it("requires the 4 Helm moves, the 11 Guns orders and the 2 special plays, and names every one that is missing", () => {
    expect(REQUIRED.map((r) => r.name)).toEqual([
      "Close In", "Hold", "Open Range", "Cross Their Bow",
      "Round shot", "Chain shot", "Grapeshot", "Hold Fire", "Board", "Mortar", "Hot Shot", "Repel", "Charge", "Volley", "Fire Pots",
      "Ram", "Board from Short",
    ]);
    const data: SituationData = {
      seeds: 12,
      rows: [row({ clearHelm: "closeIn", clearGuns: "roundShot" }), row({ range: "grappled", clearGuns: "repel", spread: 0.9 })],
    };
    const verdict = judgeSituations(data);
    expect(verdict.pass).toBe(false);
    expect(verdict.kinds).toEqual({ open: 1, grappled: 1, drilled: 0 });
    expect(verdict.missing).toContain("Hold");
    expect(verdict.missing).toContain("Mortar");
    expect(verdict.missing).toContain("Fire Pots");
    expect(verdict.missing).toContain("Ram");
    expect(verdict.missing).not.toContain("Close In");
    expect(verdict.missing).not.toContain("Repel");
    expect(verdict.coverage.find((c) => c.name === "Repel")!.examples[0]).toBe("open/breeze, Boarder against Boarder, round 1 at Grappled");
  });

  it("lists every pair of the seven styles in each scene, and the Drill 5 set only for the Grappled rounds", () => {
    const pairings = listPairings(EFFORTS.tiny);
    const plain = pairings.filter((p) => p.set === "plain");
    const drilled = pairings.filter((p) => p.set === "drilled");
    expect(plain).toHaveLength(EFFORTS.tiny.situationScenes.length * 49);
    expect(drilled).toHaveLength(EFFORTS.tiny.drilledScenes.length * 49);
    expect(plain.every((p) => p.drill === 0 && p.open.length > 0 && p.grappled.length > 0)).toBe(true);
    expect(drilled.every((p) => p.drill === B.drill.unlocks.firePots && p.open.length === 0)).toBe(true);
    expect(new Set(pairings.map((p) => `${p.set}/${p.scene}/${p.me}/${p.foe}`)).size).toBe(pairings.length); // each its own seeds
    expect(plain.some((p) => p.me === "smuggler") && plain.some((p) => p.foe === "smuggler")).toBe(true);
  });

  it("groups the battles that reach a round by the distance it begins at, and keeps a group only when it has enough", () => {
    const pairing: Pairing = { set: "plain", scene: "open/breeze", me: "boarder", foe: "gunline", drill: 0, open: [1, 2], grappled: [3] };
    const starts = [
      ["long", "short", "grappled"], ["long", "short", "grappled"], ["long", "short", "close"], ["long", "medium"], ["long", "short", "grappled", "grappled"],
    ] as const;
    const found = situationsOf(pairing, starts, 2);
    const byKey = Object.fromEntries(found.map((f) => [`${f.situation.k}/${f.situation.range}`, f.samples]));
    expect(byKey["1/long"]).toEqual([0, 1, 2, 3, 4]);
    expect(byKey["2/short"]).toEqual([0, 1, 2, 4]);
    expect(byKey["2/medium"]).toBeUndefined(); // one battle only
    expect(byKey["3/grappled"]).toEqual([0, 1, 4]); // round 3 is wanted in a Grappled fight, so the one at Close is left out
    expect(byKey["3/close"]).toBeUndefined();
    expect(found.every((f) => f.situation.seeds === f.samples.length)).toBe(true);
    // Round 3 is not an open round here, round 1 is not a Grappled one.
    expect(found.some((f) => f.situation.k === 3 && f.situation.range !== "grappled")).toBe(false);
  });
});

describe("the situation jobs", () => {
  const boarder = styleFighter("boarder", drilledShip("boarder"));
  const gunline = styleFighter("gunline", drilledShip("gunline"));

  it("find the battles that start a round Grappled, and try the plays only there, reading the distance from the Chooser", () => {
    const started = runStarts({ a: boarder, b: gunline, scene: "open/breeze", label: "test/starts", count: 12 });
    expect(started.starts).toHaveLength(12);
    expect(started.starts.every((s) => s[0] === "long")).toBe(true);
    const grappled = started.starts.flatMap((s, i) => (s[2] === "grappled" ? [i] : []));
    expect(grappled.length).toBeGreaterThan(0);
    const plays = playsFor(drilledShip("boarder"), "grappled");
    expect(plays.some((p) => p.guns === "firePots")).toBe(true);
    const job = { scene: "open/breeze", me: boarder, foe: gunline, k: 3, samples: grappled, range: "grappled" as const, label: "test/starts", plays };
    const result = runSituation(job);
    expect(result.range).toBe("grappled");
    expect(result.values).toHaveLength(plays.length);
    for (const v of result.values) expect(v).toHaveLength(grappled.length);
    expect(runSituation(job)).toEqual(result);
    // A situation picked for the wrong distance is a bug in the run, and it says so.
    expect(() => runSituation({ ...job, range: "close" })).toThrow("starts round 3 at grappled, not at close");
  });
});

describe("the wheel (check 6)", () => {
  it("lists 12 designed wins and 3 even pairs that cover all 15 pairs of the six styles once", () => {
    expect(WHEEL_WINS).toHaveLength(12);
    expect(WHEEL_EVEN).toHaveLength(3);
    const pairs = wheelPairs();
    expect(new Set(pairs).size).toBe(15);
    for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) if (a < b) expect(pairs).toContain([a, b].sort().join("/"));
  });

  it("gives each style two wins, two losses and one even pair", () => {
    for (const s of WHEEL_STYLES) {
      expect(WHEEL_WINS.filter((w) => w.winner === s)).toHaveLength(2);
      expect(WHEEL_WINS.filter((w) => w.loser === s)).toHaveLength(2);
      expect(WHEEL_EVEN.filter((e) => e.a === s || e.b === s)).toHaveLength(1);
    }
    for (const w of [...WHEEL_WINS, ...WHEEL_EVEN]) expect(w.spec).toBeGreaterThan(0.3);
  });

  /** A field with `share(a, b)` of the decided battles of every pair going to a, over 100 battles a seat in one scene. */
  const field = (share: (a: WheelStyle, b: WheelStyle) => number): FieldData => {
    const cells = {} as Cells;
    for (const a of WHEEL_STYLES) {
      cells[a] = {} as Cells[WheelStyle];
      for (const b of WHEEL_STYLES) {
        const win = Math.round(100 * (a === b ? 0.5 : share(a, b)));
        cells[a][b] = { ...emptyDuels(), tally: { n: 100, win, loss: 100 - win, draw: 0, escape: 0 } };
      }
    }
    return { scenes: { "open/breeze": cells }, perCell: 100 };
  };
  const designed = (a: WheelStyle, b: WheelStyle): number => {
    const win = WHEEL_WINS.find((w) => w.winner === a && w.loser === b);
    if (win) return 0.7;
    return WHEEL_WINS.some((w) => w.winner === b && w.loser === a) ? 0.3 : 0.5;
  };

  it("passes when every designed win is 55% to 80% of the decided battles and every even pair 35% to 65%", () => {
    const verdict = judgeWheel(field(designed));
    expect(verdict.rows).toHaveLength(15);
    expect(verdict.pass).toBe(true);
    expect(verdict.rows.filter((r) => r.kind === "win").every((r) => r.share === 0.7)).toBe(true);
    expect(verdict.rows.every((r) => r.decided === 200)).toBe(true);
    expect(WHEEL_WIN_LOW).toBe(0.55);
    expect(WHEEL_WIN_HIGH).toBe(0.8);
    expect(WHEEL_EVEN_LOW).toBe(0.35);
    expect(WHEEL_EVEN_HIGH).toBe(0.65);
  });

  /** The designed shares, except that `a` takes `x` of the decided battles against `b` in either seat. */
  const except = (a: WheelStyle, b: WheelStyle, x: number) => (p: WheelStyle, q: WheelStyle): number =>
    p === a && q === b ? x : p === b && q === a ? 1 - x : designed(p, q);

  it("fails a designed win that is too small or too large, and an even pair that leans", () => {
    const first = WHEEL_WINS[0]!;
    const tooSmall = judgeWheel(field(except(first.winner, first.loser, 0.5)));
    expect(tooSmall.pass).toBe(false);
    expect(tooSmall.failing.map((r) => `${r.a}/${r.b}`)).toEqual([`${first.winner}/${first.loser}`]);
    expect(judgeWheel(field(except(first.winner, first.loser, 0.54))).pass).toBe(false);
    expect(judgeWheel(field(except(first.winner, first.loser, 0.56))).pass).toBe(true);
    expect(judgeWheel(field(except(first.winner, first.loser, 0.9))).pass).toBe(false);
    expect(judgeWheel(field(except(first.winner, first.loser, 0.8))).pass).toBe(true);
    const even = WHEEL_EVEN[0]!;
    expect(judgeWheel(field(except(even.a, even.b, 0.75))).pass).toBe(false);
    expect(judgeWheel(field(except(even.a, even.b, 0.3))).pass).toBe(false);
    expect(judgeWheel(field(except(even.a, even.b, 0.36))).pass).toBe(true);
    expect(judgeWheel(field(except(even.a, even.b, 0.65))).pass).toBe(true);
  });

  it("counts a pair with nothing decided as a failed win and a passed even pair", () => {
    const draws = field(designed);
    for (const cells of Object.values(draws.scenes)) {
      for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) cells[a][b].tally = { n: 100, win: 0, loss: 0, draw: 100, escape: 0 };
    }
    const verdict = judgeWheel(draws);
    expect(verdict.rows.filter((r) => r.kind === "win").every((r) => !r.ok)).toBe(true);
    expect(verdict.rows.filter((r) => r.kind === "even").every((r) => r.ok)).toBe(true);
  });

  it("reads a pair over both seats and every scene", () => {
    const data = field(designed);
    const tally = pairTally(data, "gunline", "rammer");
    expect(tally.n).toBe(200);
    expect(tally.win + tally.loss).toBe(200);
    expect(tally.win).toBe(60); // the Rammer beats the Gunline 70 to 30, so the Gunline wins 30 a seat
  });
});

describe("the field (checks 1 and 7)", () => {
  /** One scene in which style `s` wins `win` of its 100 battles against each other style and loses the rest. */
  const lopsided = (best: WheelStyle, win: number): FieldData => {
    const cells = {} as Cells;
    for (const a of WHEEL_STYLES) {
      cells[a] = {} as Cells[WheelStyle];
      for (const b of WHEEL_STYLES) {
        const w = a === b ? 50 : a === best ? win : b === best ? 100 - win : 50;
        cells[a][b] = { ...emptyDuels(), tally: { n: 100, win: w, loss: 100 - w, draw: 0, escape: 0 } };
      }
    }
    return { scenes: { "open/breeze": cells }, perCell: 100 };
  };

  it("fails a style above 60% and a style below 25% of the field, and reports the largest and the smallest", () => {
    const fair = judgeField(lopsided("rammer", 50));
    expect(fair.pass).toBe(true);
    expect(fair.largest.share).toBeCloseTo(0.5);
    const high = judgeField(lopsided("rammer", 80));
    expect(high.pass).toBe(false);
    expect(high.largest.style).toBe("rammer");
    expect(high.largest.share).toBeCloseTo(0.8);
    expect(high.smallest.share).toBeLessThan(0.5);
    // The other five split what is left, so a style at 0 sits below the floor.
    const low = judgeField(lopsided("rammer", 0));
    expect(low.pass).toBe(false);
    expect(low.smallest.style).toBe("rammer");
    expect(low.smallest.share).toBe(0);
  });

  it("judges equal spending against the cap alone, with no floor", () => {
    expect(judgeCap(lopsided("boarder", 55)).pass).toBe(true);
    expect(judgeField(lopsided("boarder", 10)).pass).toBe(false); // a style at 10% is under the floor of check 1
    expect(judgeCap(lopsided("boarder", 10)).pass).toBe(true); // and is no failure of equal spending
    const high = judgeCap(lopsided("boarder", 70));
    expect(high.pass).toBe(false);
    expect(high.largest.style).toBe("boarder");
  });

  it("splits the seats of a mirror evenly and ignores a mirror that always draws", () => {
    const data = lopsided("rammer", 50);
    for (const cells of Object.values(data.scenes)) cells.boarder.boarder.tally = { n: 100, win: 0, loss: 0, draw: 100, escape: 0 };
    expect(judgeSeats(data).pass).toBe(true);
    const leaning = lopsided("rammer", 50);
    for (const cells of Object.values(leaning.scenes)) cells.gunline.gunline.tally = { n: 100, win: 80, loss: 20, draw: 0, escape: 0 };
    const verdict = judgeSeats(leaning);
    expect(verdict.pass).toBe(false);
    expect(verdict.failing.map((r) => r.name)).toEqual(["gunline mirror"]);
  });
});

describe("equal spending (check 7)", () => {
  it("spends the levels the way each style would: the Boarder on Drill, the Rammer on Hull, the rest on Cannons", () => {
    expect(SPENT_ON).toEqual({ bombardier: "cannons", gunline: "cannons", skirmisher: "cannons", rammer: "hull", boarder: "drill", firebrand: "cannons" });
    expect(spentLike("boarder", 5)).toEqual({ levels: { drill: 5 } });
    expect(spentLike("rammer", 10)).toEqual({ levels: { hull: 10 } });
    expect(spentLike("gunline", 5)).toEqual({ levels: { cannons: 5 } });
    expect(buildShip("s", { ...spentLike("rammer", 10), style: "rammer" }).hullPoints).toBeGreaterThan(200);
  });

  it("plays 5 and 10 levels, and 15 only if Hull and Cannons allow it", () => {
    expect(B.upgrade.maxLevel).toBe(10);
    expect(spendingLevels()).toEqual([5, 10]);
    const undo = applyPatch({ "upgrade.maxLevel": 15 });
    try {
      expect(spendingLevels()).toEqual([5, 10, 15]);
    } finally {
      undo();
    }
    expect(spendingLevels()).toEqual([5, 10]);
  });
});

describe("Drill (check 8)", () => {
  const power = (rows: [number, number][]): PowerData => ({
    rows: rows.map(([actual, strongerWins]): PowerRow => ({
      ratio: actual, actual, spec: {}, tally: emptyTally(), kinds: {}, fought: 100, escaped: 0, strongerWins, weakerWins: 0, draws: 0,
    })),
  });
  const line = power([[1, 0.33], [1.25, 0.52], [1.5, 0.7], [2, 0.88]]);

  it("finds the line of check 4 between the two ratios either side of a rating", () => {
    const at = powerLineAt(line, 1.38);
    expect(at.below.actual).toBe(1.25);
    expect(at.above.actual).toBe(1.5);
    expect(at.low).toBe(0.52);
    expect(at.high).toBe(0.7);
    expect(at.interpolated).toBeCloseTo(0.52 + (0.7 - 0.52) * ((1.38 - 1.25) / 0.25));
    expect(powerLineAt(line, 1.25).interpolated).toBeCloseTo(0.52);
    expect(powerLineAt(line, 5).above.actual).toBe(2); // past the last row, the last row
    expect(powerLineAt(line, 0.5).below.actual).toBe(1);
  });

  const row = (drill: number, against: DrillRow["against"], win: number, loss: number): DrillRow => ({
    drill, against, tally: { n: win + loss, win, loss, draw: 0, escape: 0 }, kinds: {}, decided: win / Math.max(1, win + loss),
    range: wilson(win, win + loss), fought: win / Math.max(1, win + loss),
  });
  const drillData = (five: [number, number], fifteen: [number, number]): DrillData => ({
    ratio: 1.38,
    rows: [row(5, "boarder", ...five), row(15, "boarder", ...fifteen), row(0, "gunline", 39, 61), row(5, "gunline", 87, 13), row(15, "gunline", 100, 0)],
  });

  it("passes Drill 5 at 55% to 80% of decided battles and Drill 15 inside the Power Rating line", () => {
    const good = judgeDrill(drillData([70, 30], [60, 40]), line);
    expect(good.drill5.pass).toBe(true);
    expect(good.drill15.pass).toBe(true);
    expect(good.pass).toBe(true);
    expect(good.gunline.map((g) => g.drill)).toEqual([0, 5, 15]);
  });

  it("fails a Drill 5 ship that wins every fight or loses most, and a Drill 15 ship outside the line", () => {
    expect(judgeDrill(drillData([100, 0], [60, 40]), line).drill5.pass).toBe(false); // the deck fight has no luck roll (D181)
    expect(judgeDrill(drillData([50, 50], [60, 40]), line).drill5.pass).toBe(false);
    expect(judgeDrill(drillData([70, 30], [100, 0]), line).drill15.pass).toBe(false);
    expect(judgeDrill(drillData([70, 30], [40, 60]), line).drill15.pass).toBe(false);
    expect(judgeDrill(drillData([100, 0], [100, 0]), line).pass).toBe(false);
  });
});

describe("Lashed fast (check 9)", () => {
  it("passes when the held ship wins at most 40% of at least 100 tries, and not on too few tries", () => {
    const base = { control: { tries: 400, wins: 200 }, battles: 100 };
    expect(judgeLashed({ ...base, held: { tries: 300, wins: 100 } }).pass).toBe(true);
    expect(judgeLashed({ ...base, held: { tries: 300, wins: 150 } }).pass).toBe(false);
    const few = judgeLashed({ ...base, held: { tries: LASHED_MIN_TRIES - 1, wins: 10 } });
    expect(few.enough).toBe(false);
    expect(few.pass).toBe(false);
    expect(judgeLashed({ ...base, held: { tries: LASHED_MIN_TRIES, wins: 10 } }).pass).toBe(true);
    expect(judgeLashed({ ...base, held: { tries: 300, wins: 100 } }).control.share).toBe(0.5);
  });

  it("counts the tries of a held ship in real battles: about a third won against the edge, about half with no edge", () => {
    const job: DuelsJob = { a: styleFighter("boarder"), b: { name: "Cutter", doctrine: CUTTER }, scene: "open/breeze", label: "test/lashed", from: 0, count: 60 };
    const held = runDuels(job);
    expect(held.cutFree.held.tries).toBeGreaterThan(30);
    expect(held.cutFree.open.tries).toBe(0); // the Boarder always made the grapple, so somebody always held the edge
    expect(held.cutFree.held.wins).toBeLessThan(held.cutFree.held.tries * 0.5);
    expect(mergeDuels(emptyDuels(), held)).toEqual(held);
  });
});

describe("the Smuggler (check 10)", () => {
  const row = (against: WheelStyle, escaped: number) => ({ against, battles: 100, escaped, share: escaped / 100, range: wilson(escaped, 100), won: 0, lost: 100 - escaped, drawn: 0, other: 0, ok: escaped / 100 >= 0.3 });
  it("passes when it escapes 30% or more against every style, and names the style it escapes least against", () => {
    const good = judgeSmuggler({ rows: WHEEL_STYLES.map((s, i) => row(s, 35 + i)) });
    expect(good.pass).toBe(true);
    expect(good.lowest.against).toBe("bombardier");
    const bad = judgeSmuggler({ rows: WHEEL_STYLES.map((s, i) => row(s, i === 3 ? 29 : 60)) });
    expect(bad.pass).toBe(false);
    expect(bad.lowest.against).toBe("rammer");
  });

  it("counts the battles that end Escaped with the Smuggler as the ship that ran", () => {
    const job: DuelsJob = { a: styleFighter("smuggler"), b: styleFighter("bombardier"), scene: "open/breeze", label: "test/smuggler", from: 0, count: 30 };
    const hunting = runDuels(job);
    expect(hunting.ran.hunter).toBeGreaterThan(0);
    expect(hunting.ran.hunter).toBeLessThanOrEqual(hunting.kinds["escaped"] ?? 0);
    const hunted = runDuels({ ...job, a: styleFighter("bombardier"), b: styleFighter("smuggler") });
    expect(hunted.ran.target).toBeGreaterThan(0);
    const stay = runDuels({ ...job, a: styleFighter("boarder"), b: styleFighter("gunline") });
    expect(stay.ran).toEqual({ hunter: 0, target: 0 });
  });
});

describe("Old Shellback for every style (check 5)", () => {
  const scored = (beaten: number, seeds = 100): Scored => ({ doctrine: crabber(), result: { ...emptyBoss(), beaten }, seeds, rate: beaten / seeds });
  const styleBoss = (style: StyleBoss["style"], beaten: number, judged = true): StyleBoss => ({ style, judged, best: scored(beaten), finalists: [], references: [], trace: [] });
  const data = (beaten: number[], smuggler = 0): BossData => ({
    styles: [...FIGHTING_STYLES.map((f, i) => styleBoss(f.style, beaten[i]!)), styleBoss("smuggler", smuggler, false)],
    paceStyle: "bombardier", pace: [], gate: { captains: 6, firstTide: 5, medianTide: 7, lastTide: 10, lastByTwelve: 1 },
  });

  it("passes when every style is 35% to 80%, and the old band of 40% to 60% is gone", () => {
    expect(BOSS_LOW).toBe(0.35);
    expect(BOSS_HIGH).toBe(0.8);
    expect(judgeBoss(data([35, 50, 60, 70, 75, 80])).pass).toBe(true); // 35 and 80 are inside; 70 is outside the old band
  });

  it("fails if any one style is below 35% or above 80%, and does not judge the Smuggler", () => {
    expect(judgeBoss(data([34, 50, 50, 50, 50, 50])).pass).toBe(false);
    expect(judgeBoss(data([50, 50, 50, 81, 50, 50])).pass).toBe(false);
    expect(judgeBoss(data([50, 50, 50, 50, 50, 100])).pass).toBe(false);
    const v = judgeBoss(data([50, 50, 50, 50, 50, 50], 100));
    expect(v.pass).toBe(true);
    expect(v.rows.find((r) => r.style === "smuggler")!.judged).toBe(false);
    expect(v.rows.find((r) => r.style === "smuggler")!.ok).toBe(false);
  });

  it("fights a fresh sloop that really has the style, with the pots a Firebrand starts with", () => {
    const job: BossJob = { doctrine: templateDoctrine("Firebrand"), ship: { style: "firebrand" }, tide: 6, label: "test/boss", from: 0, count: 6 };
    const result = runBoss(job);
    expect(result.tally.n).toBe(6);
    expect(runBoss(job)).toEqual(result);
    expect(runBoss({ ...job, ship: { style: "gunline" } })).not.toEqual(result);
  });
});

describe("the gate pace (D108)", () => {
  it("passes a captain a Tide when every fight is won, so six captains pass on Tides 5 to 10", () => {
    const g = gatePace([1], 5, 6, 50);
    expect(g.medianTide).toBe(7);
    expect(g.lastTide).toBe(10);
    expect(g.lastByTwelve).toBe(1);
  });

  it("is slower when the fight is a coin flip, and never done when it cannot be won", () => {
    const slow = gatePace([0.5], 5, 6, 400);
    expect(slow.lastTide).toBeGreaterThan(14);
    expect(slow.lastByTwelve).toBeLessThan(0.5);
    expect(gatePace([0], 5, 6, 3).lastByTwelve).toBe(0);
  });

  it("gets faster when the chance rises with the Tide, as Old Shellback tires", () => {
    const flat = gatePace([0.3], 5, 6, 600);
    const tiring = gatePace([0.3, 0.3, 0.3, 0.3, 0.5, 0.6, 0.7, 0.8], 5, 6, 600);
    expect(tiring.lastTide).toBeLessThan(flat.lastTide);
  });
});

describe("the balance patch (--set)", () => {
  const job: DuelsJob = { a: styleFighter("boarder"), b: styleFighter("gunline"), scene: "fog", label: "test/patch", from: 0, count: 20 };

  it("accepts path=number and nothing else", () => {
    expect(parseSet("combat.rake=1.5")).toEqual({ "combat.rake": 1.5 });
    expect(parseSet("drill.perLevel.0=0.02")).toEqual({ "drill.perLevel.0": 0.02 });
    expect(parseSet("shellback.cannons=-3")).toEqual({ "shellback.cannons": -3 });
    for (const bad of ["", "combat.rake", "combat.rake=", "=1.5", "combat.rake=fast", "combat.rake=Infinity", "combat.rake= "]) {
      expect(() => parseSet(bad), bad).toThrow("--set wants path=number");
    }
  });

  it("changes a number for a run on this thread and puts it back when the pool closes", async () => {
    expect(B.combat.rounds).toBe(5);
    const pool = inlinePool({ "combat.rounds": 1 });
    expect(B.combat.rounds).toBe(1);
    const [patched] = await pool.run("duels", [job]);
    await pool.close();
    expect(B.combat.rounds).toBe(5);
    const [plain] = await inlinePool().run("duels", [job]);
    expect(patched!.rounds).toBeLessThan(plain!.rounds); // a one round battle is shorter than a five round one
    expect(patched).not.toEqual(plain);
  });

  it("sets a number inside a list, and a patch of several numbers is undone all together", () => {
    const undo = applyPatch({ "drill.perLevel.0": 0.02, "combat.rake": 3 });
    expect(B.drill.perLevel[0]).toBe(0.02);
    expect(B.combat.rake).toBe(3);
    undo();
    expect(B.drill.perLevel[0]).toBe(0.04);
    expect(B.combat.rake).toBe(2);
  });

  it("throws on a path that is not a number, before anything runs, and leaves the numbers as they were", async () => {
    expect(() => inlinePool({ "combat.nope": 1 })).toThrow("There is no number at B.combat.nope");
    expect(() => inlinePool({ "nope.rake": 1 })).toThrow("nope is not a group of numbers");
    expect(() => inlinePool({ "combat.rake": 3, "combat.nope": 1 })).toThrow("There is no number");
    expect(B.combat.rake).toBe(2); // the valid half of the patch was undone
    expect(() => inlinePool({ "combat.doctrine": 1 })).toThrow("There is no number at B.combat.doctrine"); // a group is not a number
    expect(() => workerPool(1, { "combat.nope": 1 })).toThrow("There is no number at B.combat.nope"); // no worker is started
    expect(B.combat.rake).toBe(2);
  });

  it("gives workers the patch too, so the same job gives the same answer on both pools", async () => {
    const pool = workerPool(2, { "combat.rounds": 1 });
    try {
      expect(B.combat.rounds).toBe(1); // this thread is patched too, for the ratios and builds it makes
      const inline = inlinePool({ "combat.rounds": 1 });
      const here = await inline.run("duels", [job]);
      await inline.close();
      expect(await pool.run("duels", [job])).toEqual(here);
    } finally {
      await pool.close();
    }
    expect(B.combat.rounds).toBe(5);
  }, 30000);
});

describe("the jobs and the pool", () => {
  const job = { a: fighter("Boarder"), b: fighter("Skirmisher"), scene: "fog", label: "test/pool", from: 0, count: 40 };

  it("count the same battles in two halves as in one", () => {
    const whole = runDuels(job);
    const first = runDuels({ ...job, count: 25 });
    const second = runDuels({ ...job, from: 25, count: 15 });
    expect(mergeTally(first.tally, second.tally)).toEqual(whole.tally);
    expect(first.lead + second.lead).toBeCloseTo(whole.lead);
  });

  it("give the same answers on worker threads as on this thread", async () => {
    const jobs = [job, { ...job, scene: "kelp", label: "test/pool2" }, { ...job, a: fighter("Smuggler"), label: "test/pool3" }];
    const here = await inlinePool().run("duels", jobs);
    const pool = workerPool(2);
    try {
      expect(await pool.run("duels", jobs)).toEqual(here);
      expect(await pool.run("duels", [])).toEqual([]);
      expect(await pool.run("duels", jobs)).toEqual(here); // a second run on the same workers
    } finally {
      await pool.close();
    }
  }, 30000);

  it("answer two runs started together each with its own results, not each other's", async () => {
    const other = { ...job, scene: "kelp", label: "test/pool-other", count: 25 };
    const pool = workerPool(2);
    try {
      const [a, b] = await Promise.all([pool.run("duels", [job]), pool.run("duels", [other])]);
      expect(a).toEqual([runDuels(job)]);
      expect(b).toEqual([runDuels(other)]);
    } finally {
      await pool.close();
    }
  }, 30000);

  it("replay styled battles with Drill 5, pots, fire and a deck fight identically from the seed, here and on workers", async () => {
    const drilled = (style: WheelStyle): Fighter => styleFighter(style, drilledShip(style));
    const duels: DuelsJob[] = [
      { a: drilled("firebrand"), b: drilled("boarder"), scene: "fog", label: "test/styled1", from: 0, count: 24 },
      { a: drilled("boarder"), b: drilled("gunline"), scene: "kelp", label: "test/styled2", from: 0, count: 24 },
      { a: drilled("bombardier"), b: styleFighter("rammer"), scene: "open/breeze", label: "test/styled3", from: 0, count: 24 },
    ];
    const started = runStarts({ a: drilled("boarder"), b: drilled("gunline"), scene: "kelp", label: "test/styled-starts", count: 12 });
    const samples = started.starts.flatMap((s, i) => (s[2] === "grappled" ? [i] : []));
    expect(samples.length).toBeGreaterThan(0);
    const situation = {
      scene: "kelp", me: drilled("boarder"), foe: drilled("gunline"), k: 3, samples, range: "grappled" as const, label: "test/styled-starts",
      plays: playsFor(drilledShip("boarder"), "grappled"),
    };
    const startsJob = { a: drilled("firebrand"), b: drilled("boarder"), scene: "fog", label: "test/styled-starts2", count: 8 };
    const bossJob: BossJob = { doctrine: templateDoctrine("Firebrand"), ship: { style: "firebrand" }, tide: 6, label: "test/styled-boss", from: 0, count: 4 };
    // The same job twice gives the same result on this thread.
    expect(runDuels(duels[0]!)).toEqual(runDuels(duels[0]!));
    expect(runSituation(situation)).toEqual(runSituation(situation));
    // Fire and the deck fight really happen in these battles, so their rolls are covered.
    const records: BattleRecord[] = Array.from({ length: 24 }, (_, i) => duel(duels[0]!.a, duels[0]!.b, sceneByName("fog"), seedFor("test/styled1", i)));
    expect(records.some((r) => r.rounds.some((x) => (x.fires ?? []).length > 0))).toBe(true);
    expect(records.some((r) => r.rounds.some((x) => x.ships.some((s) => s.deck?.thrown)))).toBe(true);

    const here = {
      duels: await inlinePool().run("duels", duels), starts: await inlinePool().run("starts", [startsJob]),
      situation: await inlinePool().run("situation", [situation]), boss: await inlinePool().run("boss", [bossJob]),
    };
    const pool = workerPool(2);
    try {
      expect(await pool.run("duels", duels)).toEqual(here.duels);
      expect(await pool.run("starts", [startsJob])).toEqual(here.starts);
      expect(await pool.run("situation", [situation])).toEqual(here.situation);
      expect(await pool.run("boss", [bossJob])).toEqual(here.boss);
    } finally {
      await pool.close();
    }
  }, 60000);
});

describe("a run of the ten checks", () => {
  const effort = EFFORTS.tiny;

  it("counts every battle of the field once, in both seats, and shares add up", async () => {
    const data = await runField(inlinePool(), effort);
    for (const cells of Object.values(data.scenes)) {
      for (const a of WHEEL_STYLES) for (const b of WHEEL_STYLES) expect(cells[a][b].tally.n).toBe(effort.fieldPerCell);
    }
    expect(Object.keys(data.scenes)).toHaveLength(SCENES.length);
    for (const s of fieldShares(data)) {
      expect(s.share).toBeGreaterThanOrEqual(0);
      expect(s.share).toBeLessThanOrEqual(1);
      expect(s.battles).toBe(SCENES.length * 2 * (WHEEL_STYLES.length - 1) * effort.fieldPerCell); // every other style, both seats
    }
    expect(judgeSeats(data).rows.length).toBe(SCENES.length * (1 + WHEEL_STYLES.length)); // the pooled field and each mirror
  }, 30000);

  it("names ten checks, accepts ids 1 to 10, and titles each", () => {
    expect([...CHECK_IDS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const id of CHECK_IDS) expect(CHECK_TITLES[id].length).toBeGreaterThan(10);
  });

  it("runs all ten checks, reports them, and gives the same numbers twice", async () => {
    const first = await runChecks(inlinePool(), effort);
    const second = await runChecks(inlinePool(), effort);
    const strip = (r: typeof first) => JSON.stringify({ ...r, seconds: undefined });
    expect(strip(second)).toBe(strip(first));
    expect(first.field && first.situations && first.seats && first.power && first.boss).toBeTruthy();
    expect(first.wheel && first.spending && first.drill && first.lashed && first.smuggler).toBeTruthy();
    const text = render(first).join("\n");
    for (const n of CHECK_IDS) expect(text).toContain(`${n}. `);
    expect(text).toContain("Old Shellback");
    expect(text).toContain("With: no changes to balance.ts.");
    expect(failedChecks(first).every((n) => (CHECK_IDS as readonly number[]).includes(n))).toBe(true);
    // Check 3 must pass even on a tiny run: equal ships do not lean to a seat.
    expect(first.seats?.verdict.overall.range[0]).toBeLessThanOrEqual(0.55);
    // The wheel is read from the battles of check 1, so it adds none.
    expect(first.wheel?.verdict.rows).toHaveLength(15);
    // Equal spending plays 5 and 10 levels.
    expect(first.spending?.verdict.rows.map((r) => r.levels)).toEqual([5, 10]);
    // The Smuggler row of check 5 is reported and not judged.
    expect(first.boss?.verdict.rows.map((r) => r.style)).toEqual([...WHEEL_STYLES, "smuggler"]);
    expect(first.boss?.data.pace).toHaveLength(10);
  }, 120000);

  it("runs only the checks it is asked for", async () => {
    const r = await runChecks(inlinePool(), effort, [4]);
    expect(r.power).toBeDefined();
    expect(r.field).toBeUndefined();
    expect(r.boss).toBeUndefined();
    expect(Object.keys(r.seconds)).toEqual(["4"]);
  });

  it("runs the battles of check 4 for check 8 when check 8 is asked for alone, and the field once for checks 1, 3 and 6", async () => {
    const r = await runChecks(inlinePool(), effort, [8]);
    expect(r.drill).toBeDefined();
    expect(r.power).toBeUndefined(); // kept as a reference only
    expect(Object.keys(r.seconds)).toEqual(["8"]);
    expect(r.drill?.verdict.drill15.line.below.actual).toBeLessThanOrEqual(r.drill!.data.ratio);
    expect(r.drill?.verdict.drill15.line.above.actual).toBeGreaterThanOrEqual(r.drill!.data.ratio);
    const field = await runChecks(inlinePool(), effort, [6]);
    expect(field.wheel?.verdict.rows).toHaveLength(15);
    expect(field.field).toBeUndefined();
    expect(Object.keys(field.seconds)).toEqual(["6"]);
  }, 30000);

  it("prints the time of the shared battles of checks 1, 3 and 6 once", () => {
    const line = (seconds: Results["seconds"]): string | undefined =>
      render({ effort: "tiny", patch: {}, seconds }).find((l) => l.startsWith("Time:"));
    expect(line({ 1: 37.7, 3: 37.7, 6: 37.7, 4: 3.6 })).toBe("Time: checks 1, 3, 6 37.7s, check 4 3.6s.");
    expect(line({ 3: 5, 9: 1 })).toBe("Time: check 3 5.0s, check 9 1.0s.");
  });

  it("knows which of the ten checks failed", () => {
    const pass = { pass: true };
    const fail = { pass: false };
    const base: Results = { effort: "tiny", patch: {}, seconds: {} };
    expect(failedChecks(base)).toEqual([]);
    const all = {
      ...base,
      field: { verdict: pass }, situations: { verdict: pass }, seats: { verdict: pass }, power: { verdict: pass }, boss: { verdict: pass },
      wheel: { verdict: pass }, spending: { verdict: pass }, drill: { verdict: pass }, lashed: { verdict: pass }, smuggler: { verdict: pass },
    } as unknown as Results;
    expect(failedChecks(all)).toEqual([]);
    for (const [key, id] of [["wheel", 6], ["spending", 7], ["drill", 8], ["lashed", 9], ["smuggler", 10], ["field", 1], ["boss", 5]] as const) {
      expect(failedChecks({ ...all, [key]: { verdict: fail } } as unknown as Results)).toEqual([id]);
    }
    expect(failedChecks({ ...all, wheel: { verdict: fail }, drill: { verdict: fail } } as unknown as Results)).toEqual([6, 8]);
  });
});

// A reminder that the sim tests build ships through the engine's own newShip: a Power Rating needs the style's crew counted right.
describe("the Power Rating of a ship with a style", () => {
  it("does not change with the style (styles are equal on paper), and counts Drill by the Hands", () => {
    for (const style of ENGINE_STYLES) expect(ratingOf({ style })).toBeCloseTo(10);
    expect(ratingOf({ style: "boarder", levels: { drill: 15 } }) / 10).toBeCloseTo(1.38, 1);
  });
});
