// Web/desktop cold-start cache backend. Replaces the no-op stub previously
// returned by `coldStartCacheStorage` on non-native platforms.
//
// Stores L2 contextAtom snapshot + L3 SWR cache only. L1 per-atom globalAtom
// mirror was removed to avoid duplicating sensitive PersistAtom fields
// (sensitiveEncodeKey, encryptedSecurityPasswordR1) into a second IDB. Web/
// desktop globalAtoms reconcile asynchronously via jotaiInit instead.
//
// Layered design:
//   • In-memory Map (globalThis.__ONEKEY_COLD_START_CACHE_MAP__) — primed by
//     apps/web/src/hydration/hydrate.ts at boot, read synchronously by every
//     consumer of the ISyncStorage facade.
//   • IndexedDB ('onekey-cold-start-cache') — async, debounced flush of
//     dirty keys; durability layer that survives reloads.
//
// The Map is the source-of-truth at runtime; IDB is just persistence. This
// lets us keep ISyncStorage's synchronous contract while still using
// IndexedDB (which has no sync API).
//
// Value fidelity: all entries are stored as strings — the ISyncStorage
// facade callers (writeColdStartMeta + setObject/setString) serialize on
// the way in, getString returns the raw string on the way out.
//
// Storage isolation: the IndexedDBPromised wrapper prefers
// `navigator.storageBuckets` (Chromium only — Chrome / Edge / Electron) so
// the cold-start DB lives in its own bucket and is GC'd independently of
// the main app data. Firefox / Safari do not implement storageBuckets, so
// they fall through to `globalThis.indexedDB` (the default-origin factory).
// This still works because the database NAME ('onekey-cold-start-cache')
// is unique within the origin — only the storage-quota grouping differs.
//
// Hydration timing: hydrate.ts wraps readAllColdStartEntriesFromIdb with a
// 300ms timeout (HYDRATION_TIMEOUT_MS). On timeout, primeColdStartCacheMap
// is NOT called, so missing L2 keys fall through to context-atom defaults.

import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { IndexedDBPromised } from '../../IndexedDBPromised';

import type { ISyncStorage } from './syncStorageInstance';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

// ---- Constants ----

const DB_NAME = 'onekey-cold-start-cache';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const FLUSH_DEBOUNCE_MS = 2000;

const GLOBAL_MAP_KEY = '__ONEKEY_COLD_START_CACHE_MAP__';

// ---- In-memory state ----

// Reset-in-progress latch. While true, scheduleFlush + writeColdStartMeta
// + every facade mutator becomes a no-op so concurrent writers
// (swrCacheUtils flushes, contextAtom snapshot writer, JotaiStorage
// callbacks) cannot resurrect data that resetColdStartCache is in the
// middle of wiping. See resetColdStartCache for the windows we are
// protecting. Declared up here so writeColdStartMeta (which is exported
// near the top of the file, ahead of the rest of the flush state) can
// reference it without tripping no-use-before-define.
let isClearing = false;

function getMap(): Map<string, unknown> {
  const g = globalThis as Record<string, unknown>;
  let map = g[GLOBAL_MAP_KEY] as Map<string, unknown> | undefined;
  if (!map) {
    map = new Map<string, unknown>();
    g[GLOBAL_MAP_KEY] = map;
  }
  return map;
}

/** Merge entries loaded from IDB into the in-memory map. Called by
 *  hydrate.ts after its IDB getAll resolves. Values are raw strings as
 *  written by the ISyncStorage facade. */
export function primeColdStartCacheMap(
  entries: Iterable<[string, unknown]>,
): void {
  const map = getMap();
  for (const [k, v] of entries) {
    // Do NOT clobber entries already written by a facade .set/.setObject
    // call that fired while hydrate.ts was still awaiting IDB. The local
    // map is treated as more authoritative than the stale IDB snapshot for
    // keys present in both.
    if (!map.has(k)) {
      map.set(k, v);
    }
  }
}

/** Write a meta entry (e.g. build hash) bypassing the EAppSyncStorageKeys
 *  type contract. Used by hydrate.ts to refresh the build-hash marker so
 *  the next cold start can detect a deploy-time schema change. The value
 *  is stored as a raw string — the BUILD_HASH check in hydrate.ts compares
 *  strings directly, so no JSON encoding here. */
