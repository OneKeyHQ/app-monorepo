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
  weakSites?: Map<string, number>;
  weakSampled?: number;
  serializerSites?: Map<string, { count: number; depthSum: number }>;
  serializerShapes?: Map<string, number>;
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

let diagRankingTick = 0;
// Every 4 windows = every 2 minutes; the first window emits too.
const DIAG_RANKING_EVERY_WINDOWS = 4;
let diagSampledCommits = 0;
let diagRenderedFibers = 0;
let diagLastSampleAt = 0;
const diagRenderedByName = new Map<string, number>();
// Renders charged to the component that started them: the topmost component
// that rendered in each re-rendered subtree, labelled with its nearest named
// ancestor when it is anonymous itself. Leaf primitives dominate the plain
// per-name count and say nothing about who caused the work.
const diagRenderedByRoot = new Map<string, number>();
// The same, over the whole session: a log export only keeps the last minutes.
const diagRenderedByRootTotal = new Map<string, number>();
let diagSampledCommitsTotal = 0;
const DIAG_MAX_ROOT_LABELS = 400;

function bumpBounded(target: Map<string, number>, key: string) {
  if (target.size < DIAG_MAX_ROOT_LABELS || target.has(key)) {
    target.set(key, (target.get(key) ?? 0) + 1);
  }
}

type IDiagWalkFrame = {
  fiber: IDiagFiber;
  lastNamed: string;
  rootLabel: string | undefined;
};

function sampleRenderedFibers(root: { current: IDiagFiber | null }) {
  const now = perfNow();
  if (now - diagLastSampleAt < DIAG_SAMPLE_GAP_MS || !root.current) {
    return;
  }
  diagLastSampleAt = now;
  diagSampledCommits += 1;
  diagSampledCommitsTotal += 1;
  const stack: IDiagWalkFrame[] = [
    { fiber: root.current, lastNamed: '(root)', rootLabel: undefined },
  ];
  let visited = 0;
  while (stack.length > 0 && visited < DIAG_MAX_WALK) {
    const frame = stack.pop();
    if (frame) {
      const { fiber } = frame;
      visited += 1;
      let { lastNamed, rootLabel } = frame;
      if (COMPOSITE_TAGS.has(fiber.tag)) {
        const name = diagFiberName(fiber);
        if ((fiber.flags & PERFORMED_WORK) !== 0) {
          diagRenderedFibers += 1;
          diagRenderedByName.set(name, (diagRenderedByName.get(name) ?? 0) + 1);
          if (rootLabel === undefined) {
            rootLabel =
              name === '(anonymous)' ? `${lastNamed} > (anonymous)` : name;
          }
          bumpBounded(diagRenderedByRoot, rootLabel);
          bumpBounded(diagRenderedByRootTotal, rootLabel);
        }
        if (name !== '(anonymous)') {
          lastNamed = name;
        }
      }
      // A sibling shares the parent's context, not this fiber's.
      if (fiber.sibling) {
        stack.push({
          fiber: fiber.sibling,
          lastNamed: frame.lastNamed,
          rootLabel: frame.rootLabel,
        });
      }
      // A subtree React bailed out of keeps stale flags; its ancestor's
      // subtreeFlags says nothing below rendered, so never descend into it.
      if (fiber.child && (fiber.subtreeFlags & PERFORMED_WORK) !== 0) {
        stack.push({ fiber: fiber.child, lastNamed, rootLabel });
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
    topRenderRoots: [...diagRenderedByRoot]
      .toSorted((left, right) => right[1] - left[1])
      .slice(0, DIAG_TOP)
      .map(([name, count]) => ({ name, count })),
    sampledCommitsTotal: diagSampledCommitsTotal,
    // Each sample stands for 256 new WeakMap keys, cumulative since launch.
    weakSampled: census.weakSampled,
  });

  // The native logger cuts a line at about 3000 characters, which silently
  // broke the JSON of the combined line. Cumulative rankings go out as one
  // short line per entry instead, a few times a session.
  diagRankingTick += 1;
  if (diagRankingTick % DIAG_RANKING_EVERY_WINDOWS === 1) {
    const emit = (list: string, rows: Record<string, unknown>[]) => {
      rows.forEach((row, rank) => {
        defaultLogger.app.perf.diagRanking({ list, rank: rank + 1, ...row });
      });
    };
    const clip = (text: string) => text.slice(0, 400);
    emit(
      'renderRootsTotal',
      [...diagRenderedByRootTotal]
        .toSorted((left, right) => right[1] - left[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name: clip(name), count })),
    );
    emit(
      'weakSites',
      [...(census.weakSites ?? [])]
        .toSorted((left, right) => right[1] - left[1])
        .slice(0, 15)
        .map(([site, count]) => ({ site: clip(site), keys: count * 256 })),
    );
    emit(
      'serializerCallers',
      [...(census.serializerSites ?? [])]
        .toSorted((left, right) => right[1].count - left[1].count)
        .slice(0, 15)
        .map(([caller, entry]) => ({
          caller: clip(caller),
          keys: entry.count * 256,
          avgDepth: Math.round((entry.depthSum / entry.count) * 10) / 10,
        })),
    );
    emit(
      'serializerShapes',
      [...(census.serializerShapes ?? [])]
        .toSorted((left, right) => right[1] - left[1])
        .slice(0, 25)
        .map(([shape, count]) => ({ shape: clip(shape), keys: count * 256 })),
    );
  }
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
  diagRenderedByRoot.clear();
}

