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
  } catch (e) {
    // Re-queue for next flush window; swallow to keep best-effort semantics.
    for (const k of keys) dirtyKeys.add(k);
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[webColdStartStorage] flush failed:', e);
    }
  }
}

async function flushDirtyKeysToIdb(): Promise<void> {
  // Coalesce concurrent callers onto the in-flight promise, then drain any
  // dirty keys that accumulated while it was running. flushColdStartCacheNow
  // relies on this to guarantee IDB writes have committed before it resolves.
  // The loop variable is mutated from runFlushOnce's .finally callback, which
  // ESLint cannot see through.
  // eslint-disable-next-line no-unmodified-loop-condition
  while (inFlightFlush) {
    await inFlightFlush;
  }
  if (dirtyKeys.size === 0) return;
  // Capture the wrapped promise so the .finally callback can compare to it.
  // Promise.prototype.finally returns a NEW promise distinct from its
  // receiver; comparing inFlightFlush to the receiver would always be false
  // and the cleanup would never run, latching inFlightFlush forever and
  // starving the renderer on the next flush's
  // `while (inFlightFlush) await inFlightFlush` loop with a microtask-only
  // resolved-promise loop.
  // eslint-disable-next-line prefer-const
  let wrapped: Promise<void>;
  wrapped = runFlushOnce().finally(() => {
    if (inFlightFlush === wrapped) {
      inFlightFlush = undefined;
    }
  });
  inFlightFlush = wrapped;
  await wrapped;
}

function scheduleFlush(key: string): void {
  dirtyKeys.add(key);
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
  dbPromise = undefined;
  dirtyKeys.clear();
  inFlightFlush = undefined;
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
      getMap().delete(key as string);
      scheduleFlush(key as string);
    },
    clearAll() {
      void resetColdStartCache();
    },
    getAllKeys() {
      return Array.from(getMap().keys());
    },
  };
}
