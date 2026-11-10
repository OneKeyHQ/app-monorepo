/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, no-underscore-dangle */

// Single opt-in flag for full startup profiling.
//
// Enabled by any of:
//   1. `globalThis.__ONEKEY_STARTUP_PROFILE__ === true` — set by Metro prologue
//      when `ONEKEY_STARTUP_PROFILE=1` was exported at bundle time.
//   2. `process.env.ONEKEY_STARTUP_PROFILE === '1'` — the same env var, if
//      Babel/Metro replaces `process.env.*` at bundle time.
//
// When OFF, every exported entry point here is a single `if (enabled) return;`
// — zero runtime overhead in the default path.
//
// When ON, we install a monkey-patch on Metro's `__r` (module require)
// instead of `__d` (define). Reason: by the time our JS code can run, all
// `__d(factory, id)` calls have already registered *unwrapped* factories.
// `__r(id)` is what invokes those factories lazily — wrapping it captures
// every first-time module load no matter when we install the patch.
//
// We track both inclusive and self (exclusive) time. Self-time is the more
// actionable signal: it says "this module's own factory body took Xms after
// subtracting all the time spent in modules it required."

const GLOBAL_FLAG_KEY = '__ONEKEY_STARTUP_PROFILE__';
const GLOBAL_STATS_KEY = '__ONEKEY_STARTUP_PROFILE_STATS__';
const FUNCTION_TRACE_FLAG_KEY = '__ONEKEY_FUNCTION_TRACE__';
const FUNCTION_TRACE_START_KEY = '__onekeyFunctionTraceStart';
const FUNCTION_TRACE_END_KEY = '__onekeyFunctionTraceEnd';

type IModStat = {
  id: string | number;
  selfMs: number;
  totalMs: number;
};

type IFunctionTraceMeta = {
  name: string;
  file: string;
  line?: number;
};

type IFunctionTraceEntry = {
  id: number;
  start: number;
  meta: IFunctionTraceMeta;
};

// The instrumentation cannot hold a per-call variable (react-native-worklets
// would capture it as a worklet closure variable), so it passes an equal meta
// object to both hooks and the open calls are tracked here instead.
const functionTraceOpenCalls: IFunctionTraceEntry[] = [];
// A function that never returns (a generator left suspended) never runs its
// `finally`, so cap the list rather than let it grow for the whole session.
const FUNCTION_TRACE_MAX_OPEN_CALLS = 20_000;

function isSameFunctionTraceMeta(
  a: IFunctionTraceMeta,
  b: IFunctionTraceMeta,
): boolean {
  return (
    a.name === b.name && a.file === b.file && (a.line ?? 0) === (b.line ?? 0)
  );
}

export function isStartupProfileEnabled(): boolean {
  const g = globalThis as any;
  if (g[GLOBAL_FLAG_KEY] === true) return true;
  try {
    return process.env.ONEKEY_STARTUP_PROFILE === '1';
  } catch {
    return false;
  }
}

let functionTraceId = 0;
let functionTraceLogger: {
  write: (level: number, message: string) => void;
  level: number;
} | null = null;
const pendingFunctionTraceLogs: string[] = [];

function writeFunctionTrace(message: string): void {
  try {
    if (!functionTraceLogger) {
      const m =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      functionTraceLogger = {
        write: (level: number, logMessage: string) => {
          m.NativeLogger.write(level, logMessage);
        },
        level: m.LogLevel.Error,
      };
    }
    for (const pendingMessage of pendingFunctionTraceLogs.splice(0)) {
      functionTraceLogger.write(functionTraceLogger.level, pendingMessage);
    }
    functionTraceLogger.write(functionTraceLogger.level, message);
  } catch {
    // Native logger may not be ready during the earliest runtime bootstrap.
    if (pendingFunctionTraceLogs.length < 1000) {
      pendingFunctionTraceLogs.push(message);
    }
  }
}