// ---- DIAGNOSTIC BRANCH ONLY: controlled GC experiment -----------------------
//
// What makes one young-generation collection cost more? Each phase changes one
// thing about the heap, then allocates the same amount of short-lived garbage
// and reads what each collection cost. Garbage that dies at once leaves a
// collection almost nothing to copy, so the figure is its fixed overhead —
// the part that grows over a session in the UI runtime.

const EXPERIMENT_CHURN_MB = 96;
const EXPERIMENT_PAUSE_MS = 400;

function churnShortLivedGarbage(megabytes: number) {
  // ~64 bytes per iteration on Hermes: a small object and a small array.
  const iterations = Math.round((megabytes * 1024 * 1024) / 64);
  let sink = 0;
  for (let i = 0; i < iterations; i += 1) {
    const garbage = { a: i, b: [i, i + 1] };
    sink += garbage.b.length;
  }
  return sink;
}

function measureCollectionCost(phase: string, buildMs: number) {
  const before = readHermesCounters();
  const startedAt = perfNow();
  churnShortLivedGarbage(EXPERIMENT_CHURN_MB);
  const churnMs = perfNow() - startedAt;
  const after = readHermesCounters();
  if (!before || !after) {
    return { phase };
  }
  const gcs = after.gcCount - before.gcCount;
  const gcMs = (after.gcTimeSeconds - before.gcTimeSeconds) * 1000;
  return {
    phase,
    buildMs: Math.round(buildMs),
    churnMs: Math.round(churnMs),
    gcs,
    gcMs: Math.round(gcMs),
    msPerGc: gcs > 0 ? Math.round((gcMs / gcs) * 100) / 100 : 0,
    mbPerGc:
      gcs > 0
        ? Math.round(
            ((after.totalAllocatedBytes - before.totalAllocatedBytes) /
              (1024 * 1024) /
              gcs) *
              100,
          ) / 100
        : 0,
    heapMB: toMB(after.heapBytes),
  };
}

const experimentPause = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, EXPERIMENT_PAUSE_MS);
  });

