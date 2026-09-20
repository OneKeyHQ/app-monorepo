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
//
// Every commit is walked along the paths React marked as having performed
// work, so the render counts are exact and two runs of the same script can be
// compared. A rendered component counts as a mount when its fiber has no
// alternate and as an update otherwise: opening a page and re-rendering one
// that is already there are different problems with different fixes.
//   - updates are charged to the topmost component that re-rendered, and to
//     the nearest screen (the closest fiber holding a `route` prop), which is
//     what shows a page working while another one is on screen;
//   - mounts are charged to the screen being mounted, or, for something that
//     mounts inside a screen already there, to that screen and the topmost
//     mounted component.
// The walk keeps its stack in parallel arrays, so it allocates nothing per
// fiber: this build measures allocation and must not add to it.

const DIAG_WINDOW_TOP = 8;
const DIAG_MAX_WALK = 400_000;
// Above this share of a window the remaining commits are only counted, and
// the line says so: totals from such a window are a lower bound.
const DIAG_WALK_BUDGET_RATIO = 0.1;
const PERFORMED_WORK = 1;
// FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemo.
const COMPOSITE_TAGS = new Set([0, 1, 11, 14, 15]);

type IDiagFiber = {
  tag: number;
  flags: number;
  subtreeFlags: number;
  type: unknown;
  alternate: IDiagFiber | null;
  memoizedProps?: unknown;
  child: IDiagFiber | null;
  sibling: IDiagFiber | null;
};

type IDiagRoot = { current: IDiagFiber | null };