function functionTraceNow(): number {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

export function installFunctionTrace(): void {
  const g = globalThis as any;
  if (g[FUNCTION_TRACE_FLAG_KEY] !== true) return;
  if (g[FUNCTION_TRACE_START_KEY] || g[FUNCTION_TRACE_END_KEY]) return;

  g[FUNCTION_TRACE_START_KEY] = (meta: IFunctionTraceMeta) => {
    if (!meta) return;
    functionTraceId += 1;
    const id = functionTraceId;
    functionTraceOpenCalls.push({ id, start: functionTraceNow(), meta });
    if (functionTraceOpenCalls.length > FUNCTION_TRACE_MAX_OPEN_CALLS) {
      functionTraceOpenCalls.shift();
    }
    const runtime = g.__ONEKEY_RUNTIME_KIND__ ?? 'unknown';
    writeFunctionTrace(
      `[FunctionTrace] begin id=${id} ts=${Date.now()} runtime=${runtime} name=${meta.name} file=${meta.file} line=${meta.line ?? 0}`,
    );
  };

  g[FUNCTION_TRACE_END_KEY] = (meta?: IFunctionTraceMeta) => {
    if (!meta) return;
    // Innermost match first: recursive and awaited calls of the same function
    // then pair in the order they return.
    let index = -1;
    for (let i = functionTraceOpenCalls.length - 1; i >= 0; i -= 1) {
      if (isSameFunctionTraceMeta(functionTraceOpenCalls[i].meta, meta)) {
        index = i;
        break;
      }
    }
    // No match when the begin hook was installed later than this call started,
    // or when its entry was dropped by the cap above.
    if (index === -1) return;
    const [entry] = functionTraceOpenCalls.splice(index, 1);
    const runtime = g.__ONEKEY_RUNTIME_KIND__ ?? 'unknown';
    const durationMs = functionTraceNow() - entry.start;
    writeFunctionTrace(
      `[FunctionTrace] end id=${entry.id} ts=${Date.now()} runtime=${runtime} name=${entry.meta.name} file=${entry.meta.file} line=${entry.meta.line ?? 0} durationMs=${durationMs.toFixed(3)}`,
    );
  };
}

// Diagnostic: emit a one-off NativeLogger line so when the profile flag is on
// but `[StartupProfile.js]` summary lines are missing from the log, we can
// tell WHY (is `__r` not a function? is `require` a closure-local under
// inline-requires? did the factory for require-shim run before or after
// install?). Keep this small and cheap — it only runs when the flag is on.
function logStartupProfileDiag(tag: string, extra: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const m = require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    m.NativeLogger.write(
      m.LogLevel.Info,
      `[StartupProfile.js] ${tag}: ${extra}`,
    );
  } catch {
    /* logger not ready — ignore */
  }
}

export function installStartupProfileJs(): void {
  if (!isStartupProfileEnabled()) return;
  const g = globalThis as any;
  if (g[GLOBAL_STATS_KEY]) return; // idempotent

  const stats = new Map<string | number, IModStat>();
  g[GLOBAL_STATS_KEY] = stats;

  const origRequire = g.__r as ((id: unknown) => unknown) | undefined;
  // Probe Metro internals so we know which wrapping strategy can work.
  const probeKeys: string[] = [];
  try {
    if (origRequire) {
      for (const k of Object.getOwnPropertyNames(origRequire)) {
        probeKeys.push(k);
      }
    }
  } catch {
    /* ignore */
  }
  const hasGetModules = typeof (origRequire as any)?.getModules === 'function';
  const hasModulesProp = typeof (origRequire as any)?.modules === 'object';
  const dProps: string[] = [];
  try {
    if (g.__d) {
      for (const k of Object.getOwnPropertyNames(g.__d)) {
        dProps.push(k);
      }
    }
  } catch {
    /* ignore */
  }
  logStartupProfileDiag(
    'install',
    `typeof __r=${typeof origRequire}, typeof __d=${typeof g.__d}, hasGlobal=${typeof globalThis !== 'undefined'}, __r.keys=[${probeKeys.join(',')}], __r.getModules=${hasGetModules}, __r.modules=${hasModulesProp}, __d.keys=[${dProps.join(',')}]`,
  );
  if (typeof origRequire !== 'function') {
    return;
  }

  const loaded = new Set<string | number>();
  const childMsStack: number[] = [];

  g.__r = function patchedRequire(this: unknown, id: unknown) {
    const moduleKey = id as string | number;
    if (loaded.has(moduleKey)) {
      // Cached — no factory execution, nothing to measure.
      return origRequire.call(this, id);
    }
    loaded.add(moduleKey);

    const start = Date.now();
    childMsStack.push(0);
    try {
      return origRequire.call(this, id);
    } finally {
      const totalMs = Date.now() - start;
      const childMs = childMsStack.pop() ?? 0;
      const selfMs = Math.max(0, totalMs - childMs);
      // Tell parent about our total so their self-time can subtract.
      if (childMsStack.length > 0) {
        childMsStack[childMsStack.length - 1] += totalMs;
      }
      // Filter noise — 99% of modules are sub-ms.
      if (totalMs >= 1) {
        stats.set(moduleKey, { id: moduleKey, selfMs, totalMs });
      }
    }
  };
}