export async function runDiagGcExperiment() {
  if (!readHermesCounters()) {
    return;
  }
  const results: Record<string, unknown>[] = [];
  const timed = <T>(build: () => T): [T, number] => {
    const startedAt = perfNow();
    const value = build();
    return [value, perfNow() - startedAt];
  };

  results.push(measureCollectionCost('baseline', 0));
  await experimentPause();

  // A large population of ordinary long-lived objects, no weak references.
  const plainBuild = timed(() => {
    const kept: { id: number }[] = [];
    for (let i = 0; i < 1_000_000; i += 1) kept.push({ id: i });
    return kept;
  });
  let plain = plainBuild[0];
  results.push(measureCollectionCost('1M plain objects kept', plainBuild[1]));
  plain = [];
  await experimentPause();
  results.push(measureCollectionCost('plain objects released', 0));
  await experimentPause();

  // Weak-map entries whose keys stay alive, at two sizes to see the slope.
  for (const count of [300_000, 1_000_000]) {
    const weakBuild = timed(() => {
      const map = new WeakMap<object, number>();
      const keys: object[] = [];
      for (let i = 0; i < count; i += 1) {
        const key = { id: i };
        keys.push(key);
        map.set(key, i);
      }
      return { map, keys };
    });
    let weak = weakBuild[0];
    results.push(
      measureCollectionCost(
        `${count / 1000}k weak-map entries alive`,
        weakBuild[1],
      ),
    );
    weak = { map: new WeakMap(), keys: [] };
    await experimentPause();
    // Does the cost go away once every key is dead?
    results.push(
      measureCollectionCost(`${count / 1000}k weak-map entries released`, 0),
    );
    await experimentPause();
    results.push(
      measureCollectionCost(`${count / 1000}k released, second pass`, 0),
    );
    await experimentPause();
    // Keep the bindings referenced so nothing is optimized away early.
    if (weak.keys.length + plain.length < 0) return;
  }

  // Can a forced full collection undo it? Production Hermes usually strips
  // the binding; when it is there, this is the cheapest possible mitigation.
  const hermesGc = (
    globalThis as { HermesInternal?: { gc?: () => void }; gc?: () => void }
  ).HermesInternal?.gc;
  const globalGc = (globalThis as { gc?: () => void }).gc;
  const forceGc = typeof hermesGc === 'function' ? hermesGc : globalGc;
  if (typeof forceGc === 'function') {
    const [, fullGcMs] = timed(() => {
      forceGc();
      return 0;
    });
    results.push(measureCollectionCost('after a forced full GC', fullGcMs));
    await experimentPause();
    results.push(measureCollectionCost('after a forced full GC, again', 0));
    await experimentPause();
  } else {
    results.push({ phase: 'forced full GC unavailable in this build' });
  }

  // Weak-map entries that die young, as render-time caches produce them.
  const [, shortLivedMs] = timed(() => {
    const map = new WeakMap<object, number>();
    for (let i = 0; i < 1_000_000; i += 1) map.set({ id: i }, i);
    return map;
  });
  results.push(
    measureCollectionCost('after 1M short-lived weak-map keys', shortLivedMs),
  );

  const report = {
    runtime:
      (globalThis as { __ONEKEY_RUNTIME_KIND__?: string })
        .__ONEKEY_RUNTIME_KIND__ ?? 'unknown',
    churnMB: EXPERIMENT_CHURN_MB,
    results,
  };
  // One short line per phase as well: the combined line is close to the
  // length at which the native logger truncates.
  const emitExperiment = (repeated: boolean) => {
    defaultLogger.app.perf.diagGcExperiment({ ...report, repeated });
    results.forEach((row, index) => {
      defaultLogger.app.perf.diagRanking({
        list: 'gcExperiment',
        rank: index + 1,
        runtime: report.runtime,
        ...row,
      });
    });
  };
  emitExperiment(false);
  // The log rotates; an export may only hold the last minutes of a session.
  // Repeat the result so it is in whichever part gets exported.
  setInterval(() => {
    emitExperiment(true);
  }, 60_000);
}