export function writeColdStartMeta(key: string, value: string): void {
  // Drop writes during reset so the build-hash marker that triggered the
  // reset is not resurrected before db.clear lands. hydrate.ts writes the
  // refreshed marker AFTER awaiting resetColdStartCache, so the post-reset
  // marker write goes through normally.
  if (isClearing) return;
  getMap().set(key, value);
  scheduleFlush(key);
}

// ---- IDB plumbing ----

let dbPromise: Promise<IndexedDBPromised<unknown>> | undefined;

function openDb(): Promise<IndexedDBPromised<unknown>> {
  if (!dbPromise) {
    const db = new IndexedDBPromised({
      name: DB_NAME,
      bucketName: DB_NAME,
      version: DB_VERSION,
      upgrade: ({ nativeDB }) => {
        if (!nativeDB.objectStoreNames.contains(STORE_NAME)) {
          nativeDB.createObjectStore(STORE_NAME);
        }
      },
    });
    const opening = db.open().then(() => db);
    // Clear the cached promise on failure so the next call retries instead
    // of permanently disabling cold-start for the session.
    opening.catch(() => {
      if (dbPromise === opening) {
        dbPromise = undefined;
      }
    });
    dbPromise = opening;
  }
  return dbPromise;
}

// ---- Debounced flush ----

const dirtyKeys = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
// Single-slot mutex: serializes overlapping flushes and lets resetColdStartCache
// await any pending IDB writes before issuing db.clear, so a late-landing put
// cannot resurrect data wiped by reset.
let inFlightFlush: Promise<void> | undefined;
// Tracks how many flush attempts in a row have failed. We stop re-arming the
// retry timer after MAX_CONSECUTIVE_FLUSH_FAILURES so private-mode / quota=0
// environments do not loop forever.
let consecutiveFlushFailures = 0;
const MAX_CONSECUTIVE_FLUSH_FAILURES = 5;
// Latched warning so the "giving up" log fires at most once per page load.
let flushGiveUpWarned = false;
// Lifecycle-listener registration latch; see ensureLifecycleFlushTrigger.
let coldStartTriggerRegistered = false;
// `isClearing` is declared earlier (right after GLOBAL_MAP_KEY) so the
// top-of-file `writeColdStartMeta` export can reference it without a
// no-use-before-define lint failure.

async function runFlushOnce(): Promise<void> {
  if (dirtyKeys.size === 0) return;
  const keys = Array.from(dirtyKeys);
  dirtyKeys.clear();
  const map = getMap();
  try {
    const db = await openDb();
    await Promise.all(
      keys.map((key) => {
        const value = map.get(key);
        if (value === undefined) {
          return db.delete(STORE_NAME, key);
        }
        return db.put(STORE_NAME, value, key);
      }),
    );
    // Success path: clear the retry counter so a future transient failure
    // starts the back-off window fresh.
    consecutiveFlushFailures = 0;
  } catch (e) {
    // Re-queue for next flush window; swallow to keep best-effort semantics.
    for (const k of keys) dirtyKeys.add(k);
    consecutiveFlushFailures += 1;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[webColdStartStorage] flush failed:', e);
    }
    // Re-arm a debounce timer so the requeued keys get another attempt even
    // if no new write comes in. Bail out once we have exceeded the cap so a
    // permanently-broken IDB (private mode, quota=0) does not loop forever.
    if (consecutiveFlushFailures > MAX_CONSECUTIVE_FLUSH_FAILURES) {
      if (!flushGiveUpWarned) {
        flushGiveUpWarned = true;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(
            '[webColdStartStorage] giving up on flush retries after',
            consecutiveFlushFailures,
            'consecutive failures',
          );
        }
      }
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        void flushDirtyKeysToIdb();
      }, FLUSH_DEBOUNCE_MS);
    }
  }
}

