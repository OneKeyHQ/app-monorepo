// Cold-start hydration entry for web. Loaded as the first module after
// polyfills in `apps/web/index.js` (and `apps/desktop/index.js`); runs at
// module load so the hydration promise is fired before React mounts.
//
// Storage isolation: the cold-start IDB lives in its own bucket on
// Chromium (Chrome / Edge / Electron) via navigator.storageBuckets, and in
// the default-origin IDB factory on Firefox / Safari. See
// packages/shared/src/storage/instance/webColdStartStorage.ts for the
// browser support matrix.
//
// What this module does (in module-load order):
//   1. Opens IndexedDB('onekey-cold-start-cache') and reads all entries.
//   2. On build-hash mismatch (or legacy unmarked DB with real entries),
//      clears the DB, replays any in-flight mirror writes, and writes the
//      new marker eagerly (bounded force-flush) so the very next reload
//      sees a marked DB.
//   3. Primes the in-memory map that backs webColdStartStorage so all
//      synchronous reads by swrCacheUtils / coldStartCacheStorage succeed.
//   4. Populates globalThis.__ONEKEY_JOTAI_INIT_STATES__ (L1) from
//      'jotai/<name>' entries.
//   5. Populates globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__ (L2) from the
//      'onekey_jotai_context_atoms_snapshot' single-key blob.
//   6. L3 (SWR cache) needs no explicit prime: swrCacheUtils.loadStore()
//      lazily reads coldStartCacheStorage on first use, which is now backed
//      by our pre-populated map.
//   7. Always resolves globalColdStartHydrationReadyHandler in `finally`
//      so GlobalJotaiReady (web/desktop branch) can unblock React. The
//      resolved value is a `didHydrate` boolean for telemetry; the gate
//      releases regardless of value.
//
// Failure modes (all caught, all degrade to defaults):
//   • Dev (NODE_ENV !== 'production') — skip entirely to avoid schema drift
//   • Kill switch — localStorage.__cold_start_kill__ set
//   • Private mode / quota=0 — openIDB rejects
//   • Build hash mismatch — clear DB, fall back to defaults
//   • IDB stall — capped by HYDRATION_TIMEOUT_MS (300ms). On timeout we
//     leave any early mirror writes from setColdStartL1MirrorEntry intact,
//     set globalThis.__ONEKEY_COLD_START_TIMEOUT__ = true, and unblock the
//     ready gate so React can still mount.
//
// Telemetry: globalThis.__ONEKEY_COLD_START_RESULT__ holds one of
//   'success' | 'timeout' | 'error' | 'killed'
// describing the terminal state. 'success' means at least one entry was
// primed from IDB; everything else fell back to defaults.

/* eslint-disable no-console */

import {
  flushColdStartCacheNow,
  primeColdStartCacheMap,
  readAllColdStartEntriesFromIdb,
  replayColdStartEntries,
  resetColdStartCache,
  writeColdStartMeta,
} from '@onekeyhq/shared/src/storage/instance/webColdStartStorage';

import { globalColdStartHydrationReadyHandler } from '../states/jotai/coldStartReady';

import type { IColdStartHydrationStatus } from '../states/jotai/coldStartReady';

// ---- Constants ----

const JOTAI_KEY_PREFIX = 'jotai/';
const META_KEY_PREFIX = '__meta:';
const CTX_SNAPSHOT_KEY = 'onekey_jotai_context_atoms_snapshot';
const BUILD_HASH_KEY = '__meta:buildHash';
const KILL_SWITCH_LS_KEY = '__cold_start_kill__';
const COLD_START_RESULT_GLOBAL = '__ONEKEY_COLD_START_RESULT__';
// Hard cap on how long we wait for IDB before giving up and degrading to
// defaults. The ready gate is awaited by GlobalJotaiReady on web/desktop,
// so an unbounded await here would block React mount on a stalled IDB.
const HYDRATION_TIMEOUT_MS = 300;
// Bound on how long we wait for the BUILD_HASH marker to flush before
// resolving the ready gate. Long enough to commit a single put() on a warm
// IDB connection, short enough that a wedged write cannot stall React mount.
const BUILD_HASH_FLUSH_TIMEOUT_MS = 1000;

