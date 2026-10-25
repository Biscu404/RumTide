import { describe, expect, it } from "vitest";
import { B, Rng, TEMPLATE_NAMES, powerRating, templateDoctrine, validateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { OPEN_BREEZE, SCENES, buildShip, duel, evenLevels, ratingOf, sceneByName, seedFor, sloopForRatio, verdictFor } from "./arena.ts";
import { crabber, gatePace } from "./boss.ts";
import { chunked } from "./chunks.ts";
import { EFFORTS } from "./effort.ts";
import { fieldShares, judgeSeats, runField } from "./field.ts";
import { runDuels } from "./jobs.ts";
import type { SituationResult } from "./jobs.ts";
import { ALL_PLAYS } from "./jobs.ts";
import { applyPatch, parseSet, patchText } from "./patch.ts";
import { doctrineLines, mutateDoctrine, randomDoctrine, randomPlan } from "./plans.ts";
import { inlinePool, workerPool } from "./pool.ts";
import { failedChecks, render, runChecks } from "./run.ts";
import { readSituation } from "./situations.ts";
import { addVerdict, decidedShare, emptyTally, flipTally, mean, mergeTally, pairedError, pct, wilson } from "./stats.ts";

const fighter = (name: "Brawler" | "Skirmisher" | "Runner" | "Coward") => ({ name, doctrine: templateDoctrine(name) });

describe("the arena", () => {
  it("builds a fresh sloop full of everything, and the same builds the engine rates", () => {
    const ship = buildShip("x");
    expect(ship.hullPoints).toBe(100);
    expect(ship.riggingPoints).toBe(100);
    expect(ship.hands).toBe(30);
    expect(powerRating(ship)).toBe(10);
    expect(ratingOf()).toBe(10);
    expect(ratingOf({ levels: evenLevels(5) })).toBeCloseTo(16);
  });

  it("finds the balanced sloop closest to a Power Rating ratio", () => {
    for (const ratio of [1.25, 1.5, 2]) expect(ratingOf(sloopForRatio(ratio)) / 10).toBeCloseTo(ratio, 1);
    const top = sloopForRatio(99);
    expect(Math.max(...Object.values(top.levels ?? {}))).toBeLessThanOrEqual(10);
    expect(ratingOf(sloopForRatio(1))).toBe(10);
  });

  it("runs the same duel to the same record, and a different seed to a different one", () => {
    const a = duel(fighter("Brawler"), fighter("Brawler"), OPEN_BREEZE, 77);
    expect(duel(fighter("Brawler"), fighter("Brawler"), OPEN_BREEZE, 77)).toEqual(a);
    const others = [1, 2, 3, 4, 5].map((s) => JSON.stringify(duel(fighter("Brawler"), fighter("Brawler"), OPEN_BREEZE, s * 991).rounds));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it("plays every scene the simulator names, and refuses one it does not", () => {
    for (const scene of SCENES) expect(duel(fighter("Brawler"), fighter("Skirmisher"), scene, 5).rounds.length).toBeGreaterThan(0);
    expect(() => sceneByName("the moon")).toThrow("No scene called the moon");
  });

  it("reads a battle from either side, and the Skirmisher beats the Brawler in the open as the notes of D71 say", () => {
    const record = duel(fighter("Skirmisher"), fighter("Brawler"), OPEN_BREEZE, 31);
    expect(verdictFor(record, "hunter")).toBe("win");
    expect(verdictFor(record, "target")).toBe("loss");
    expect(verdictFor(duel(fighter("Runner"), fighter("Runner"), OPEN_BREEZE, 31), "hunter")).toBe("escape");
  });

  it("draws every sample from its own stream of seeds", () => {
    expect(seedFor("a", 1)).toBe(seedFor("a", 1));
    expect(seedFor("a", 1)).not.toBe(seedFor("a", 2));
    expect(seedFor("a", 1)).not.toBe(seedFor("b", 1));
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
    }
    expect(validateDoctrine(crabber(), { slots: 3 })).toEqual([]);
  });

  it("print a doctrine in the words of GAMEPLAY 8.8", () => {
    expect(doctrineLines(templateDoctrine("Coward"))).toEqual([
      "1. IF my hull below 50% THEN Surrender",
      "2. Otherwise: Hold, Round shot",
    ]);
    expect(doctrineLines(templateDoctrine("Brawler"))[0]).toBe("1. IF range is Grappled THEN Close In, Grapeshot");
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

describe("reading a situation (check 2)", () => {
  const plays = ALL_PLAYS.slice();
  /** 24 plays, each with the given mean on 12 seeds and a little spread so the paired error is not 0. */
  const result = (means: (i: number) => number): SituationResult => ({
    plays,
    values: plays.map((_, i) => Array.from({ length: 12 }, (_, s) => means(i) + (s % 2 === 0 ? 0.01 : -0.01))),
  });
  const situation = { scene: "open/breeze", me: "Brawler", foe: "Brawler", k: 1 } as const;

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

  it("is much faster when he fights every captain each Tide than when he fights one (D108)", () => {
    const queue = gatePace([0.5], 5, 6, 400, 1);
    const everyone = gatePace([0.5], 5, 6, 400, 6);
    expect([queue.fightsPerTide, everyone.fightsPerTide]).toEqual([1, 6]);
    expect(everyone.medianTide).toBeLessThan(queue.medianTide);
    expect(everyone.lastTide).toBeLessThan(queue.lastTide);
    expect(everyone.lastByTwelve).toBeGreaterThan(queue.lastByTwelve);
    expect(gatePace([1], 5, 6, 50, 6)).toMatchObject({ medianTide: 5, lastTide: 5, lastByTwelve: 1 }); // everybody wins on the first Tide
  });

  it("gets faster when the chance rises with the Tide, as Old Shellback tires", () => {
    const flat = gatePace([0.3], 5, 6, 600);
    const tiring = gatePace([0.3, 0.3, 0.3, 0.3, 0.5, 0.6, 0.7, 0.8], 5, 6, 600);
    expect(tiring.lastTide).toBeLessThan(flat.lastTide);
  });
});

describe("the jobs and the pool", () => {
  const job = { a: fighter("Brawler"), b: fighter("Skirmisher"), scene: "fog", label: "test/pool", from: 0, count: 40 };

  it("count the same battles in two halves as in one", () => {
    const whole = runDuels(job);
    const first = runDuels({ ...job, count: 25 });
    const second = runDuels({ ...job, from: 25, count: 15 });
    expect(mergeTally(first.tally, second.tally)).toEqual(whole.tally);
    expect(first.lead + second.lead).toBeCloseTo(whole.lead);
  });

  it("give the same answers on worker threads as on this thread", async () => {
    const jobs = [job, { ...job, scene: "kelp", label: "test/pool2" }, { ...job, a: fighter("Runner"), label: "test/pool3" }];
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

  it("keep two runs that are in flight at once apart, each with its own answers", async () => {
    const first = [job, { ...job, label: "test/two1" }];
    const second = [{ ...job, scene: "kelp", label: "test/two2" }, { ...job, a: fighter("Runner"), label: "test/two3" }, { ...job, label: "test/two4", count: 10 }];
    const here = inlinePool();
    const wantFirst = await here.run("duels", first);
    const wantSecond = await here.run("duels", second);
    expect(wantSecond).not.toEqual(wantFirst.slice(0, 3));
    const pool = workerPool(2);
    try {
      const [a, b] = await Promise.all([pool.run("duels", first), pool.run("duels", second)]);
      expect(a).toEqual(wantFirst);
      expect(b).toEqual(wantSecond);
    } finally {
      await pool.close();
    }
  }, 30000);
});

describe("trying a number without editing balance.ts (--set)", () => {
  it("reads path=number and refuses anything else", () => {
    expect(parseSet("combat.rake=1.5")).toEqual({ "combat.rake": 1.5 });
    expect(parseSet("shellback.hull=0")).toEqual({ "shellback.hull": 0 });
    for (const bad of ["combat.rake", "combat.rake=", "=2", "combat.rake=fast"]) expect(() => parseSet(bad)).toThrow("path=number");
  });

  it("changes a number for as long as it is held and puts it back", () => {
    const before = B.combat.rake;
    const restore = applyPatch({ "combat.rake": 1 });
    expect(B.combat.rake).toBe(1);
    restore();
    expect(B.combat.rake).toBe(before);
    expect(patchText({ "combat.rake": 1, "shellback.hull": 600 })).toBe("combat.rake=1, shellback.hull=600");
    expect(patchText({})).toBe("no changes to balance.ts");
  });

  it("refuses a path that is not a number, and leaves every number it had already changed as it was", () => {
    const before = B.combat.rake;
    expect(() => applyPatch({ "combat.rake": 1, "combat.nothing": 2 })).toThrow("There is no number at B.combat.nothing");
    expect(() => applyPatch({ "combat.range": 2 })).toThrow("There is no number at B.combat.range");
    expect(() => applyPatch({ "nowhere.rake": 2 })).toThrow("There is no B.nowhere.rake");
    expect(B.combat.rake).toBe(before);
  });

  it("is held by this thread and by every worker until the pool closes", async () => {
    // The template thresholds are read when this thread builds a doctrine, the damage numbers when a worker fights.
    const strikes = (): number => (templateDoctrine("Coward").rules[0]!.if[0] as { pct: number }).pct;
    const original = strikes();
    const damage = B.combat.k;
    const patch = { "combat.doctrine.templates.cowardStrikesHullPct": 90, "combat.k": damage * 2 };
    const job = { a: fighter("Brawler"), b: fighter("Coward"), scene: "fog", label: "test/patch", from: 0, count: 40 };
    const plain = await inlinePool().run("duels", [job]);

    const inline = inlinePool(patch);
    const here = await inline.run("duels", [job]);
    await inline.close();
    expect(strikes()).toBe(original);
    expect(here).not.toEqual(plain);

    const pool = workerPool(2, patch);
    try {
      expect(strikes()).toBe(90);
      expect(await pool.run("duels", [job])).toEqual(here);
    } finally {
      await pool.close();
    }
    expect(strikes()).toBe(original);
    expect(B.combat.k).toBe(damage);
  }, 30000);

  it("a run says which numbers it was run with", async () => {
    const patch = { "combat.rake": 1 };
    const pool = inlinePool(patch);
    try {
      const r = await runChecks(pool, EFFORTS.tiny, [4], patch);
      expect(r.patch).toEqual(patch);
      expect(render(r).join("\n")).toContain("With: combat.rake=1.");
    } finally {
      await pool.close();
    }
  });
});

describe("a run of the five checks", () => {
  const effort = EFFORTS.tiny;

  it("counts every battle of the field once, in both seats, and shares add up", async () => {
    const data = await runField(inlinePool(), effort);
    for (const cells of Object.values(data.scenes)) {
      for (const a of TEMPLATE_NAMES) for (const b of TEMPLATE_NAMES) expect(cells[a][b].tally.n).toBe(effort.fieldPerCell);
    }
    expect(Object.keys(data.scenes)).toHaveLength(SCENES.length);
    for (const s of fieldShares(data)) {
      expect(s.share).toBeGreaterThanOrEqual(0);
      expect(s.share).toBeLessThanOrEqual(1);
      expect(s.battles).toBe(SCENES.length * 6 * effort.fieldPerCell);
    }
    expect(judgeSeats(data).rows.length).toBe(SCENES.length * 5);
  });

  it("runs all five checks, reports them, and gives the same numbers twice", async () => {
    const first = await runChecks(inlinePool(), effort);
    const second = await runChecks(inlinePool(), effort);
    const strip = (r: typeof first) => JSON.stringify({ ...r, seconds: undefined });
    expect(strip(second)).toBe(strip(first));
    expect(first.field && first.situations && first.seats && first.power && first.boss).toBeTruthy();
    const text = render(first).join("\n");
    for (const n of [1, 2, 3, 4, 5]) expect(text).toContain(`${n}. `);
    expect(text).toContain("Old Shellback");
    expect(failedChecks(first).every((n) => [1, 2, 3, 4, 5].includes(n))).toBe(true);
    // Check 3 must pass even on a tiny run: equal ships do not lean to a seat.
    expect(first.seats?.verdict.overall.range[0]).toBeLessThanOrEqual(0.55);
  }, 60000);

  it("runs only the checks it is asked for", async () => {
    const r = await runChecks(inlinePool(), effort, [4]);
    expect(r.power).toBeDefined();
    expect(r.field).toBeUndefined();
    expect(r.boss).toBeUndefined();
    expect(Object.keys(r.seconds)).toEqual(["4"]);
  });
});
