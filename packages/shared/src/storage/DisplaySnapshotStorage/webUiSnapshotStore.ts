/**
 * The web/desktop backing for UI snapshot namespaces.
 *
 * IndexedDB has no synchronous API and `ISnapshotCacheSync` needs one, so a
 * map holds what the page reads and IndexedDB is the durability behind it —
 * the same arrangement the cold-start cache uses, and for the same reason.
 * What differs is the layout: one database for every namespace, keyed
 * `<namespace>:<key>`, rather than a database per namespace. A namespace is
 * cheap to declare that way; on native, where one shared mmap really is the
 * problem, the file-per-namespace build applies instead.
 *
 * The map is authoritative at runtime. A write lands in it immediately and is
 * queued for IndexedDB, so a reload without a flush loses the newest writes
 * and nothing else — which is what a cache is allowed to do.
 */
import { OneKeyLocalError } from '../../errors';
import { IndexedDBPromised } from '../../IndexedDBPromised';

import type { IDisplaySnapshotStorageSyncBackend } from './types';

const DB_NAME = 'onekey-ui-snapshot';
const DB_VERSION = 1;
const RECORD_STORE = 'records';
const FLUSH_DEBOUNCE_MS = 2000;

// Held on globalThis so a second copy of this module — an isolated registry
// in tests, a differently-resolved bundle chunk — still reads one store.
const GLOBAL_MAP_KEY = '__ONEKEY_UI_SNAPSHOT_MAP__';

type IGlobalWithMap = Record<string, unknown>;

function getMap(): Map<string, string> {
  const global = globalThis as IGlobalWithMap;
  let map = global[GLOBAL_MAP_KEY] as Map<string, string> | undefined;
  if (!map) {
    map = new Map<string, string>();
    global[GLOBAL_MAP_KEY] = map;
  }
  return map;
}

export function buildUiSnapshotRecordKey(namespace: string, key: string) {
  return `${namespace}:${key}`;
}

// ---- Durability ----

let databasePromise: Promise<IndexedDBPromised<unknown>> | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushPromise: Promise<void> | undefined;
const dirtyKeys = new Set<string>();
/** While a reset is in flight every write is dropped, so a writer that is
 *  mid-flush cannot put back what the reset is removing. */
let isClearing = false;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = new IndexedDBPromised<unknown>({
        name: DB_NAME,
        bucketName: DB_NAME,
        version: DB_VERSION,
        upgrade: ({ nativeDB }) => {
          if (!nativeDB.objectStoreNames.contains(RECORD_STORE)) {
            nativeDB.createObjectStore(RECORD_STORE);
          }
        },
      });
      await database.open();
      return database;
    })().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function scheduleFlush(key: string) {
  if (isClearing) {
    return;
  }
  dirtyKeys.add(key);
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushUiSnapshotStoreNow();
  }, FLUSH_DEBOUNCE_MS);
}

/** Write every pending key. Deletes go in their own transaction, which is
 *  allowed to run when the quota is exhausted — that is when it matters. */
export function flushUiSnapshotStoreNow(): Promise<void> {
  if (flushPromise) {
    return flushPromise;
  }
  if (dirtyKeys.size === 0) {
    return Promise.resolve();
  }
  const keys = [...dirtyKeys];
  dirtyKeys.clear();
  const next = (async () => {
    const map = getMap();
    const writes: { key: string; value: string }[] = [];
    const removals: string[] = [];
    keys.forEach((key) => {
      const value = map.get(key);
      if (value === undefined) {
        removals.push(key);
      } else {
        writes.push({ key, value });
      }
    });
    try {
      const database = await getDatabase();
      if (writes.length > 0) {
        const transaction = await database.createBucketTransaction(
          [RECORD_STORE],
          'readwrite',
        );
        const store = transaction.objectStore(RECORD_STORE);
        await Promise.all(
          writes.map(({ key, value }) => store.put(value, key)),
        );
        await transaction.done;
      }
      if (removals.length > 0) {
        const transaction = await database.createBucketTransaction(
          [RECORD_STORE],
          'readwrite',
          { allowWhenStorageFull: true },
        );
        const store = transaction.objectStore(RECORD_STORE);
        await Promise.all(removals.map((key) => store.delete(key)));
        await transaction.done;
      }
    } catch {
      // Re-queue so the next flush tries again. A cache that cannot reach
      // disk still serves the page from the map.
      keys.forEach((key) => dirtyKeys.add(key));
    }
  })().finally(() => {
    flushPromise = undefined;
  });
  flushPromise = next;
  return next;
}