const BUILD_HASH: string | undefined =
  typeof process !== 'undefined' && process.env
    ? process.env.BUILD_HASH
    : undefined;

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

function parseL1InitStates(
  entries: Map<string, unknown>,
): Record<string, unknown> {
  const initStates: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    if (k.startsWith(JOTAI_KEY_PREFIX)) {
      const atomName = k.slice(JOTAI_KEY_PREFIX.length);
      // L1 jotai entries are stored RAW (IDB structured-cloned them) so the
      // fidelity matches the source-of-truth JotaiStorage. No JSON.parse —
      // doing so would only re-introduce the round-trip losses (Date/Map/
      // Set/BigInt) that motivated this change and would make the post-
      // jotaiInit isEqual guard flap.
      initStates[atomName] = v;
    }
  }
  return initStates;
}

function parseL2CtxSnapshot(
  entries: Map<string, unknown>,
): Record<string, unknown> {
  // L2 still goes through the ISyncStorage facade (set/setObject), which
  // JSON-stringifies on the way in. Keep the JSON.parse on read; if some
  // future caller starts writing this key raw, the typeof check degrades
  // to returning {} rather than throwing.
  const raw = entries.get(CTX_SNAPSHOT_KEY);
  if (typeof raw !== 'string' || !raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
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

// Strategy for preserving in-flight mirror writes across a reset (F8):
// snapshot+replay. We grab a copy of the in-memory map BEFORE
// resetColdStartCache wipes it, then re-apply the non-meta entries via
// replayColdStartEntries AFTER the reset and after the new BUILD_HASH marker
// is written. This is preferred over a hydrate-start lock because the lock
// would require gating setColdStartL1MirrorEntry from outside this module,
// which leaks hydration internals into jotaiStorage.ts.
function snapshotInMemoryMap(): Map<string, unknown> {
  const g = globalThis as Record<string, unknown>;
  const map = g.__ONEKEY_COLD_START_CACHE_MAP__ as
    | Map<string, unknown>
    | undefined;
  if (!map) return new Map();
  return new Map(map);
}

// Count entries excluding internal meta-keys. Used by the F6 invalidation
// path to distinguish a brand-new DB (no entries, no marker) from a legacy
// DB that predates the BUILD_HASH marker (real entries, no marker).
function countNonMetaEntries(entries: Map<string, unknown>): number {
  let n = 0;
  for (const k of entries.keys()) {
    if (!k.startsWith(META_KEY_PREFIX)) n += 1;
  }
  return n;
}

const promise: Promise<void> = (async () => {
  // Skip in development to avoid schema drift between code changes.
  // Atoms will use defaults and jotaiInit will populate from JotaiStorage
  // as today. To test cold-start manually, build a production bundle.
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[ColdStartHydration] dev mode, skipping (cold-start is production-only)',
    );
    return;
  }

  if (readKillSwitch()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ColdStartHydration] kill switch active, skipping');
    }
    status = 'killed';
    return;
  }

  let entries: Map<string, unknown>;
  try {
    const result = await withTimeout(
      readAllColdStartEntriesFromIdb(),
      HYDRATION_TIMEOUT_MS,
    );
    if (result === undefined) {
      // Timed out — leave the in-memory map untouched (any early mirror
      // writes from setColdStartL1MirrorEntry stay) and bail. The empty
      // pre-hydration map degrades to defaults via jotaiInit.
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

  // Detect deploy-time schema change. We invalidate on:
  //   (a) marker present but differs from the current BUILD_HASH, OR
  //   (b) marker absent but the DB has real (non-meta) entries — this is
  //       a legacy DB written before the marker existed, and we have no
  //       way to vouch for its schema, so treat it as a mismatch.
  //
  // The marker is the natural invalidation point for legacy DBs written by
  // the pre-structured-clone implementation (values were JSON-strings).
  // Because BUILD_HASH is sourced from `git rev-parse` at bundle time, any
  // commit that flips the storage shape produces a new hash and triggers
  // the reset below on the next cold boot.
  if (BUILD_HASH !== undefined) {
    const storedHashRaw = entries.get(BUILD_HASH_KEY);
    const storedHash =
      typeof storedHashRaw === 'string' ? storedHashRaw : undefined;
    const isMismatch =
      (storedHash !== undefined && storedHash !== BUILD_HASH) ||
      (storedHash === undefined && countNonMetaEntries(entries) > 0);
    if (isMismatch) {
      // F8: snapshot any mirror writes that landed between module-load and
      // now, so resetColdStartCache doesn't drop fresh user data.
      const liveSnapshot = snapshotInMemoryMap();
      try {
        await resetColdStartCache();
      } catch (e) {
        setGlobal('__ONEKEY_COLD_START_ERROR__', e);
      }
      // Drop the stale entries; the freshly-written marker (below) is what
      // future cold starts will see.
      entries = new Map();
      // Replay non-meta entries from the snapshot — meta keys would only
      // reintroduce the now-cleared stale BUILD_HASH marker.
      const replayEntries: [string, unknown][] = [];
      for (const [k, v] of liveSnapshot) {
        if (!k.startsWith(META_KEY_PREFIX)) replayEntries.push([k, v]);
      }
      if (replayEntries.length > 0) {
        replayColdStartEntries(replayEntries);
      }
    }
  }

  // Synchronous-read backing store for swrCacheUtils + coldStartCacheStorage.
  primeColdStartCacheMap(entries);

  // Refresh the build-hash marker (first install: writes it for the first
  // time so future cold starts can detect mismatch). Force-flush eagerly,
  // bounded by BUILD_HASH_FLUSH_TIMEOUT_MS, so a closing tab cannot leave
  // the marker stuck in the in-memory dirty set — that would render the F6
  // invalidation gate permanently no-op for users who don't dwell.
  if (BUILD_HASH !== undefined && entries.get(BUILD_HASH_KEY) !== BUILD_HASH) {
    writeColdStartMeta(BUILD_HASH_KEY, BUILD_HASH);
    try {
      await withTimeout(flushColdStartCacheNow(), BUILD_HASH_FLUSH_TIMEOUT_MS);
    } catch {
      // flushColdStartCacheNow swallows its own errors; an unexpected throw
      // here must not block the ready signal.
    }
  }

  // L1: per-atom snapshot consumed at crossAtomBuilder (utils/index.ts:189)
  setGlobal('__ONEKEY_JOTAI_INIT_STATES__', parseL1InitStates(entries));

  // L2: contextAtom snapshot consumed at hydrateContextColdStartCacheForProvider
  setGlobal('__ONEKEY_CTX_ATOM_SNAPSHOT__', parseL2CtxSnapshot(entries));

  // L3: swrCacheUtils.loadStore() lazily reads coldStartCacheStorage on first
  // call → hits the primed map automatically. No explicit step needed here.

  // Mark success iff at least one entry was primed from IDB. An empty post-
  // reset entries map still counts as a successful hydration cycle (we wrote
  // a fresh marker), but didHydrate stays false so telemetry can see we fell
  // back to defaults.
  status = 'success';
  didHydrate = entries.size > 0;
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
      console.log(
        `[ColdStartHydration] ready in ${Math.round(t1 - t0)}ms`,
        `status=${status}`,
        `didHydrate=${didHydrate}`,
      );
    }
    // Pass didHydrate (telemetry); GlobalJotaiReady ignores the value and
    // always releases the gate so React mount is never blocked by a miss.
    globalColdStartHydrationReadyHandler.resolveReady(didHydrate);
  });

setGlobal('__ONEKEY_COLD_START_PROMISE__', promise);
