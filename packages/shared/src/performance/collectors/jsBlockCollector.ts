import { defaultLogger } from '../../logger/logger';
import { perfMark } from '../mark';

let timer: ReturnType<typeof setInterval> | null = null;

function perfNow() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function startJsBlockCollection({
  intervalMs = 50,
  thresholdMs = 200,
} = {}) {
  if (timer) return;
  let last = perfNow();
  timer = setInterval(() => {
    const now = perfNow();
    const gap = now - last;
    const drift = gap - intervalMs;
    last = now;
    if (Number.isFinite(drift) && drift >= thresholdMs) {
      perfMark('jsblock:main', {
        duration: drift,
        drift,
        intervalMs,
        gap,
      });
    }
  }, intervalMs);
}

export function stopJsBlockCollection() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

// ---- Runtime health census ------------------------------------------------
//
// One aggregated line per window for the runtime this runs in: how long its
// event loop was blocked, what the JS heap and the collector did, and how the
// process as a whole fared. The request log records what was asked of a
// runtime, never what it cost, so a slowdown that builds up over a session (a
// growing heap, longer collections) leaves no trace there. Unlike the
// collector above this one reports to the local log and is meant for
// production builds.

const HEALTH_TICK_MS = 100;
const HEALTH_WINDOW_MS = 30_000;
const HEALTH_BLOCK_MS = 200;
// A gap this long means the OS suspended the app, not that JS was busy.
const HEALTH_SUSPENDED_MS = 5000;
const HEALTH_PROCESS_SAMPLE_EVERY_TICKS = 50;

export type IRuntimeHealthProcessSample = {
  cpu: number;
  rss: number;
  uiFps?: number;
  jsFps?: number;
};

export type IRuntimeHealthReport = {
  windowMs: number;
  blockCount: number;
  blockTotalMs: number;
  blockMaxMs: number;
  blockOver500: number;
  blockOver1000: number;
  suspendedCount: number;
  heapMB?: number;
  allocatedMB?: number;
  gcCount?: number;
  gcMs?: number;
  cpuAvg?: number;
  cpuMax?: number;
  rssMB?: number;
  uiFpsMin?: number;
  jsFpsMin?: number;
} & Record<string, number | undefined>;

type IHermesCounters = {
  gcCount: number;
  gcTimeSeconds: number;
  heapBytes: number;
  totalAllocatedBytes: number;
};

// Hermes only; every counter is cumulative since the VM was created.
function readHermesCounters(): IHermesCounters | undefined {
  const hermes = (
    globalThis as {
      HermesInternal?: {
        getInstrumentedStats?: () => Record<string, unknown>;
      };
    }
  ).HermesInternal;
  let stats: Record<string, unknown> | undefined;
  try {
    stats = hermes?.getInstrumentedStats?.();
  } catch {
    return undefined;
  }
  const gcCount = stats?.js_numGCs;
  const gcTimeSeconds = stats?.js_gcTime;
  const heapBytes = stats?.js_heapSize;
  const totalAllocatedBytes = stats?.js_totalAllocatedBytes;
  if (
    typeof gcCount !== 'number' ||
    typeof gcTimeSeconds !== 'number' ||
    typeof heapBytes !== 'number' ||
    typeof totalAllocatedBytes !== 'number'
  ) {
    return undefined;
  }
  return { gcCount, gcTimeSeconds, heapBytes, totalAllocatedBytes };
}

const toMB = (bytes: number) => Math.round(bytes / (1024 * 1024));

// Counts how often an observed key changes, ignoring repeats of the current
// one. An account switch re-announces the same selection several times.
export function createDistinctChangeCounter() {
  let current: string | undefined;
  let count = 0;
  return {
    observe(key: string) {
      if (current !== undefined && key !== current) {
        count += 1;
      }
      current = key;
    },
    getCount: () => count,
  };
}

let healthTimer: ReturnType<typeof setInterval> | null = null;

