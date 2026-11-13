// The in-process import job loop: one global sequential worker over `import_jobs`.
import { claimNextJob, failJob, onJobQueued, resetRunningJobs, runImportJob, type ImportJob } from './games';

export const POLL_MS = 1_000;

export interface JobLoop {
  /** Wakes the loop now (it also wakes on every enqueue and every POLL_MS). */
  wake(): void;
  /** Stops after the current job; resolves once the loop has exited. */
  stop(): Promise<void>;
}

export interface JobLoopOptions {
  pollMs?: number;
  /** Test seams. */
  claim?: () => Promise<ImportJob | null>;
  run?: (job: ImportJob) => Promise<void>;
  fail?: (jobId: string) => Promise<void>;
  log?: (message: string, e: unknown) => void;
}

/**
 * Starts the loop: puts jobs left `running` back to `queued`, then claims and runs jobs one at a time. A job that
 * throws (e.g. its account was deleted mid-job) is marked failed if its row still exists, and the loop moves on.
 */
export function startJobLoop(opts: JobLoopOptions = {}): JobLoop {
  const pollMs = opts.pollMs ?? POLL_MS;
  const claim = opts.claim ?? claimNextJob;
  const run = opts.run ?? ((job: ImportJob) => runImportJob(job));
  const fail = opts.fail ?? failJob;
  const log = opts.log ?? ((m, e) => console.error(m, e));
  let stopped = false;
  let wakeUp: (() => void) | undefined;
  /** A wake that came while the loop was busy: the next sleep returns at once. */
  let pending = false;
  const wake = () => {
    pending = true;
    wakeUp?.();
  };
  const unsubscribe = onJobQueued(wake);

  const sleep = () =>
    new Promise<void>((resolve) => {
      if (pending) {
        pending = false;
        return resolve();
      }
      const timer = setTimeout(done, pollMs);
      function done() {
        clearTimeout(timer);
        wakeUp = undefined;
        pending = false;
        resolve();
      }
      wakeUp = done;
    });

  const loop = (async () => {
    try {
      await resetRunningJobs();
    } catch (e) {
      log('Import jobs: reset failed:', e);
    }
    while (!stopped) {
      let job: ImportJob | null = null;
      try {
        job = await claim();
      } catch (e) {
        log('Import jobs: claim failed:', e);
      }
      if (!job) {
        if (!stopped) await sleep();
        continue;
      }
      try {
        await run(job);
      } catch (e) {
        log(`Import job ${job.id} failed:`, e);
        await fail(job.id).catch(() => {});
      }
    }
  })();

  return {
    wake,
    async stop() {
      stopped = true;
      unsubscribe();
      wake();
      await loop;
    },
  };
}
