// npm run sim:v3
// The v0.3 combat simulator (P3.1): the five checks of GAMEPLAY 8.9 on the real engine_v3, on a pool of worker threads.
//
//   npm run sim:v3                      the full run, the one the checks are judged on
//   npm run sim:v3 -- --quick           a smaller run for tuning loops
//   npm run sim:v3 -- --check 1,4       only those checks (1 to 5)
//   npm run sim:v3 -- --json out.json   also write every number to a file, to compare runs
//   npm run sim:v3 -- --workers 4       threads to use (default: one fewer than the cores)
//
// The exit code is 1 when a check that ran did not pass.

import { writeFileSync } from "node:fs";
import { EFFORTS } from "./effort.ts";
import { inlinePool, workerPool } from "./pool.ts";
import { CHECK_IDS, failedChecks, render, runChecks } from "./run.ts";
import type { CheckId } from "./run.ts";

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

const effort = EFFORTS[args.includes("--quick") ? "quick" : "full"];
const chosen = value("--check");
const which: CheckId[] = chosen
  ? chosen.split(",").map(Number).filter((n): n is CheckId => (CHECK_IDS as readonly number[]).includes(n))
  : [...CHECK_IDS];
if (chosen && which.length === 0) {
  console.error(`--check wants numbers from 1 to 5, for example --check 1,4. Got ${chosen}.`);
  process.exit(2);
}
const workers = Number(value("--workers") ?? 0);

const pool = workers === 1 ? inlinePool() : workerPool(workers > 1 ? workers : undefined);
try {
  const results = await runChecks(pool, effort, which);
  for (const line of render(results)) console.log(line);
  const file = value("--json");
  if (file) {
    writeFileSync(file, JSON.stringify(results, null, 1) + "\n");
    console.log(`Wrote ${file}.`);
  }
  process.exitCode = failedChecks(results).length === 0 ? 0 : 1;
} finally {
  await pool.close();
}
