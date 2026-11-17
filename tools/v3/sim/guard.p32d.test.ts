// P3.2d, D223: the guard. The quick run of the simulator must keep passing, so a later change to a number or a rule cannot undo
// the tuning of P3.2 quietly. It runs the same checks as `npm run sim:tune`: every check but check 2 (best play), which takes
// three times as long as the other nine together and is run with the full simulator at the end of a tuning task instead.
//
// If this test fails you changed the balance of combat. Run `npm run sim:tune` to see which check moved and by how much.

import { availableParallelism } from "node:os";
import { describe, expect, it } from "vitest";
import { EFFORTS } from "./effort.ts";
import { workerPool } from "./pool.ts";
import { failedChecks, runChecks } from "./run.ts";
import type { CheckId } from "./run.ts";

const GUARDED: readonly CheckId[] = [1, 3, 4, 5, 6, 7, 8, 9, 10];
// A quarter of the cores, four at most: the other test files run beside this one and must not time out waiting for a core.
const WORKERS = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 4)));

describe("the guard of the combat tuning (P3.2d)", () => {
  it("passes checks 1 and 3 to 10 on the quick run", async () => {
    const pool = workerPool(WORKERS);
    try {
      const results = await runChecks(pool, EFFORTS.quick, GUARDED);
      expect(failedChecks(results)).toEqual([]);
    } finally {
      await pool.close();
    }
  }, 900000);
});
