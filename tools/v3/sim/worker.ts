// A worker thread of the combat simulator (P3.1): answers one job at a time from pool.ts.

import { parentPort } from "node:worker_threads";
import { JOBS } from "./jobs.ts";
import type { JobKind } from "./jobs.ts";

interface Task {
  id: number;
  kind: JobKind;
  job: unknown;
}

if (!parentPort) throw new Error("worker.ts runs as a worker thread");
const port = parentPort;

port.on("message", (task: Task) => {
  try {
    const run = JOBS[task.kind] as (job: unknown) => unknown;
    port.postMessage({ id: task.id, result: run(task.job) });
  } catch (e) {
    port.postMessage({ id: task.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
});
