// Web/desktop cold-start cache backend. Replaces the no-op stub previously
// returned by `coldStartCacheStorage` on non-native platforms.
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
// is NOT called, so any early setColdStartL1MirrorEntry writes survive and
// missing keys fall through to atom defaults via jotaiInit.

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

function getMap(): Map<string, string> {
  const g = globalThis as Record<string, unknown>;
  let map = g[GLOBAL_MAP_KEY] as Map<string, string> | undefined;
  if (!map) {
    map = new Map<string, string>();
    g[GLOBAL_MAP_KEY] = map;
  }
  return map;
}

/** Merge entries loaded from IDB into the in-memory map. Called by
 *  hydrate.ts after its IDB getAll resolves. */
export function primeColdStartCacheMap(
  entries: Iterable<[string, string]>,
): void {
  const map = getMap();
  for (const [k, v] of entries) {
    // Do NOT clobber entries already written by an early
    // setColdStartL1MirrorEntry call that fired while hydrate.ts was still
    // awaiting IDB. The local map is treated as more authoritative than the
    // stale IDB snapshot for keys present in both.
    if (!map.has(k)) {
      map.set(k, v);
    }
  }
}

/** Write a meta entry (e.g. build hash) bypassing the EAppSyncStorageKeys
 *  type contract. Used by hydrate.ts to refresh the build-hash marker so
 *  the next cold start can detect a deploy-time schema change. */
export function writeColdStartMeta(key: string, value: string): void {
  getMap().set(key, value);
  scheduleFlush(key);
}

const L1_KEY_PREFIX = 'jotai/';

/** Mirror a persisted globalAtom value to the cold-start cache. Called by
 *  the web/desktop branch of jotaiStorage.ts after every successful write
 *  to the source-of-truth JotaiStorage IDB. Key shape: 'jotai/<atomName>',
 *  consumed by hydrate.ts which un-prefixes back into
 *  globalThis.__ONEKEY_JOTAI_INIT_STATES__. */
export function setColdStartL1MirrorEntry(
  atomName: string,
  value: unknown,
): void {
  if (!atomName) return;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return;
  }
  const key = `${L1_KEY_PREFIX}${atomName}`;
  getMap().set(key, serialized);
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
    dbPromise = db.open().then(() => db);
  }
  return dbPromise;
}

// ---- Debounced flush ----

const dirtyKeys = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

async function flushDirtyKeysToIdb(): Promise<void> {
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

// ---- Direct IDB read used by hydrate.ts (avoid spinning the facade) ----

export async function readAllColdStartEntriesFromIdb(): Promise<
  Map<string, string>
> {
  const db = await openDb();
  return db.getAllEntries(STORE_NAME) as Promise<Map<string, string>>;
}

// ---- Test-only helpers ----
// Reset all module-level state. Intended for unit tests so each test starts
// from a clean slate without `jest.resetModules()` (which would also re-
// instantiate the lodash import etc.). Not exported from the public surface.
export function __resetForTests(): void {
  (globalThis as Record<string, unknown>)[GLOBAL_MAP_KEY] = undefined;
  dbPromise = undefined;
  dirtyKeys.clear();
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
      getMap().set(key as string, JSON.stringify(value));
      scheduleFlush(key as string);
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      try {
        const raw = getMap().get(key as string);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    getString(key: EAppSyncStorageKeys): string | undefined {
      return getMap().get(key as string);
    },
    getNumber(key: EAppSyncStorageKeys): number | undefined {
      const raw = getMap().get(key as string);
      if (raw === undefined || raw === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    },
    getBoolean(key: EAppSyncStorageKeys): boolean | undefined {
      const raw = getMap().get(key as string);
      if (raw === undefined) return undefined;
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