function resolveModulePath(
  id: string | number,
  moduleIdMap?: Record<string, string>,
): string {
  if (moduleIdMap && typeof id !== 'undefined') {
    const p = moduleIdMap[String(id)];
    if (typeof p === 'string' && p.length > 0) return p;
  }
  return typeof id === 'number' ? `module#${id}` : String(id);
}

export function flushStartupProfileJs(): void {
  if (!isStartupProfileEnabled()) return;
  const g = globalThis as any;
  const stats = g[GLOBAL_STATS_KEY] as
    | Map<string | number, IModStat>
    | undefined;
  logStartupProfileDiag(
    'flush-entry',
    `statsExists=${!!stats}, statsSize=${stats?.size ?? 'n/a'}`,
  );
  if (!stats || stats.size === 0) return;

  let NativeLogger: any;
  let LogLevel: any;
  try {
    const m = require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger = m.NativeLogger;
    LogLevel = m.LogLevel;
  } catch {
    return;
  }

  // In dev mode Metro may expose a map on globalThis. In production we can
  // emit an id→path map via segmentSerializer prologue; both read the same key.
  const moduleIdMap = (g.__ONEKEY_MODULE_ID_TO_PATH__ ??
    g.__METRO_MODULE_ID_TO_PATH__) as Record<string, string> | undefined;

  const arr = [...stats.values()];
  const totalSelfMs = arr.reduce((acc, s) => acc + s.selfMs, 0);
  const totalInclusiveMs = arr
    .filter((s) => s.totalMs > 0) // sanity
    .reduce((acc, s) => acc + s.totalMs, 0);

  // Sort by self-time (what actually costs us); keep inclusive alongside.
  arr.sort((a, b) => b.selfMs - a.selfMs);
  const topN = arr.slice(0, 200);

  NativeLogger.write(
    LogLevel.Info,
    `[StartupProfile.js] summary: tracked=${stats.size}, sum_self=${totalSelfMs}ms, sum_inclusive=${totalInclusiveMs}ms, flushing top ${topN.length} by self-time`,
  );
  for (const s of topN) {
    NativeLogger.write(
      LogLevel.Info,
      `[StartupProfile.js] self=${s.selfMs}ms total=${s.totalMs}ms ${resolveModulePath(
        s.id,
        moduleIdMap,
      )}`,
    );
  }

  // Free memory + avoid double-emission on any later flush.
  stats.clear();
}

// Called from `apps/mobile/index.ts` after `main entry evaluated` is logged.
// Uses setTimeout(0) so the flush appears after all synchronous startup logs.
export function scheduleStartupProfileJsFlush(): void {
  if (!isStartupProfileEnabled()) return;
  setTimeout(() => {
    try {
      flushStartupProfileJs();
    } catch {
      /* swallow — profiling must never break startup */
    }
  }, 0);
}