/** Load what the last session wrote. Later writes win: priming must not
 *  clobber a value this session has already produced. */
export function primeWebUiSnapshotStore(entries: Iterable<[string, string]>) {
  if (isClearing) {
    return;
  }
  const map = getMap();
  for (const [key, value] of entries) {
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
}

export async function readWebUiSnapshotEntriesFromIdb(): Promise<
  Map<string, string>
> {
  const database = await getDatabase();
  const entries = (await database.getAllEntries(RECORD_STORE)) as Map<
    string,
    unknown
  >;
  const result = new Map<string, string>();
  entries.forEach((value, key) => {
    if (typeof value === 'string') {
      result.set(key, value);
    }
  });
  return result;
}

/** Wipe every namespace. Used by the app's own "clear data", which restarts
 *  afterwards, so nothing needs to survive this. */
export async function resetWebUiSnapshotStore(): Promise<void> {
  isClearing = true;
  try {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    dirtyKeys.clear();
    getMap().clear();
    await flushPromise?.catch(() => undefined);
    const database = await getDatabase();
    const transaction = await database.createBucketTransaction(
      [RECORD_STORE],
      'readwrite',
      { allowWhenStorageFull: true },
    );
    await transaction.objectStore(RECORD_STORE).clear();
    await transaction.done;
  } finally {
    isClearing = false;
  }
}

// ---- Per-namespace backend ----

export function createWebUiSnapshotSyncBackend(
  namespace: string,
): IDisplaySnapshotStorageSyncBackend {
  const recordKey = (key: string) => buildUiSnapshotRecordKey(namespace, key);
  const write = (key: string, value: string) => {
    if (isClearing) {
      return;
    }
    getMap().set(key, value);
    scheduleFlush(key);
  };
  const drop = (key: string) => {
    if (isClearing) {
      return;
    }
    getMap().delete(key);
    scheduleFlush(key);
  };

  return {
    read(key) {
      return getMap().get(recordKey(key));
    },
    readMany(keys) {
      const map = getMap();
      const result = new Map<string, string>();
      keys.forEach((key) => {
        const value = map.get(recordKey(key));
        if (value !== undefined) {
          result.set(key, value);
        }
      });
      return result;
    },
    commit(input) {
      if (input.expectedCommitMarker) {
        const current = getMap().get(recordKey(input.expectedCommitMarker.key));
        if (current !== input.expectedCommitMarker.value) {
          // The caller retries with the manifest it just lost the race to.
          throw new OneKeyLocalError(
            'Display snapshot commit marker changed before commit',
          );
        }
      }
      input.entries.forEach(({ key, value }) => write(recordKey(key), value));
      // The marker is written last for the same reason as on native: a
      // flush cut short must not leave a manifest describing absent records.
      write(recordKey(input.commitMarker.key), input.commitMarker.value);
      input.removeKeys?.forEach((key) => drop(recordKey(key)));
    },
    remove(keys) {
      keys.forEach((key) => drop(recordKey(key)));
    },
    clearNamespace() {
      const prefix = `${namespace}:`;
      [...getMap().keys()]
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => drop(key));
    },
    compact() {
      // IndexedDB owns physical compaction; deleted records are gone with
      // the transaction that removed them.
    },
  };
}

export function __resetWebUiSnapshotStoreForTests() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  dirtyKeys.clear();
  flushPromise = undefined;
  databasePromise = undefined;
  isClearing = false;
  getMap().clear();
}