// Starts one flush cycle and stores the resulting promise on inFlightFlush.
// Lives outside flushDirtyKeysToIdb's loop body so eslint(no-loop-func) is
// satisfied — the closure that compares `inFlightFlush === wrapped` no
// longer captures a loop-iteration-scoped binding. Returns the wrapped
// promise the caller should await.
function beginFlushCycle(): Promise<void> {
  // Promise.prototype.finally returns a NEW promise distinct from its
  // receiver; comparing inFlightFlush to the receiver would always be false
  // and the cleanup would never run, latching inFlightFlush forever and
  // starving the renderer on the next flush's
  // `while (inFlightFlush) await inFlightFlush` loop with a microtask-only
  // resolved-promise loop.
  const wrapped: Promise<void> = runFlushOnce().finally(() => {
    if (inFlightFlush === wrapped) {
      inFlightFlush = undefined;
    }
  });
  inFlightFlush = wrapped;
  return wrapped;
}

async function flushDirtyKeysToIdb(): Promise<void> {
  // True-drain loop: callers (especially flushColdStartCacheNow from
  // pagehide / visibilitychange) need the guarantee that ALL keys dirtied up
  // to the moment of the await have been persisted before the returned
  // promise resolves. runFlushOnce snapshots+clears dirtyKeys at its top
  // then awaits IDB; writes that arrive during that await accumulate in
  // dirtyKeys and would otherwise be left behind by a single-shot flush.
  // Loop conditions are mutated from runFlushOnce's .finally callback and
  // from concurrent writers, which ESLint cannot see through.
  //
  // Local fuse: when IDB is permanently broken (private mode, quota=0),
  // runFlushOnce re-queues all keys on every cycle and the
  // `dirtyKeys.size > 0` predicate would otherwise stay true forever.
  // `consecutiveFlushFailures` (module-level) only gates the debounce timer
  // re-arm, so it does not stop THIS synchronous drain loop. We track a
  // local copy of the failure counter and bail out cleanly once it crosses
  // the cap — clear dirtyKeys so a subsequent caller does not pick up the
  // same doomed keys, and return so flushColdStartCacheNow() from
  // visibilitychange / pagehide can resolve.
  let localConsecutiveFailures = 0;
  // eslint-disable-next-line no-unmodified-loop-condition
  while (inFlightFlush || dirtyKeys.size > 0) {
    // Always prefer awaiting any in-flight flush over starting a new one,
    // so concurrent callers coalesce instead of stacking cycles.
    const pending = inFlightFlush ?? beginFlushCycle();
    const failuresBeforeCycle = consecutiveFlushFailures;
    try {
      await pending;
    } catch {
      /* errors already handled in runFlushOnce; keep draining */
    }
    // Did this cycle fail? runFlushOnce bumps consecutiveFlushFailures on the
    // catch path and resets it to 0 on success. If the counter increased,
    // count this iteration as a local failure; otherwise reset the local
    // counter so an isolated transient failure does not eventually trip the
    // cap.
    if (consecutiveFlushFailures > failuresBeforeCycle) {
      localConsecutiveFailures += 1;
    } else {
      localConsecutiveFailures = 0;
    }
    if (localConsecutiveFailures > MAX_CONSECUTIVE_FLUSH_FAILURES) {
      // Give up: drop the doomed keys so callers (and a later
      // resetColdStartCache) observe an empty dirtyKeys instead of looping
      // on the same set. The module-level counter / give-up warning already
      // accounts for the visible signal.
      dirtyKeys.clear();
      return;
    }
  }
  // Loop exited cleanly. If we entered the loop with prior failures pinned
  // by a previous caller and our drain successfully emptied dirtyKeys, the
  // success branch of runFlushOnce will already have reset the module
  // counter; nothing to do here.
}

