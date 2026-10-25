// The tuned numbers of balance.ts (P3.2): the quick run of the simulator must pass the five checks of GAMEPLAY 8.9, so a later
// number change cannot undo the tuning quietly. If this fails, run `npm run sim:v3 -- --quick` to see which check moved and by
// how much, then either change the number back or tune again and log it in docs/DECISIONS.md.

import { beforeAll, describe, expect, it } from "vitest";
import { EFFORTS } from "./effort.ts";
import { inlinePool } from "./pool.ts";
import { failedChecks, render, runChecks } from "./run.ts";
import type { Results } from "./run.ts";

describe("the five checks of GAMEPLAY 8.9 on the numbers of balance.ts (P3.2)", () => {
  let results: Results;

  beforeAll(async () => {
    const pool = inlinePool(); // one thread: eight workers would starve the other test files of CPU
    try {
      results = await runChecks(pool, EFFORTS.quick);
    } finally {
      await pool.close();
    }
  }, 300000);

  it("all pass on the quick run", () => {
    expect(failedChecks(results), render(results).join("\n")).toEqual([]);
    for (const part of [results.field, results.situations, results.seats, results.power, results.boss]) expect(part).toBeDefined();
  });

  it("leave no template above the cap, and no move or order that is never the best", () => {
    expect(results.field!.verdict.worst.share).toBeLessThanOrEqual(0.6);
    expect(results.situations!.verdict.missing).toEqual([]);
  });

  it("have a double Power Rating win inside the band, and Old Shellback fall about as often as not", () => {
    const power = results.power!.verdict;
    expect(power.checked.strongerWins).toBeGreaterThanOrEqual(0.83);
    expect(power.checked.strongerWins).toBeLessThanOrEqual(0.92);
    expect(power.rising).toBe(true);
    expect(results.boss!.verdict.rate).toBeGreaterThanOrEqual(0.4);
    expect(results.boss!.verdict.rate).toBeLessThanOrEqual(0.6);
  });

  it("let the captains through his gate faster than the queue of one fight a Tide would (D108)", () => {
    const { gate, queue } = results.boss!.data;
    expect(gate.medianTide).toBeLessThan(queue.medianTide);
    expect(gate.lastTide).toBeLessThan(queue.lastTide);
    expect(gate.medianTide).toBeLessThanOrEqual(9); // GAMEPLAY 2.5: the median captain passes by Tide 7 to 9
  });
});