export function startRuntimeHealthCensus({
  sampleProcess,
  getExtra,
}: {
  sampleProcess?: () => Promise<IRuntimeHealthProcessSample>;
  getExtra?: () => Record<string, number | undefined>;
} = {}) {
  if (healthTimer) return;
  let last = perfNow();
  let windowStartedAt = last;
  let ticks = 0;
  let countersAtWindowStart = readHermesCounters();
  let blockCount = 0;
  let blockTotalMs = 0;
  let blockMaxMs = 0;
  let blockOver500 = 0;
  let blockOver1000 = 0;
  let suspendedCount = 0;
  let cpuSum = 0;
  let cpuSamples = 0;
  let cpuMax = 0;
  let rssBytes = 0;
  let uiFpsMin: number | undefined;
  let jsFpsMin: number | undefined;

  const lowest = (currentMin: number | undefined, value: number | undefined) =>
    // The native sampler reports 0 until its first full window.
    value && (currentMin === undefined || value < currentMin)
      ? value
      : currentMin;

  const flushWindow = (now: number) => {
    const counters = readHermesCounters();
    const before = countersAtWindowStart;
    const report: IRuntimeHealthReport = {
      windowMs: Math.round(now - windowStartedAt),
      blockCount,
      blockTotalMs: Math.round(blockTotalMs),
      blockMaxMs: Math.round(blockMaxMs),
      blockOver500,
      blockOver1000,
      suspendedCount,
      ...(counters
        ? {
            heapMB: toMB(counters.heapBytes),
            ...(before
              ? {
                  allocatedMB: toMB(
                    counters.totalAllocatedBytes - before.totalAllocatedBytes,
                  ),
                  gcCount: counters.gcCount - before.gcCount,
                  // Hermes reports cumulative GC wall time in seconds.
                  gcMs: Math.round(
                    (counters.gcTimeSeconds - before.gcTimeSeconds) * 1000,
                  ),
                }
              : {}),
          }
        : {}),
      ...(cpuSamples > 0
        ? {
            cpuAvg: Math.round(cpuSum / cpuSamples),
            cpuMax: Math.round(cpuMax),
            rssMB: toMB(rssBytes),
            uiFpsMin,
            jsFpsMin,
          }
        : {}),
      ...getExtra?.(),
    };
    defaultLogger.app.perf.runtimeHealthCensus(report);

    windowStartedAt = now;
    countersAtWindowStart = counters;
    blockCount = 0;
    blockTotalMs = 0;
    blockMaxMs = 0;
    blockOver500 = 0;
    blockOver1000 = 0;
    suspendedCount = 0;
    cpuSum = 0;
    cpuSamples = 0;
    cpuMax = 0;
    uiFpsMin = undefined;
    jsFpsMin = undefined;
  };

  healthTimer = setInterval(() => {
    const now = perfNow();
    const drift = now - last - HEALTH_TICK_MS;
    last = now;
    if (drift >= HEALTH_SUSPENDED_MS) {
      // Time the app spent suspended belongs to no window.
      suspendedCount += 1;
      windowStartedAt += drift;
    } else if (drift >= HEALTH_BLOCK_MS) {
      blockCount += 1;
      blockTotalMs += drift;
      blockMaxMs = Math.max(blockMaxMs, drift);
      if (drift >= 500) blockOver500 += 1;
      if (drift >= 1000) blockOver1000 += 1;
    }

    ticks += 1;
    if (sampleProcess && ticks % HEALTH_PROCESS_SAMPLE_EVERY_TICKS === 0) {
      sampleProcess().then(
        (sample) => {
          cpuSum += sample.cpu;
          cpuSamples += 1;
          cpuMax = Math.max(cpuMax, sample.cpu);
          rssBytes = sample.rss;
          uiFpsMin = lowest(uiFpsMin, sample.uiFps);
          jsFpsMin = lowest(jsFpsMin, sample.jsFps);
        },
        () => undefined,
      );
    }

    if (now - windowStartedAt >= HEALTH_WINDOW_MS) {
      flushWindow(now);
    }
  }, HEALTH_TICK_MS);
}

export function stopRuntimeHealthCensus() {
  if (!healthTimer) return;
  clearInterval(healthTimer);
  healthTimer = null;
}
