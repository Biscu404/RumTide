// Runs simulator jobs (jobs.ts) on this thread or on a pool of worker threads (P3.1). A job is plain data, so the result
// is the same either way: the pool only changes how long the run takes.

import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { JOBS } from "./jobs.ts";
import type { JobInput, JobKind, JobOutput } from "./jobs.ts";

export interface Pool {
  /** Runs every job and returns the results in the order of the jobs. */
  run<K extends JobKind>(kind: K, jobs: JobInput<K>[]): Promise<JobOutput<K>[]>;
  close(): Promise<void>;
  readonly size: number;
}

/** Runs the jobs one after another on this thread. For tests, and for a run small enough not to need workers. */
export function inlinePool(): Pool {
  return {
    size: 1,
    async run(kind, jobs) {
      const run = JOBS[kind] as (job: unknown) => unknown;
      return jobs.map((job) => run(job)) as never;
    },
    async close() {},
  };
}

interface Reply {
  id: number;
  result?: unknown;
  error?: string;
}

/**
 * A pool of worker threads, each running worker.ts. By default one fewer than the cores, and at most 8: past that the run does
 * not get faster, because the cores are shared with the logical threads of the same cores.
 */
export function workerPool(size = Math.max(1, Math.min(8, availableParallelism() - 1))): Pool {
  const workers = Array.from({ length: size }, () => new Worker(new URL("./worker.ts", import.meta.url)));
  return {
    size,
    run<K extends JobKind>(kind: K, jobs: JobInput<K>[]): Promise<JobOutput<K>[]> {
      return new Promise((resolve, reject) => {
        const results: unknown[] = new Array(jobs.length);
        let next = 0;
        let done = 0;
        let failed = false;
        if (jobs.length === 0) { resolve([]); return; }
        const cleanups: (() => void)[] = [];
        const finish = (): void => { for (const c of cleanups) c(); };
        const feed = (worker: Worker): void => {
          if (next >= jobs.length || failed) return;
          const id = next++;
          worker.postMessage({ id, kind, job: jobs[id] });
        };
        for (const worker of workers) {
          const onMessage = (reply: Reply): void => {
            if (reply.error !== undefined) {
              failed = true;
              finish();
              reject(new Error(reply.error));
              return;
            }
            results[reply.id] = reply.result;
            done++;
            if (done === jobs.length) { finish(); resolve(results as JobOutput<K>[]); return; }
            feed(worker);
          };
          const onError = (e: Error): void => { failed = true; finish(); reject(e); };
          worker.on("message", onMessage);
          worker.on("error", onError);
          cleanups.push(() => { worker.off("message", onMessage); worker.off("error", onError); });
          feed(worker);
        }
      });
    },
    async close() {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}
