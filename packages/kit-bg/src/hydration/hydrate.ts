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
//   2. On build-hash mismatch, clears the DB and bails (next session
//      re-populates from dual-write).
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
//      so GlobalJotaiReady (web/desktop branch) can unblock React.
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

/* eslint-disable no-console */

import {
  primeColdStartCacheMap,
  readAllColdStartEntriesFromIdb,
  resetColdStartCache,
  writeColdStartMeta,
} from '@onekeyhq/shared/src/storage/instance/webColdStartStorage';

import { globalColdStartHydrationReadyHandler } from '../states/jotai/coldStartReady';

// ---- Constants ----

const JOTAI_KEY_PREFIX = 'jotai/';
const CTX_SNAPSHOT_KEY = 'onekey_jotai_context_atoms_snapshot';
const BUILD_HASH_KEY = '__meta:buildHash';
const KILL_SWITCH_LS_KEY = '__cold_start_kill__';
// Hard cap on how long we wait for IDB before giving up and degrading to
// defaults. The ready gate is awaited by GlobalJotaiReady on web/desktop,
// so an unbounded await here would block React mount on a stalled IDB.
const HYDRATION_TIMEOUT_MS = 300;

const BUILD_HASH: string | undefined =
  typeof process !== 'undefined' && process.env
    ? process.env.BUILD_HASH
    : undefined;

// ---- Helpers ----

function setGlobal(name: string, value: unknown): void {
  (globalThis as Record<string, unknown>)[name] = value;
}

function readKillSwitch(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(KILL_SWITCH_LS_KEY));
  } catch {
    return false;
  }
}

function parseL1InitStates(
  entries: Map<string, string>,
): Record<string, unknown> {
  const initStates: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    if (k.startsWith(JOTAI_KEY_PREFIX)) {
      const atomName = k.slice(JOTAI_KEY_PREFIX.length);
      try {
        initStates[atomName] = JSON.parse(v);
      } catch {
        /* skip corrupt entry */
      }
    }
  }
  return initStates;
}

function parseL2CtxSnapshot(
  entries: Map<string, string>,
): Record<string, unknown> {
  const raw = entries.get(CTX_SNAPSHOT_KEY);
  if (!raw) return {};
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
    return;
  }

  let entries: Map<string, string>;
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
      return;
    }
    entries = result;
  } catch (e) {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
    return;
  }

  // Detect deploy-time schema change via build hash mismatch.
  if (BUILD_HASH !== undefined) {
    const storedHash = entries.get(BUILD_HASH_KEY);
    if (storedHash !== undefined && storedHash !== BUILD_HASH) {
      try {
        await resetColdStartCache();
      } catch (e) {
        setGlobal('__ONEKEY_COLD_START_ERROR__', e);
      }
      // Drop the stale entries; refresh the build-hash marker below so the
      // next cold start sees the new value and re-uses fresh data.
      entries = new Map();
    }
  }

  // Synchronous-read backing store for swrCacheUtils + coldStartCacheStorage.
  primeColdStartCacheMap(entries);

  // Refresh the build-hash marker (first install: writes it for the first
  // time so future cold starts can detect mismatch).
  if (BUILD_HASH !== undefined && entries.get(BUILD_HASH_KEY) !== BUILD_HASH) {
    writeColdStartMeta(BUILD_HASH_KEY, BUILD_HASH);
  }

  // L1: per-atom snapshot consumed at crossAtomBuilder (utils/index.ts:189)
  setGlobal('__ONEKEY_JOTAI_INIT_STATES__', parseL1InitStates(entries));

  // L2: contextAtom snapshot consumed at hydrateContextColdStartCacheForProvider
  setGlobal('__ONEKEY_CTX_ATOM_SNAPSHOT__', parseL2CtxSnapshot(entries));

  // L3: swrCacheUtils.loadStore() lazily reads coldStartCacheStorage on first
  // call → hits the primed map automatically. No explicit step needed here.
})()
  .catch((e: unknown) => {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
  })
  .finally(() => {
    const t1 =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ColdStartHydration] ready in ${Math.round(t1 - t0)}ms`,
        (globalThis as Record<string, unknown>).__ONEKEY_COLD_START_ERROR__
          ? 'with error'
          : 'ok',
      );
    }
    globalColdStartHydrationReadyHandler.resolveReady(true);
  });

setGlobal('__ONEKEY_COLD_START_PROMISE__', promise);
