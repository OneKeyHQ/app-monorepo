// Cold-start hydration entry for web. Loaded as the first module after
// polyfills in `apps/web/index.js` (and `apps/desktop/index.js`); runs at
// module load so the hydration promise is fired before React mounts.
//
// Per-atom globalAtom mirroring was removed to avoid duplicating sensitive
// PersistAtom fields into a second store; web/desktop globalAtoms reconcile
// asynchronously via jotaiInit instead. What remains is the context-atom
// snapshot, which introduces a persistence channel of its own rather than
// mirroring a source of truth.
//
// The snapshots live in one IndexedDB database, `onekey-ui-snapshot`, keyed
// `<namespace>:<key>`, in its own storage bucket on Chromium and in the
// default factory elsewhere.
//
// What this module does, in module-load order:
//   1. Reads the two namespaces first paint needs — the context-atom snapshot
//      and the store's own markers — as key ranges, so the rest of the
//      database is not touched.
//   2. On a build-hash mismatch (or an unmarked database that already holds
//      records) wipes every namespace and writes the new marker eagerly, so
//      the very next reload sees a marked store.
//   3. Primes the map those namespaces are read from synchronously.
//   4. Populates `globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__`.
//   5. Primes every other namespace after the gate resolves: a page reads its
//      own namespace by exact key when it opens, so a slow IndexedDB makes
//      those land late rather than not at all.
//   6. Always resolves globalColdStartHydrationReadyHandler in `finally` so
//      GlobalJotaiReady can unblock React. The resolved value is a
//      `didHydrate` boolean for telemetry; the gate releases either way.
//
// Failure modes (all caught, all degrade to defaults):
//   • Dev (NODE_ENV !== 'production') — skip the generic snapshot to avoid
//     schema drift; prime only versioned, display-only Swap balance caches
//   • Kill switch — localStorage.__cold_start_kill__ set
//   • Private mode / quota=0 — opening the database rejects
//   • Build hash mismatch — wipe, fall back to defaults
//   • A stalled database — capped by HYDRATION_TIMEOUT_MS (300ms). On timeout
//     `globalThis.__ONEKEY_COLD_START_TIMEOUT__` is set and the ready gate is
//     released so React can still mount.
//
// Telemetry: globalThis.__ONEKEY_COLD_START_RESULT__ holds one of
//   'success' | 'timeout' | 'error' | 'killed' | 'skipped'.

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  UI_SNAPSHOT_META_NAMESPACE,
  flushUiSnapshotStoreNow,
  primeWebUiSnapshotStore,
  readUiSnapshotMeta,
  readWebUiSnapshotEntriesFromIdb,
  resetWebUiSnapshotStore,
  writeUiSnapshotMeta,
} from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore';
import {
  readContextAtomSnapshotRaw,
  writeContextAtomSnapshotRaw,
} from '@onekeyhq/shared/src/storage/uiSnapshotCaches';
import { normalizeSwapColdStartCacheSnapshot } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';

import { globalColdStartHydrationReadyHandler } from '../states/jotai/coldStartReady';

import type { IColdStartHydrationStatus } from '../states/jotai/coldStartReady';

// ---- Constants ----

const BUILD_HASH_KEY = 'build-hash';
const CTX_SNAPSHOT_NAMESPACE = 'ctx-atom-snapshot';
// Namespaces the first frame reads, loaded before the ready gate resolves.
// The account selector's recent-selection guard is one of them: it decides
// which account the home screen opens with, so finding it late is the same as
// not finding it. Everything else is primed after the gate.
const STARTUP_NAMESPACES = [
  CTX_SNAPSHOT_NAMESPACE,
  'account-selector',
  UI_SNAPSHOT_META_NAMESPACE,
] as const;
const KILL_SWITCH_LS_KEY = '__cold_start_kill__';
const COLD_START_RESULT_GLOBAL = '__ONEKEY_COLD_START_RESULT__';
const DEV_SAFE_L2_BALANCE_CACHE_KEYS = new Set<string>([
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockBalanceDisplayCacheAtom,
]);
// Hard cap on how long we wait for IDB before giving up and degrading to
// defaults. The ready gate is awaited by GlobalJotaiReady on web/desktop,
// so an unbounded await here would block React mount on a stalled IDB.
const HYDRATION_TIMEOUT_MS = 300;
// Bound on how long we wait for the BUILD_HASH marker to flush before
// resolving the ready gate. Long enough to commit a single put() on a warm
// IDB connection, short enough that a wedged write cannot stall React mount.
const BUILD_HASH_FLUSH_TIMEOUT_MS = 1000;