type IDiagCensus = {
  commits: number;
  unmounts: number;
  roots: Set<IDiagRoot>;
  onCommit?: (root: IDiagRoot) => void;
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

function diagRouteName(fiber: IDiagFiber): string | undefined {
  const props = fiber.memoizedProps as
    | { route?: { name?: unknown } }
    | null
    | undefined;
  const name = props?.route?.name;
  return typeof name === 'string' ? name : undefined;
}

const DIAG_MAX_LABELS = 400;

function bumpBounded(target: Map<string, number>, key: string) {
  if (target.size < DIAG_MAX_LABELS || target.has(key)) {
    target.set(key, (target.get(key) ?? 0) + 1);
  }
}

const DIAG_LISTS = [
  'rendered',
  'updateRoots',
  'updateRoutes',
  'mountRoots',
] as const;
type IDiagList = (typeof DIAG_LISTS)[number];

function createDiagTables(): Record<IDiagList, Map<string, number>> {
  return {
    rendered: new Map(),
    updateRoots: new Map(),
    updateRoutes: new Map(),
    mountRoots: new Map(),
  };
}

const diagWindow = createDiagTables();
// The same over the whole session: a log export only keeps the last minutes.
const diagSession = createDiagTables();
const diagTotals = {
  commits: 0,
  mountRenders: 0,
  updateRenders: 0,
  unmounts: 0,
  weakMapNewKeys: 0,
};
let diagWindowSeq = 0;
let diagMountRenders = 0;
let diagUpdateRenders = 0;
let diagCommitsWalked = 0;
let diagCommitsSkipped = 0;
let diagWalkMs = 0;
let diagWalkBudgetMs = HEALTH_WINDOW_MS * DIAG_WALK_BUDGET_RATIO;

const NO_SCREEN = '(no screen)';
const walkFibers: Array<IDiagFiber | null> = [];
const walkNamed: string[] = [];
const walkUpdateRoots: Array<string | undefined> = [];
const walkMountRoots: Array<string | undefined> = [];
const walkRoutes: string[] = [];

function walkCommittedFibers(root: IDiagRoot) {
  if (!root.current) return;
  if (diagWalkMs >= diagWalkBudgetMs) {
    diagCommitsSkipped += 1;
    return;
  }
  const startedAt = perfNow();
  diagCommitsWalked += 1;
  let depth = 0;
  walkFibers[0] = root.current;
  walkNamed[0] = '(root)';
  walkUpdateRoots[0] = undefined;
  walkMountRoots[0] = undefined;
  walkRoutes[0] = NO_SCREEN;
  depth = 1;
  let visited = 0;
  while (depth > 0 && visited < DIAG_MAX_WALK) {
    depth -= 1;
    const fiber = walkFibers[depth];
    walkFibers[depth] = null;
    if (fiber) {
      visited += 1;
      const inheritedNamed = walkNamed[depth];
      const inheritedUpdateRoot = walkUpdateRoots[depth];
      const inheritedMountRoot = walkMountRoots[depth];
      const inheritedRoute = walkRoutes[depth];
      let lastNamed = inheritedNamed;
      let updateRoot = inheritedUpdateRoot;
      let mountRoot = inheritedMountRoot;
      let route = inheritedRoute;
      if (COMPOSITE_TAGS.has(fiber.tag)) {
        const name = diagFiberName(fiber);
        const routeName = diagRouteName(fiber);
        if (routeName !== undefined) {
          route = routeName;
        }
        if ((fiber.flags & PERFORMED_WORK) !== 0) {
          bumpBounded(diagWindow.rendered, name);
          if (fiber.alternate === null) {
            diagMountRenders += 1;
            if (routeName !== undefined) {
              mountRoot = `screen:${routeName}`;
            } else if (mountRoot === undefined) {
              // Something mounting inside a screen that is already there.
              mountRoot = `${route} » ${
                name === '(anonymous)' ? `${lastNamed} > (anonymous)` : name
              }`;
            }
            bumpBounded(diagWindow.mountRoots, mountRoot);
            bumpBounded(diagSession.mountRoots, mountRoot);
          } else {
            diagUpdateRenders += 1;
            if (updateRoot === undefined) {
              updateRoot =
                name === '(anonymous)' ? `${lastNamed} > (anonymous)` : name;
            }
            bumpBounded(diagWindow.updateRoots, updateRoot);
            bumpBounded(diagSession.updateRoots, updateRoot);
            bumpBounded(diagWindow.updateRoutes, route);
            bumpBounded(diagSession.updateRoutes, route);
          }
        }
        if (name !== '(anonymous)') {
          lastNamed = name;
        }
      }
      // A sibling shares the parent's context, not this fiber's.
      if (fiber.sibling) {
        walkFibers[depth] = fiber.sibling;
        walkNamed[depth] = inheritedNamed;
        walkUpdateRoots[depth] = inheritedUpdateRoot;
        walkMountRoots[depth] = inheritedMountRoot;
        walkRoutes[depth] = inheritedRoute;
        depth += 1;
      }
      // A subtree React bailed out of keeps stale flags; its ancestor's
      // subtreeFlags says nothing below rendered, so never descend into it.
      if (fiber.child && (fiber.subtreeFlags & PERFORMED_WORK) !== 0) {
        walkFibers[depth] = fiber.child;
        walkNamed[depth] = lastNamed;
        walkUpdateRoots[depth] = updateRoot;
        walkMountRoots[depth] = mountRoot;
        walkRoutes[depth] = route;
        depth += 1;
      }
    }
  }
  // Whatever the cap left on the stack must not keep fibers alive.
  while (depth > 0) {
    depth -= 1;
    walkFibers[depth] = null;
  }
  diagWalkMs += perfNow() - startedAt;
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

function topOf(table: Map<string, number>, limit: number) {
  return [...table]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, limit);
}

// Every 4 windows = every 2 minutes; the first window emits too.
const DIAG_RANKING_EVERY_WINDOWS = 4;

function flushDiagCensus(
  windowMs: number,
  extra: Record<string, number | undefined> | undefined,
) {
  const census = getDiagCensus();
  if (!census) {
    return;
  }
  diagWindowSeq += 1;
  const treeWalkStartedAt = perfNow();
  const mounted = countMountedFibers(census);
  const treeWalkMs = Math.round(perfNow() - treeWalkStartedAt);
  diagTotals.commits += census.commits;
  diagTotals.mountRenders += diagMountRenders;
  diagTotals.updateRenders += diagUpdateRenders;
  diagTotals.unmounts += census.unmounts;
  diagTotals.weakMapNewKeys += census.weakMapNewKeys;
  defaultLogger.app.perf.diagCensus({
    window: diagWindowSeq,
    windowMs: Math.round(windowMs),
    accountSwitches: extra?.accountSwitches,
    commits: census.commits,
    commitsWalked: diagCommitsWalked,
    // Not zero means the walk ran out of budget: counts are a lower bound.
    commitsSkipped: diagCommitsSkipped,
    mountRenders: diagMountRenders,
    updateRenders: diagUpdateRenders,
    unmounts: census.unmounts,
    mountedFibers: mounted.total,
    mountedComponents: mounted.composite,
    roots: mounted.liveRoots,
    walkMs: Math.round(diagWalkMs),
    treeWalkMs,
    weakMapSets: census.weakMapSets,
    weakMapNewKeys: census.weakMapNewKeys,
    weakSetAdds: census.weakSetAdds,
    weakRefs: census.weakRefs,
    finalizers: census.finalizers,
    intervalsLive: census.intervalsLive.size,
    intervalsCreated: census.intervalsCreated,
    timeoutsScheduled: census.timeoutsScheduled,
    // Each sample stands for 256 new WeakMap keys, cumulative since launch.
    weakSampled: census.weakSampled,
    // Cumulative since launch: what two runs of one script are compared on.
    totalCommits: diagTotals.commits,
    totalMountRenders: diagTotals.mountRenders,
    totalUpdateRenders: diagTotals.updateRenders,
    totalUnmounts: diagTotals.unmounts,
    totalWeakMapNewKeys: diagTotals.weakMapNewKeys,
  });

  // The native logger cuts a line at about 3000 characters, which silently
  // breaks the JSON of a combined line, so every ranking goes out as one
  // short line per entry.
  const clip = (text: string) => text.slice(0, 400);
  const emit = (list: string, rows: Record<string, unknown>[]) => {
    rows.forEach((row, rank) => {
      defaultLogger.app.perf.diagRanking({
        window: diagWindowSeq,
        list,
        rank: rank + 1,
        ...row,
      });
    });
  };
  DIAG_LISTS.forEach((list) => {
    emit(
      list,
      topOf(diagWindow[list], DIAG_WINDOW_TOP).map(([name, count]) => ({
        name: clip(name),
        count,
      })),
    );
  });
  if (diagWindowSeq % DIAG_RANKING_EVERY_WINDOWS === 1) {
    DIAG_LISTS.forEach((list) => {
      if (list !== 'rendered') {
        emit(
          `${list}Total`,
          topOf(diagSession[list], 20).map(([name, count]) => ({
            name: clip(name),
            count,
          })),
        );
      }
    });
    emit(
      'weakSites',
      topOf(census.weakSites ?? new Map<string, number>(), 15).map(
        ([site, count]) => ({ site: clip(site), keys: count * 256 }),
      ),
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
      topOf(census.serializerShapes ?? new Map<string, number>(), 25).map(
        ([shape, count]) => ({ shape: clip(shape), keys: count * 256 }),
      ),
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
  diagMountRenders = 0;
  diagUpdateRenders = 0;
  diagCommitsWalked = 0;
  diagCommitsSkipped = 0;
  diagWalkMs = 0;
  diagWalkBudgetMs = HEALTH_WINDOW_MS * DIAG_WALK_BUDGET_RATIO;
  DIAG_LISTS.forEach((list) => diagWindow[list].clear());
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
    diagCensus.onCommit = walkCommittedFibers;
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
  const diagCensus = getDiagCensus();
  if (diagCensus) {
    diagCensus.onCommit = undefined;
  }
}