// Lazy lifecycle trigger registration. The visibilitychange / pagehide /
// freeze listeners that drive flushColdStartCacheNow used to be attached
// only from packages/kit-bg's `ensureColdStartAppStateListener`, which runs
// when the first `contextAtom({ coldStartCache: true })` renders. If a user
// closes the tab BEFORE that atom mounts, every L2/L3 dirty write in this
// module sits stranded in memory.
//
// To defend against that, scheduleFlush calls this on the first dirty key
// so the lifecycle listeners are attached as soon as we have something to
// persist. Idempotent — the underlying `registerColdStartFlushTrigger` is
// itself a Set-add so calling it more than once is safe, but we still latch
// here to avoid spamming the import.
function ensureLifecycleFlushTrigger(): void {
  if (coldStartTriggerRegistered) return;
  // Latch FIRST so a require() that ends up re-entering this path during
  // module init cannot recurse.
  coldStartTriggerRegistered = true;
  try {
    // Lazy require avoids leaking the import into module-top-level, which
    // would risk bundler cycles between this module and coldStartFlushTrigger
    // (the latter's listeners may eventually call back into here).
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const { registerColdStartFlushTrigger } =
      require('../coldStartFlushTrigger') as typeof import('../coldStartFlushTrigger');
    registerColdStartFlushTrigger(() => {
      void flushColdStartCacheNow();
    });
  } catch {
    /* trigger not available in this env */
    // Rewind the latch so a later environment (e.g. delayed DOM polyfill in
    // jest) gets another chance to register.
    coldStartTriggerRegistered = false;
  }
}

function scheduleFlush(key: string): void {
  // Suppress writes while resetColdStartCache is mid-wipe. Without this gate
  // a concurrent caller (e.g. swrCacheUtils flushing the SWR cache, or the
  // L2 contextAtom snapshot writer firing during the await db.clear window)
  // can re-add an entry to dirtyKeys that the upcoming flush will then
  // resurrect after db.clear completes. The facade-level no-op (safeSet et
  // al.) is the primary defense; this is belt-and-suspenders for
  // writeColdStartMeta callers that bypass the facade.
  if (isClearing) return;
  dirtyKeys.add(key);
  ensureLifecycleFlushTrigger();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushDirtyKeysToIdb();
  }, FLUSH_DEBOUNCE_MS);
}

/** Force-flush all pending writes immediately. Called by the cross-platform
 *  flush trigger on visibilitychange=hidden / pagehide. */
export function flushColdStartCacheNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  return flushDirtyKeysToIdb();
}

/** Wipe both in-memory map and IDB store. Used on build-hash mismatch
 *  detected by hydrate.ts. */
export async function resetColdStartCache(): Promise<void> {
  // Latch BEFORE the awaits so any concurrent scheduleFlush /
  // safeSet / setObject / delete / clearAll call during the openDb +
  // db.clear windows below becomes a no-op. Without this, a late write
  // (e.g. swrCacheUtils flushing during the await openDb()) would re-fill
  // the map and dirtyKeys with data we are about to wipe; the flush timer
  // would then re-arm and persist the resurrected entries.
  isClearing = true;
  try {
    getMap().clear();
    dirtyKeys.clear();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    // Wait out any flush currently writing to IDB so a late-landing db.put
    // cannot resurrect data wiped by the upcoming db.clear. The loop variable
    // is mutated from runFlushOnce's .finally callback, which ESLint cannot
    // see through.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (inFlightFlush) {
      try {
        await inFlightFlush;
      } catch {
        /* flush errors are already logged inside runFlushOnce */
      }
    }
    try {
      const db = await openDb();
      await db.clear(STORE_NAME);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[webColdStartStorage] resetColdStartCache failed:', e);
      }
    }
    // Defense-in-depth: with the latch held, scheduleFlush and the facade
    // mutators are no-ops, so map / dirtyKeys SHOULD still be empty here.
    // Wipe one more time anyway in case any future caller bypasses both
    // guards (e.g. direct getMap().set(...) outside this module — currently
    // none, but cheap insurance).
    getMap().clear();
    dirtyKeys.clear();
  } finally {
    isClearing = false;
  }
}

/** Awaitable counterpart of the synchronous ISyncStorage.clearAll() facade.
 *  Call sites that need the cold-start cache to be fully wiped (both
 *  in-memory map and IDB) before they reload the page should await this. */
export function awaitColdStartCacheCleared(): Promise<void> {
  return resetColdStartCache();
}

// ---- Direct IDB read used by hydrate.ts (avoid spinning the facade) ----

// Returns raw structured-cloned values for jotai L1 entries (objects, etc.)
// and strings for meta/SWR entries. Legacy DBs written by the previous
// JSON-string implementation are invalidated automatically by the
// BUILD_HASH mismatch path in hydrate.ts — the new commit produces a new
// BUILD_HASH, so any stale JSON-string entries are cleared on first boot.
export async function readAllColdStartEntriesFromIdb(): Promise<
  Map<string, unknown>