// Schema-invalidation key for the cold-start cache. Sourced from the
// canonical commit SHA exposed via platformEnv (populated from GITHUB_SHA
// / WORKFLOW_GITHUB_SHA on CI). When the SHA changes between deploys, the
// cold-start IDB is wiped to prevent stale entries from a prior build
// leaking into a new code base. Local prod-mode builds without a CI env
// var will be undefined here; dev mode skips this path entirely.
//
// Precedence: `githubSHA` wins because it bumps on every commit; the
// version/buildNumber pair only changes on releases (coarser signal) but
// still beats disabling the gate entirely when CI env vars are absent.
export function computeEffectiveBuildHash(
  githubSHA: string | undefined,
  version: string | undefined,
  buildNumber: string | undefined,
): string | undefined {
  if (githubSHA) return githubSHA;
  if (version) return `v:${version}:${buildNumber ?? ''}`;
  return undefined;
}

const BUILD_HASH: string | undefined = computeEffectiveBuildHash(
  platformEnv.githubSHA || undefined,
  platformEnv.version || undefined,
  platformEnv.buildNumber || undefined,
);

// ---- Helpers ----

function setGlobal(name: string, value: unknown): void {
  (globalThis as Record<string, unknown>)[name] = value;
}

// Accepts the kill switch as a localStorage string. Off (false) when the
// key is unset, empty, '0', 'false', or 'no' (case-insensitive). Any other
// non-empty value flips it on. Avoids the `Boolean('0') === true` pitfall
// where `setItem(KILL_SWITCH_LS_KEY, '0')` would otherwise enable the kill
// switch.
function parseBooleanLike(v: string | null): boolean {
  if (v === null) return false;
  const trimmed = v.trim().toLowerCase();
  if (
    trimmed === '' ||
    trimmed === '0' ||
    trimmed === 'false' ||
    trimmed === 'no'
  ) {
    return false;
  }
  return true;
}

function readKillSwitch(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return parseBooleanLike(localStorage.getItem(KILL_SWITCH_LS_KEY));
  } catch {
    return false;
  }
}

/** The snapshot as its own writers left it: one serialized record. */
function parseCtxSnapshot(): Record<string, unknown> {
  const raw = readContextAtomSnapshotRaw();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function filterDevSafeL2CtxSnapshot(snapshot: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(snapshot).filter(([scopedKey, value]) => {
      const separatorIndex = scopedKey.lastIndexOf('::');
      if (separatorIndex < 0) {
        return false;
      }
      const cacheKey = scopedKey.slice(separatorIndex + 2);
      if (!DEV_SAFE_L2_BALANCE_CACHE_KEYS.has(cacheKey)) {
        return false;
      }
      return Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as { version?: unknown }).version === 'number' &&
        Array.isArray((value as { entries?: unknown }).entries),
      );
    }),
  );
}