// ---- GC relief ---------------------------------------------------------------
//
// On this engine every young-generation collection pays for the weak-map
// entries the runtime has ever created, and the price does not fall when they
// die: measured in isolation, a million entries make a collection ~16x more
// expensive, for good. Reanimated's serializer and Tamagui's style resolution
// create about that many in five minutes of active use, which is why a session
// gets slower the longer it runs. A full collection releases the dead entries'
// slots and brought the cost down by about half in the same measurement.
//
// A full collection stops the runtime for a few hundred milliseconds, so it
// only runs when collections are already expensive, no more often than every
// two minutes, and at a moment the event loop has been quiet for a second, or
// when the app goes to the background where nobody can see the pause.
const GC_RELIEF_ENABLED = true;
const GC_RELIEF_MS_PER_GC = 8;
const GC_RELIEF_MIN_GCS = 30;
const GC_RELIEF_MIN_GAP_MS = 120_000;
const GC_RELIEF_BACKGROUND_MS_PER_GC = 4;
const GC_RELIEF_QUIET_TICKS = 10;
const GC_RELIEF_QUIET_DRIFT_MS = 50;
const GC_RELIEF_MAX_WAIT_MS = 20_000;

let gcReliefRunner: ((reason: string) => void) | undefined;

/**
 * Ask for a full collection now, from a moment the caller knows is invisible
 * to the user (the app going to the background). Does nothing unless the census
 * is running and collections have become expensive.
 */
export function requestRuntimeGcRelief(reason: string) {
  gcReliefRunner?.(reason);
}

let healthTimer: ReturnType<typeof setInterval> | null = null;

export function startRuntimeHealthCensus({
  sampleProcess,
  getExtra,
  forceFullGc,
}: {
  sampleProcess?: () => Promise<IRuntimeHealthProcessSample>;
  getExtra?: () => Record<string, number | undefined>;
  // Returns false where the engine exposes no such binding.
  forceFullGc?: () => boolean;
} = {}) {
  if (healthTimer) return;
  let lastMsPerGc = 0;
  let lastReliefAt = -GC_RELIEF_MIN_GAP_MS;
  let reliefPendingSince: number | undefined;
  let quietTicks = 0;
  const runRelief = (reason: string, now: number) => {
    reliefPendingSince = undefined;
    if (!forceFullGc) return;
    const before = readHermesCounters();
    const startedAt = perfNow();
    const ran = forceFullGc();
    const fullGcMs = Math.round(perfNow() - startedAt);
    lastReliefAt = now;
    if (!ran) return;
    const after = readHermesCounters();
    defaultLogger.app.perf.runtimeGcRelief({
      reason,
      msPerGcBefore: Math.round(lastMsPerGc * 10) / 10,
      fullGcMs,
      heapMBBefore: before ? toMB(before.heapBytes) : undefined,
      heapMBAfter: after ? toMB(after.heapBytes) : undefined,
      liveMBBefore:
        before?.liveBytes === undefined ? undefined : toMB(before.liveBytes),
      liveMBAfter:
        after?.liveBytes === undefined ? undefined : toMB(after.liveBytes),
    });
  };
  if (GC_RELIEF_ENABLED && forceFullGc) {
    gcReliefRunner = (reason: string) => {
      const now = perfNow();
      if (
        lastMsPerGc >= GC_RELIEF_BACKGROUND_MS_PER_GC &&
        now - lastReliefAt >= GC_RELIEF_MIN_GAP_MS
      ) {
        runRelief(reason, now);
      }
    };
  }
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
    if (report.gcCount && report.gcCount >= GC_RELIEF_MIN_GCS) {
      lastMsPerGc = (report.gcMs ?? 0) / report.gcCount;
      if (
        gcReliefRunner &&
        reliefPendingSince === undefined &&
        lastMsPerGc >= GC_RELIEF_MS_PER_GC &&
        now - lastReliefAt >= GC_RELIEF_MIN_GAP_MS
      ) {
        reliefPendingSince = now;
      }
    }
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
    quietTicks = drift < GC_RELIEF_QUIET_DRIFT_MS ? quietTicks + 1 : 0;
    if (reliefPendingSince !== undefined) {
      if (quietTicks >= GC_RELIEF_QUIET_TICKS) {
        runRelief('expensive-collections', now);
        // The pause it just caused is its own, not a block to report.
        last = perfNow();
        quietTicks = 0;
        return;
      }
      if (now - reliefPendingSince >= GC_RELIEF_MAX_WAIT_MS) {
        reliefPendingSince = undefined;
      }
    }
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
  gcReliefRunner = undefined;
}
