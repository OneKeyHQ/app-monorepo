import { defaultLogger } from '../../logger/logger';
import platformEnv, { ERuntimeRole } from '../../platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '../../utils/appVisibility';
import { isAccountSwitchDiagnosticsEnabled } from '../enabled';
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
// collector above this one reports to the local log in explicitly enabled
// account-switch regression builds, including Release builds.

const HEALTH_TICK_MS = 100;
const HEALTH_WINDOW_MS = 30_000;
const HEALTH_BLOCK_MS = 200;
const HEALTH_PROCESS_SAMPLE_EVERY_TICKS = 50;
const FPS_WINDOW_MS = 1000;
const FPS_MAX_SAMPLES = 32;

// Wall-clock bounds identify the window; only monotonic elapsed is the FPS
// denominator. Validity: 0 = foreground, 1 = background/lifecycle boundary.
// Compact tuples keep the existing census below native logger's 4096 limit.
export type IRuntimeHealthFpsSample = [
  windowStartedAt: number,
  windowEndedAt: number,
  actualDurationMs: number,
  frames: number,
  validityCode: 0 | 1,
];

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
  fpsSamples?: IRuntimeHealthFpsSample[];
} & Record<string, number | IRuntimeHealthFpsSample[] | undefined>;

type IHermesCounters = {
  gcCount: number;
  gcTimeSeconds: number;
  heapBytes: number;
  totalAllocatedBytes: number;
  // Optional: not every Hermes build reports these.
  liveBytes?: number;
  mallocBytes?: number;
  youngGCCount?: number;
  oldGCCount?: number;
  compactionCount?: number;
  gcAvgSeconds?: number;
  gcMaxSeconds?: number;
  externalBytes?: number;
};

// GC counts, allocated totals and timing summaries are VM-lifetime values;
// live bytes, external bytes and heap capacity are current gauges.
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
  const liveBytes = stats?.js_allocatedBytes;
  const mallocBytes = stats?.js_mallocSizeEstimate;
  const specific = stats?.js_gcSpecific;
  const gcSpecific =
    specific && typeof specific === 'object'
      ? (specific as Record<string, unknown>)
      : undefined;
  const optionalNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  return {
    gcCount,
    gcTimeSeconds,
    heapBytes,
    totalAllocatedBytes,
    ...(typeof liveBytes === 'number' ? { liveBytes } : {}),
    ...(typeof mallocBytes === 'number' ? { mallocBytes } : {}),
    youngGCCount: optionalNumber(gcSpecific?.js_numYGCollections),
    oldGCCount: optionalNumber(gcSpecific?.js_numOGCollections),
    compactionCount: optionalNumber(gcSpecific?.js_numCompactions),
    gcAvgSeconds: optionalNumber(stats?.js_avgGCTime),
    gcMaxSeconds: optionalNumber(stats?.js_maxGCTime),
    externalBytes: optionalNumber(stats?.js_externalBytes),
  };
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

// ---- Inbound traffic census ----------------------------------------------
//
// Everything the background sends this runtime arrives as a JSON string
// through a handful of handlers, and parsing it is the one allocation source
// the request log cannot size: it records that a call was made, never how much
// data came back. Counting bytes per sender here answers "what is allocating"
// without sampling the heap.

// Distinct names per kind; beyond this everything lands in one bucket, so a
// sender that mints unique names cannot grow this map without bound.
const INBOUND_MAX_NAMES = 96;
const INBOUND_TOP = 8;

export type IInboundKind = 'rpc' | 'atom' | 'event';

type IInboundTotals = { count: number; chars: number };

const inboundByKind = new Map<IInboundKind, IInboundTotals>();
const inboundByName = new Map<string, IInboundTotals>();

function addInbound(
  target: Map<string, IInboundTotals> | Map<IInboundKind, IInboundTotals>,
  key: string,
  chars: number,
) {
  const totals = (target as Map<string, IInboundTotals>).get(key);
  if (totals) {
    totals.count += 1;
    totals.chars += chars;
    return;
  }
  (target as Map<string, IInboundTotals>).set(key, { count: 1, chars });
}

/**
 * Record one payload the background pushed into this runtime. `chars` is the
 * length of the raw string as it arrived, so the caller pays nothing beyond a
 * property read.
 */
export function recordInboundFromBackground({
  kind,
  name,
  chars,
}: {
  kind: IInboundKind;
  name: string | undefined;
  chars: number;
}) {
  if (!isAccountSwitchDiagnosticsEnabled()) return;
  addInbound(inboundByKind, kind, chars);
  const named =
    name &&
    (inboundByName.has(`${kind}:${name}`) ||
      inboundByName.size < INBOUND_MAX_NAMES)
      ? name
      : 'others';
  addInbound(inboundByName, `${kind}:${named}`, chars);
}