/**
 * Race a promise against a timeout. On timeout, resolves with `undefined`
 * instead of throwing — callers detect the timeout by the undefined return
 * value and degrade to defaults.
 *
 * Pre-timeout rejection bubbles up so the outer try/catch records
 * __ONEKEY_COLD_START_ERROR__. Post-timeout settlement (resolve or reject)
 * is silently dropped so a late IDB error does not surface as an unhandled
 * promise rejection.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(undefined);
    }, ms);
    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ---- Main ----

const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

// Telemetry tracked inside the IIFE and surfaced via __ONEKEY_COLD_START_RESULT__.
// `status` starts as 'error' so any path that throws before assigning falls into
// the error bucket; the success path overrides it explicitly.
let status: IColdStartHydrationStatus = 'error';
let didHydrate = false;

// Records that are not the store's own markers. Used by the invalidation path
// to tell a brand-new store (nothing, no marker) from one written before the
// marker existed (records, no marker).
export function countNonMetaKeys(keys: Iterable<string>): number {
  let n = 0;
  for (const k of keys) {
    if (!k.startsWith(`${UI_SNAPSHOT_META_NAMESPACE}:`)) n += 1;
  }
  return n;
}

export function countNonMetaEntries(entries: Map<string, unknown>): number {
  return countNonMetaKeys(entries.keys());
}

/**
 * Load every remaining namespace, off the ready gate.
 *
 * A page reads its own namespace by exact key when it opens, so none of this
 * is needed for the first frame and a slow database makes it land late rather
 * than not at all.
 */
function schedulePrimeUiSnapshotStore(): void {
  void (async () => {
    try {
      const entries = await readWebUiSnapshotEntriesFromIdb();
      if (entries.size > 0) {
        primeWebUiSnapshotStore(entries);
      }
    } catch {
      // Best effort: a failed late read is an ordinary cache miss.
    }
  })();
}

/**
 * Decide whether the post-`resetColdStartCache` IDB recheck is clean enough
 * to proceed with priming + marker refresh.
 *
 * The wipe is best effort, so a successful await does NOT guarantee the store
 * is empty. If we naively trusted the return value and
 * wrote the new BUILD_HASH marker, the marker would match on the next boot
 * and we would prime stale entries written under a different schema. Worst-
 * case those entries deserialize into atom state and cause schema drift.
 *
 * Rules:
 *   • `undefined` (the recheck timed out or threw)
 *       → DO NOT proceed; cannot verify the wipe took.
 *   • Map holding only the store's own markers
 *       → proceed; meta entries are non-payload and a meta-only DB is
 *         indistinguishable from a brand-new DB to downstream consumers.
 *   • Map containing any non-meta key
 *       → DO NOT proceed; the wipe left real entries behind.
 */
export function shouldProceedAfterReset(
  recheck: Map<string, unknown> | undefined,
): boolean {
  if (recheck === undefined) return false;
  return countNonMetaEntries(recheck) === 0;
}

