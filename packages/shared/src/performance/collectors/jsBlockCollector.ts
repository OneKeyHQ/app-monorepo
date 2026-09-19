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
  // Optional: not every Hermes build reports these.
  liveBytes?: number;
  mallocBytes?: number;
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
  const liveBytes = stats?.js_allocatedBytes;
  const mallocBytes = stats?.js_mallocSizeEstimate;
  return {
    gcCount,
    gcTimeSeconds,
    heapBytes,
    totalAllocatedBytes,
    ...(typeof liveBytes === 'number' ? { liveBytes } : {}),
    ...(typeof mallocBytes === 'number' ? { mallocBytes } : {}),
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
  addInbound(inboundByKind, kind, chars);
  const named =
    name && inboundByName.size < INBOUND_MAX_NAMES ? name : 'others';
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

// ---- DIAGNOSTIC BRANCH ONLY: React / weak-ref / timer census ---------------
//
// Reads the counters the mobile entry installs on `__ONEKEY_DIAG_CENSUS__`.
// A commit is only counted when it happens; at most one commit per
// DIAG_SAMPLE_GAP_MS is walked to see which components rendered, following
// only the paths React marked as having performed work. The full tree is
// walked once per window, to count what is mounted.

const DIAG_SAMPLE_GAP_MS = 200;
const DIAG_TOP = 12;
const DIAG_MAX_WALK = 400_000;
const PERFORMED_WORK = 1;
// FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemo.
const COMPOSITE_TAGS = new Set([0, 1, 11, 14, 15]);

type IDiagFiber = {
  tag: number;
  flags: number;
  subtreeFlags: number;
  type: unknown;
  child: IDiagFiber | null;
  sibling: IDiagFiber | null;
};

type IDiagCensus = {
  commits: number;
  unmounts: number;
  roots: Set<{ current: IDiagFiber | null }>;
  onCommit?: (root: { current: IDiagFiber | null }) => void;
  weakMapSets: number;
  weakMapNewKeys: number;
  weakSetAdds: number;
  weakRefs: number;
  finalizers: number;
  intervalsLive: Set<unknown>;
  intervalsCreated: number;
  timeoutsScheduled: number;
};

function getDiagCensus(): IDiagCensus | undefined {
  return (globalThis as { __ONEKEY_DIAG_CENSUS__?: IDiagCensus })
    .__ONEKEY_DIAG_CENSUS__;
}

function nameOf(candidate: unknown): string | undefined {
  if (typeof candidate === 'function') {
    const fn = candidate as { displayName?: string; name?: string };
    return fn.displayName || fn.name || undefined;
  }
  return undefined;
}

function diagFiberName(fiber: IDiagFiber): string {
  const { type } = fiber;
  const direct = nameOf(type);
  if (direct) return direct;
  if (type && typeof type === 'object') {
    const wrapper = type as {
      displayName?: string;
      render?: unknown;
      type?: unknown;
    };
    if (wrapper.displayName) return wrapper.displayName;
    const inner = wrapper.render ?? wrapper.type;
    const innerName = nameOf(inner);
    if (innerName) return innerName;
    if (inner && typeof inner === 'object') {
      const nested = inner as { render?: unknown; type?: unknown };
      const nestedName = nameOf(nested.render ?? nested.type);
      if (nestedName) return nestedName;
    }
  }
  return '(anonymous)';
}

let diagSampledCommits = 0;
let diagRenderedFibers = 0;
let diagLastSampleAt = 0;
const diagRenderedByName = new Map<string, number>();

function sampleRenderedFibers(root: { current: IDiagFiber | null }) {
  const now = perfNow();
  if (now - diagLastSampleAt < DIAG_SAMPLE_GAP_MS) {
    return;
  }
  diagLastSampleAt = now;
  diagSampledCommits += 1;
  const stack: Array<IDiagFiber | null> = [root.current];
  let visited = 0;
  while (stack.length > 0 && visited < DIAG_MAX_WALK) {
    const fiber = stack.pop();
    if (fiber) {
      visited += 1;
      if (
        (fiber.flags & PERFORMED_WORK) !== 0 &&
        COMPOSITE_TAGS.has(fiber.tag)
      ) {
        diagRenderedFibers += 1;
        const name = diagFiberName(fiber);
        diagRenderedByName.set(name, (diagRenderedByName.get(name) ?? 0) + 1);
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      // A subtree React bailed out of keeps stale flags; its ancestor's
      // subtreeFlags says nothing below rendered, so never descend into it.
      if (fiber.child && (fiber.subtreeFlags & PERFORMED_WORK) !== 0) {
        stack.push(fiber.child);
      }
    }
  }
}

function countMountedFibers(census: IDiagCensus) {
  let total = 0;
  let composite = 0;
  let liveRoots = 0;
  for (const root of census.roots) {
    if (!root.current?.child) {
      // An unmounted root keeps no tree; forget it.
      census.roots.delete(root);
    } else {
      liveRoots += 1;
      const stack: Array<IDiagFiber | null> = [root.current];
      while (stack.length > 0 && total < DIAG_MAX_WALK) {
        const fiber = stack.pop();
        if (fiber) {
          total += 1;
          if (COMPOSITE_TAGS.has(fiber.tag)) composite += 1;
          if (fiber.sibling) stack.push(fiber.sibling);
          if (fiber.child) stack.push(fiber.child);
        }
      }
    }
  }
  return { total, composite, liveRoots };
}

function flushDiagCensus(
  windowMs: number,
  extra: Record<string, number | undefined> | undefined,
) {
  const census = getDiagCensus();
  if (!census) {
    return;
  }
  const walkStartedAt = perfNow();
  const mounted = countMountedFibers(census);
  const walkMs = Math.round(perfNow() - walkStartedAt);
  defaultLogger.app.perf.diagCensus({
    windowMs: Math.round(windowMs),
    accountSwitches: extra?.accountSwitches,
    commits: census.commits,
    sampledCommits: diagSampledCommits,
    renderedFibersSampled: diagRenderedFibers,
    unmounts: census.unmounts,
    mountedFibers: mounted.total,
    mountedComponents: mounted.composite,
    roots: mounted.liveRoots,
    walkMs,
    weakMapSets: census.weakMapSets,
    weakMapNewKeys: census.weakMapNewKeys,
    weakSetAdds: census.weakSetAdds,
    weakRefs: census.weakRefs,
    finalizers: census.finalizers,
    intervalsLive: census.intervalsLive.size,
    intervalsCreated: census.intervalsCreated,
    timeoutsScheduled: census.timeoutsScheduled,
    topRendered: [...diagRenderedByName]
      .toSorted((left, right) => right[1] - left[1])
      .slice(0, DIAG_TOP)
      .map(([name, count]) => ({ name, count })),
  });
  census.commits = 0;
  census.unmounts = 0;
  census.weakMapSets = 0;
  census.weakMapNewKeys = 0;
  census.weakSetAdds = 0;
  census.weakRefs = 0;
  census.finalizers = 0;
  census.intervalsCreated = 0;
  census.timeoutsScheduled = 0;
  diagSampledCommits = 0;
  diagRenderedFibers = 0;
  diagRenderedByName.clear();
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
  const diagCensus = getDiagCensus();
  if (diagCensus) {
    diagCensus.onCommit = sampleRenderedFibers;
  }
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
    flushDiagCensus(report.windowMs, report);

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