function flushInboundCensus(windowMs: number) {
  if (inboundByKind.size === 0) {
    return;
  }
  const byName = [...inboundByName].toSorted(
    (left, right) => right[1].chars - left[1].chars,
  );
  const totalChars = byName.reduce((sum, [, t]) => sum + t.chars, 0);
  const totalCount = byName.reduce((sum, [, t]) => sum + t.count, 0);
  defaultLogger.app.perf.mainInboundCensus({
    windowMs: Math.round(windowMs),
    total: totalCount,
    // Legacy KB fields count UTF-16 code units, not encoded transport bytes.
    totalChars,
    totalKB: Math.round(totalChars / 1024),
    byKind: [...inboundByKind].map(([kind, totals]) => ({
      kind,
      count: totals.count,
      kb: Math.round(totals.chars / 1024),
    })),
    bySender: byName.slice(0, INBOUND_TOP).map(([sender, totals]) => ({
      sender,
      count: totals.count,
      kb: Math.round(totals.chars / 1024),
    })),
  });
  inboundByKind.clear();
  inboundByName.clear();
}

let healthTimer: ReturnType<typeof setInterval> | null = null;
let stopHealthVisibility: (() => void) | undefined;
let stopHealthFrames: (() => void) | undefined;

export function startRuntimeHealthCensus({
  sampleProcess,
  getExtra,
}: {
  sampleProcess?: () => Promise<IRuntimeHealthProcessSample>;
  getExtra?: () => Record<string, number | undefined>;
} = {}) {
  if (!isAccountSwitchDiagnosticsEnabled() || healthTimer) return;
  let last = perfNow();
  let windowStartedAt = last;
  let ticks = 0;
  let countersAtWindowStart = readHermesCounters();
  let inactiveStartedAt = getCurrentVisibilityState() ? undefined : last;
  let inactiveTotalMs = 0;
  let previousInactiveMs = 0;
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
  let stopped = false;
  const fpsSamplingAvailable =
    platformEnv.runtimeRole !== ERuntimeRole.Background &&
    typeof globalThis.requestAnimationFrame === 'function' &&
    typeof globalThis.cancelAnimationFrame === 'function' &&
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function';
  let fpsVisible = inactiveStartedAt === undefined;
  let fpsStartedAt = last;
  let fpsWallStartedAt = Date.now();
  let fpsFrames = 0;
  let fpsRaf: number | null = null;
  let fpsSamples: IRuntimeHealthFpsSample[] = [];
  let fpsDroppedWindowCount = 0;
  let fpsDroppedCoverageMs = 0;

  const flushFpsSample = (now: number, lifecycleInvalid = !fpsVisible) => {
    if (!fpsSamplingAvailable) return;
    const elapsed = now - fpsStartedAt;
    if (elapsed <= 0) return;
    const wallEndedAt = Date.now();
    if (fpsSamples.length < FPS_MAX_SAMPLES) {
      fpsSamples.push([
        fpsWallStartedAt,
        wallEndedAt,
        Math.round(elapsed * 1000) / 1000,
        fpsFrames,
        lifecycleInvalid ? 1 : 0,
      ]);
    } else {
      fpsDroppedWindowCount += 1;
      fpsDroppedCoverageMs += elapsed;
    }
    fpsStartedAt = now;
    fpsWallStartedAt = wallEndedAt;
    fpsFrames = 0;
  };
  const onFrame = () => {
    fpsRaf = null;
    if (stopped || !fpsVisible) return;
    fpsFrames += 1;
    fpsRaf = globalThis.requestAnimationFrame(onFrame);
  };
  const cancelFrame = () => {
    if (fpsRaf !== null) globalThis.cancelAnimationFrame(fpsRaf);
    fpsRaf = null;
  };
  if (fpsSamplingAvailable && fpsVisible) {
    fpsRaf = globalThis.requestAnimationFrame(onFrame);
  }
  stopHealthFrames = () => {
    stopped = true;
    cancelFrame();
    fpsSamples = [];
    fpsFrames = 0;
    fpsDroppedWindowCount = 0;
    fpsDroppedCoverageMs = 0;
  };

  stopHealthVisibility = onVisibilityStateChange((visible) => {
    if (stopped) return;
    const now = perfNow();
    if (visible !== fpsVisible) {
      // Never combine foreground frames with time spent suspended. Even a
      // short partial window touching the transition is explicitly invalid.
      flushFpsSample(now, true);
      fpsVisible = visible;
      cancelFrame();
      if (fpsSamplingAvailable && visible) {
        fpsRaf = globalThis.requestAnimationFrame(onFrame);
      }
    }
    if (visible && inactiveStartedAt !== undefined) {
      inactiveTotalMs += now - inactiveStartedAt;
      inactiveStartedAt = undefined;
    } else if (!visible && inactiveStartedAt === undefined) {
      inactiveStartedAt = now;
      suspendedCount += 1;
    }
  });

  const lowest = (currentMin: number | undefined, value: number | undefined) =>
    // The native sampler reports 0 until its first full window.
    value && (currentMin === undefined || value < currentMin)
      ? value
      : currentMin;

  const flushWindow = (now: number) => {
    // Seal a shorter tail at the census boundary instead of attributing it
    // to the next report. No extra timer or per-window log is needed.
    flushFpsSample(now);
    const counters = readHermesCounters();
    const before = countersAtWindowStart;
    const report: IRuntimeHealthReport = {
      windowMs: Math.round(now - windowStartedAt),
      windowEndedAt: Date.now(),
      blockCount,
      blockTotalMs: Math.round(blockTotalMs),
      blockMaxMs: Math.round(blockMaxMs),
      blockOver500,
      blockOver1000,
      suspendedCount,
      fpsSamplingAvailable: fpsSamplingAvailable ? 1 : 0,
      fpsNominalWindowMs: FPS_WINDOW_MS,
      fpsSamples,
      fpsSampleCount: fpsSamples.length,
      fpsValidSampleCount: fpsSamples.filter((sample) => sample[4] === 0)
        .length,
      fpsCoverageMs: fpsSamples.reduce((sum, sample) => sum + sample[2], 0),
      fpsValidCoverageMs: fpsSamples.reduce(
        (sum, sample) => sum + (sample[4] === 0 ? sample[2] : 0),
        0,
      ),
      fpsDroppedWindowCount,
      fpsDroppedCoverageMs,
      ...(counters
        ? {
            heapMB: toMB(counters.heapBytes),
            js_numGCs: counters.gcCount,
            js_gcTime: counters.gcTimeSeconds,
            js_totalAllocatedBytes: counters.totalAllocatedBytes,
            js_allocatedBytes: counters.liveBytes,
            js_heapSize: counters.heapBytes,
            js_externalBytes: counters.externalBytes,
            js_numYGCollections: counters.youngGCCount,
            js_numOGCollections: counters.oldGCCount,
            js_numCompactions: counters.compactionCount,
            js_avgGCTime: counters.gcAvgSeconds,
            js_maxGCTime: counters.gcMaxSeconds,
            // Lifetime maxima cannot be subtracted to get a window maximum.
            gcMaxLifetimeMs:
              counters.gcMaxSeconds === undefined
                ? undefined
                : counters.gcMaxSeconds * 1000,
            gcAvgLifetimeMs:
              counters.gcAvgSeconds === undefined
                ? undefined
                : counters.gcAvgSeconds * 1000,
            externalMB:
              counters.externalBytes === undefined
                ? undefined
                : toMB(counters.externalBytes),
            // Live bytes separates real retention from a heap that only
            // ratchets its capacity upward.
            ...(counters.liveBytes === undefined
              ? {}
              : { liveMB: toMB(counters.liveBytes) }),
            ...(counters.mallocBytes === undefined
              ? {}
              : { mallocMB: toMB(counters.mallocBytes) }),
            ...(before
              ? {
                  allocatedMB: toMB(
                    counters.totalAllocatedBytes - before.totalAllocatedBytes,
                  ),
                  gcCount: counters.gcCount - before.gcCount,
                  youngGCCount:
                    counters.youngGCCount === undefined ||
                    before.youngGCCount === undefined
                      ? undefined
                      : counters.youngGCCount - before.youngGCCount,
                  oldGCCount:
                    counters.oldGCCount === undefined ||
                    before.oldGCCount === undefined
                      ? undefined
                      : counters.oldGCCount - before.oldGCCount,
                  compactionCount:
                    counters.compactionCount === undefined ||
                    before.compactionCount === undefined
                      ? undefined
                      : counters.compactionCount - before.compactionCount,
                  allocationMBPerSec:
                    (counters.totalAllocatedBytes -
                      before.totalAllocatedBytes) /
                    (1024 * 1024) /
                    ((now - windowStartedAt) / 1000),
                  gcAvgMs:
                    counters.gcCount > before.gcCount
                      ? ((counters.gcTimeSeconds - before.gcTimeSeconds) *
                          1000) /
                        (counters.gcCount - before.gcCount)
                      : 0,
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
    flushInboundCensus(report.windowMs);

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
    fpsSamples = [];
    fpsDroppedWindowCount = 0;
    fpsDroppedCoverageMs = 0;
  };

  healthTimer = setInterval(() => {
    const now = perfNow();
    if (fpsVisible && now - fpsStartedAt >= FPS_WINDOW_MS) {
      flushFpsSample(now);
    }
    const inactiveMs =
      inactiveTotalMs +
      (inactiveStartedAt === undefined ? 0 : now - inactiveStartedAt);
    const inactiveDelta = inactiveMs - previousInactiveMs;
    previousInactiveMs = inactiveMs;
    const drift = now - last - inactiveDelta - HEALTH_TICK_MS;
    last = now;
    // Only observed lifecycle inactivity is excluded. A long foreground
    // stall must not disappear merely because it exceeded five seconds.
    windowStartedAt += inactiveDelta;
    if (drift >= HEALTH_BLOCK_MS) {
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
          if (stopped) return;
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
  stopHealthFrames?.();
  stopHealthFrames = undefined;
  stopHealthVisibility?.();
  stopHealthVisibility = undefined;
  clearInterval(healthTimer);
  healthTimer = null;
}