const promise: Promise<void> = (async () => {
  // In development, keep generic context-atom hydration disabled to avoid
  // schema drift between local code changes. Prime only the versioned,
  // display-only Swap balance caches so localhost can verify the real
  // first-frame experience without hydrating executable Swap state.
  if (process.env.NODE_ENV !== 'production') {
    defaultLogger.app.appUpdate.log(
      '[ColdStartHydration] dev mode, priming safe display caches only',
    );
    try {
      const entries = await withTimeout(
        readWebUiSnapshotEntriesFromIdb({
          namespaces: [...STARTUP_NAMESPACES],
        }),
        HYDRATION_TIMEOUT_MS,
      );
      if (entries) {
        primeWebUiSnapshotStore(entries);
        const safeCtxSnapshot = filterDevSafeL2CtxSnapshot(parseCtxSnapshot());
        if (Object.keys(safeCtxSnapshot).length) {
          writeContextAtomSnapshotRaw(JSON.stringify(safeCtxSnapshot));
          setGlobal('__ONEKEY_CTX_ATOM_SNAPSHOT__', safeCtxSnapshot);
        }
      }
    } catch {
      // Dev-only best effort: keep the old skipped behavior if the database
      // is missing or slow.
    }
    // Deliberate no-op: mark as 'skipped' so the finally block does not log
    // this as 'error' (the initial value).
    status = 'skipped';
    return;
  }

  if (readKillSwitch()) {
    status = 'killed';
    return;
  }

  let entries: Map<string, string>;
  try {
    const result = await withTimeout(
      readWebUiSnapshotEntriesFromIdb({ namespaces: [...STARTUP_NAMESPACES] }),
      HYDRATION_TIMEOUT_MS,
    );
    if (result === undefined) {
      // Timed out — leave the in-memory map untouched (any early writes stay)
      // and bail. The empty pre-hydration map degrades to defaults.
      setGlobal('__ONEKEY_COLD_START_TIMEOUT__', true);
      status = 'timeout';
      return;
    }
    entries = result;
  } catch (e) {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
    status = 'error';
    return;
  }

  // Detect a deploy-time schema change. Invalidate when the marker is present
  // and differs, or absent while the store already holds records — the latter
  // was written before the marker existed and cannot be vouched for.
  if (BUILD_HASH !== undefined) {
    const storedHash = entries.get(
      `${UI_SNAPSHOT_META_NAMESPACE}:${BUILD_HASH_KEY}`,
    );
    const isMismatch =
      (storedHash !== undefined && storedHash !== BUILD_HASH) ||
      (storedHash === undefined && countNonMetaKeys(entries.keys()) > 0);
    if (isMismatch) {
      try {
        await resetWebUiSnapshotStore();
      } catch (e) {
        // Surface the wipe failure as terminal: records written under another
        // schema must not reach the prime path, and the marker write below
        // would fail against the same broken database anyway.
        setGlobal('__ONEKEY_COLD_START_ERROR__', e);
        status = 'error';
        return;
      }
      const recheck = await withTimeout(
        readWebUiSnapshotEntriesFromIdb(),
        HYDRATION_TIMEOUT_MS,
      );
      if (!shouldProceedAfterReset(recheck)) {
        setGlobal(
          '__ONEKEY_COLD_START_ERROR__',
          new OneKeyLocalError(
            'UI snapshot store still holds records after a reset',
          ),
        );
        status = 'error';
        return;
      }
      entries = new Map();
    }
  }

  primeWebUiSnapshotStore(entries);

  // Refresh the marker (first install: writes it for the first time). Flushed
  // eagerly and bounded, so the next cold start sees a marked store without a
  // wedged write stalling the mount.
  if (
    BUILD_HASH !== undefined &&
    readUiSnapshotMeta(BUILD_HASH_KEY) !== BUILD_HASH
  ) {
    writeUiSnapshotMeta(BUILD_HASH_KEY, BUILD_HASH);
    try {
      await withTimeout(flushUiSnapshotStoreNow(), BUILD_HASH_FLUSH_TIMEOUT_MS);
    } catch {
      // The debounced flush will carry it; a failed eager write only costs
      // one more invalidation on the next boot.
    }
  }

  const ctxSnapshot = normalizeSwapColdStartCacheSnapshot(parseCtxSnapshot());
  setGlobal('__ONEKEY_CTX_ATOM_SNAPSHOT__', ctxSnapshot);

  status = 'success';
  didHydrate = Object.keys(ctxSnapshot).length > 0;
})()
  .catch((e: unknown) => {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
    status = 'error';
    didHydrate = false;
  })
  .finally(() => {
    const t1 =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    setGlobal(COLD_START_RESULT_GLOBAL, status);
    globalColdStartHydrationReadyHandler.status = status;
    if (process.env.NODE_ENV !== 'production') {
      defaultLogger.app.appUpdate.log(
        `[ColdStartHydration] ready in ${Math.round(
          t1 - t0,
        )}ms status=${status} didHydrate=${didHydrate}`,
      );
    }
    // Pass didHydrate (telemetry); GlobalJotaiReady ignores the value and
    // always releases the gate so React mount is never blocked by a miss.
    globalColdStartHydrationReadyHandler.resolveReady(didHydrate);
  });

// Every other namespace, after the gate and after any wipe above: priming
// from a read that started earlier would put back what the wipe removed.
void promise.finally(schedulePrimeUiSnapshotStore);

setGlobal('__ONEKEY_COLD_START_PROMISE__', promise);