> {
  const db = await openDb();
  return db.getAllEntries(STORE_NAME) as Promise<Map<string, unknown>>;
}

// ---- Test-only helpers ----
// Reset all module-level state. Intended for unit tests so each test starts
// from a clean slate without `jest.resetModules()` (which would also re-
// instantiate the lodash import etc.). Not exported from the public surface.
export function __resetForTests(): void {
  (globalThis as Record<string, unknown>)[GLOBAL_MAP_KEY] = undefined;
  // Close any open IDB connection before dropping the reference. Leaving it
  // open keeps fake-indexeddb (and real IDB) holding the database, which then
  // blocks the next test's deleteDatabase (fires onblocked) and leaves a
  // scheduled task that prevents jest's event loop from going idle — an open
  // handle that hangs CI after coverage prints (jest runs without forceExit).
  if (dbPromise) {
    void dbPromise.then((db) => db.close()).catch(() => {});
  }
  dbPromise = undefined;
  dirtyKeys.clear();
  inFlightFlush = undefined;
  consecutiveFlushFailures = 0;
  flushGiveUpWarned = false;
  coldStartTriggerRegistered = false;
  isClearing = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
}

// ---- ISyncStorage facade ----

function toStorageString(value: string | number | boolean): string {
  return String(value);
}

export function createWebColdStartStorage(): ISyncStorage {
  const safeSet = (
    key: EAppSyncStorageKeys,
    value: string | number | boolean | undefined | null,
  ): void => {
    // Drop writes during reset so the wipe-then-clear sequence is atomic
    // from the facade's perspective. See resetColdStartCache for context.
    if (isClearing) return;
    if (value === undefined || value === null) {
      getMap().set(key as string, '');
    } else {
      getMap().set(key as string, toStorageString(value));
    }
    scheduleFlush(key as string);
  };

  return {
    set(key: EAppSyncStorageKeys, value: boolean | string | number) {
      safeSet(key, value);
    },
    setObject<T extends Record<string, any>>(
      key: EAppSyncStorageKeys,
      value: T,
    ) {
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      // Drop writes during reset; see safeSet.
      if (isClearing) return;
      // Facade callers (e.g. swrCacheUtils, context-atom snapshot writer)
      // already model their payload as a JSON-encoded string when reading
      // back via getString. Keep the on-the-wire form symmetric so a write
      // followed by a getString returns parseable JSON.
      getMap().set(key as string, JSON.stringify(value));
      scheduleFlush(key as string);
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      const raw = getMap().get(key as string);
      if (raw === undefined || raw === null || raw === '') return undefined;
      // Fast path: facade writer round-trips JSON, so the common case is a
      // string. Fallback covers the (currently unused) scenario where some
      // future producer stashes a raw object under a facade key.
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as T;
        } catch {
          return undefined;
        }
      }
      return raw as T;
    },
    getString(key: EAppSyncStorageKeys): string | undefined {
      const raw = getMap().get(key as string);
      return typeof raw === 'string' ? raw : undefined;
    },
    getNumber(key: EAppSyncStorageKeys): number | undefined {
      const raw = getMap().get(key as string);
      if (typeof raw !== 'string' || raw === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    },
    getBoolean(key: EAppSyncStorageKeys): boolean | undefined {
      const raw = getMap().get(key as string);
      if (typeof raw !== 'string') return undefined;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0' || raw === '') return false;
      return undefined;
    },
    delete(key: EAppSyncStorageKeys) {
      // Drop deletes during reset — the wipe will remove the key anyway,
      // and queueing a delete here would set up a phantom dirtyKey for a
      // value that no longer exists in the map.
      if (isClearing) return;
      getMap().delete(key as string);
      scheduleFlush(key as string);
    },
    clearAll() {
      // Coalesce overlapping clearAll() calls — if a reset is already in
      // flight, the second one would race with the first against the same
      // db.clear and could thrash the latch.
      if (isClearing) return;
      void resetColdStartCache();
    },
    getAllKeys() {
      return Array.from(getMap().keys());
    },
  };
}
