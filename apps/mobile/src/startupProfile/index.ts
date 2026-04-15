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

type IModStat = {
  id: string | number;
  selfMs: number;
  totalMs: number;
};

export function isStartupProfileEnabled(): boolean {
  const g = globalThis as any;
  if (g[GLOBAL_FLAG_KEY] === true) return true;
  try {
    return process.env.ONEKEY_STARTUP_PROFILE === '1';
  } catch {
    return false;
  }
}

export function installStartupProfileJs(): void {
  if (!isStartupProfileEnabled()) return;
  const g = globalThis as any;
  if (g[GLOBAL_STATS_KEY]) return; // idempotent

  const stats = new Map<string | number, IModStat>();
  g[GLOBAL_STATS_KEY] = stats;

  const origRequire = g.__r as ((id: unknown) => unknown) | undefined;
  if (typeof origRequire !== 'function') {
    // Metro runtime not present (unlikely in RN) — skip silently.
    return;
  }

  const loaded = new Set<string | number>();
  // Accumulator stack: at each active require depth, records total child time
  // so parent can subtract to compute its self-time.
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
