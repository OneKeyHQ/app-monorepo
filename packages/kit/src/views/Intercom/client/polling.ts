type IJob = {
  run: () => Promise<void>;
  interval?: number;
  due: number;
  failures: number;
  queued: boolean;
  pending?: Promise<void>;
};

// All support reads share one timer in main (or the single web/desktop runtime).
// Writes never enter this scheduler: an uncertain send needs an explicit retry.
const jobs = new Set<IJob>();
let timer: ReturnType<typeof setTimeout> | undefined;
const maximumDelay = 5 * 60_000;

function schedule() {
  clearTimeout(timer);
  timer = undefined;
  const due = Math.min(
    ...Array.from(jobs, (job) => (job.pending ? Infinity : job.due)),
  );
  if (!Number.isFinite(due)) return;
  timer = setTimeout(
    () => {
      timer = undefined;
      for (const job of jobs) {
        if (!job.pending && job.due <= Date.now()) void execute(job);
      }
      schedule();
    },
    Math.max(0, due - Date.now()),
  );
}

function execute(job: IJob): Promise<void> {
  if (!jobs.has(job)) return Promise.resolve();
  if (job.pending) return job.pending;
  job.due = Infinity;
  job.pending = Promise.resolve()
    .then(async () => {
      if (jobs.has(job)) await job.run();
    })
    .then(
      () => {
        job.failures = 0;
        job.due = job.queued
          ? Date.now()
          : Date.now() + (job.interval ?? Infinity);
      },
      () => {
        job.failures = Math.min(job.failures + 1, 10);
        const delay = Math.min(
          maximumDelay,
          (job.interval ?? Infinity) * 2 ** job.failures,
        );
        // Jitter avoids synchronized retries; push hints cannot skip this backoff.
        job.due =
          Date.now() +
          Math.min(maximumDelay, delay * (1 + Math.random() * 0.1));
      },
    )
    .finally(() => {
      job.queued = false;
      job.pending = undefined;
      if (jobs.has(job) && job.due <= Date.now()) void execute(job);
      else schedule();
    });
  return job.pending;
}

export function createSupportPollingTask(
  run: () => Promise<void>,
  interval?: number,
) {
  const job: IJob = {
    run,
    interval,
    due: Infinity,
    failures: 0,
    queued: false,
  };
  jobs.add(job);
  return {
    refresh: () => execute(job),
    async refreshAfterCurrent() {
      await job.pending;
      await execute(job);
    },
    push() {
      if (!jobs.has(job) || job.failures) return;
      if (job.pending) job.queued = true;
      else void execute(job);
    },
    stop() {
      jobs.delete(job);
      job.queued = false;
      schedule();
    },
  };
}
