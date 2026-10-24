// npm run sim:v3
// The v0.3 combat simulator (P3.1, P3.B3): ten checks on the real engine_v3, on a pool of worker threads. The five of GAMEPLAY 8.9
// (field share, best play, seat split, Power Rating, Old Shellback) now play the six Fighting Styles and the deck fight, and five
// more check the styles: the wheel (6), equal spending (7), Drill (8), Lashed fast (9) and the Smuggler's escapes (10).
//
//   npm run sim:v3                      the full run, the one the checks are judged on
//   npm run sim:v3 -- --quick           a smaller run for tuning loops
//   npm run sim:v3 -- --check 1,4       only those checks (1 to 10)
//   npm run sim:v3 -- --json out.json   also write every number to a file, to compare runs
//   npm run sim:v3 -- --workers 4       threads to use (default: one fewer than the cores, at most 8)
//   npm run sim:v3 -- --set combat.rake=1.5 --set shellback.cannons=20
//                                       try numbers of balance.ts for this run without editing the file
//
// The exit code is 1 when a check that ran did not pass.

import { writeFileSync } from "node:fs";
import { EFFORTS } from "./effort.ts";
import { parseSet } from "./patch.ts";
import type { Patch } from "./patch.ts";
import { inlinePool, workerPool } from "./pool.ts";
import type { Pool } from "./pool.ts";
import { CHECK_IDS, failedChecks, render, runChecks } from "./run.ts";
import type { CheckId } from "./run.ts";

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

const effort = EFFORTS[args.includes("--quick") ? "quick" : "full"];

// A flag with a missing or unknown value stops the run with exit code 2, so a typo never runs a different set of checks.
const fail = (message: string): never => {
  console.error(message);
  process.exit(2);
};
const hasFlag = (flag: string): boolean => args.includes(flag);
const flagValue = (flag: string): string | undefined => {
  const v = value(flag);
  if (hasFlag(flag) && (v === undefined || v.startsWith("--"))) fail(`${flag} wants a value.`);
  return v;
};

const chosen = flagValue("--check");
const ids = chosen ? chosen.split(",") : [];
const which: CheckId[] = chosen ? ids.map(Number).filter((n): n is CheckId => (CHECK_IDS as readonly number[]).includes(n)) : [...CHECK_IDS];
if (chosen && (which.length === 0 || which.length !== ids.length)) {
  fail(`--check wants numbers from 1 to ${CHECK_IDS.length}, for example --check 1,4. Got ${chosen}.`);
}
const workersText = flagValue("--workers");
const workers = workersText === undefined ? 0 : Number(workersText);
if (!Number.isInteger(workers) || workers < 0) fail(`--workers wants a whole number, for example --workers 4. Got ${workersText}.`);

// A --set that is not path=number, or names a number that is not in balance.ts, stops the run before it starts.
const patch: Patch = {};
let pool: Pool;
try {
  args.forEach((a, i) => { if (a === "--set") Object.assign(patch, parseSet(args[i + 1] ?? "")); });
  pool = workers === 1 ? inlinePool(patch) : workerPool(workers > 1 ? workers : undefined, patch);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
try {
  const results = await runChecks(pool, effort, which, patch);
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
