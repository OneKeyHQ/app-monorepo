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
/** Consecutive failed flushes. A failure re-queues its keys, so without a
 *  bound the tail below would reopen a permanently broken database every
 *  couple of seconds for the life of the page. Any real write resets it. */
let flushFailureStreak = 0;
const MAX_CONSECUTIVE_FLUSH_RETRIES = 3;

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

function armFlushTimer(delayMs: number) {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushUiSnapshotStoreNow();
  }, delayMs);
}

function scheduleFlush(key: string) {
  if (isClearing) {
    return;
  }
  dirtyKeys.add(key);
  // A fresh write earns the store another round of attempts: this is the
  // point a previously unreachable database is worth trying again.
  flushFailureStreak = 0;
  armFlushTimer(FLUSH_DEBOUNCE_MS);
}

/** Write every pending key. Deletes go in their own transaction, which is
 *  allowed to run when the quota is exhausted, and which runs even when the
 *  write before it failed — that is when it matters. */
export function flushUiSnapshotStoreNow(): Promise<void> {
  if (flushPromise) {
    // The in-flight flush took its key list when it started, so it does not
    // carry what the caller just wrote. Waiting on it alone would report the
    // caller's record durable while it is still only in the map. Chain a
    // second pass instead; it stops at the empty check below when there is
    // nothing left, so this is one extra flush, not a loop.
    return flushPromise.then(() => flushUiSnapshotStoreNow());
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
    // Collected per phase rather than from `keys`: a write the quota rejected
    // has to come back, and a delete that already landed must not — re-queuing
    // it would keep the store dirty and spend the retry budget below on
    // records that are gone.
    const failedKeys: string[] = [];
    let database: IndexedDBPromised<unknown> | undefined;
    try {
      database = await getDatabase();
    } catch {
      // Nothing reaches disk this round, writes and deletes alike.
      failedKeys.push(...keys);
    }
    if (database && writes.length > 0) {
      try {
        const transaction = await database.createBucketTransaction(
          [RECORD_STORE],
          'readwrite',
        );
        const store = transaction.objectStore(RECORD_STORE);
        await Promise.all(
          writes.map(({ key, value }) => store.put(value, key)),
        );
        await transaction.done;
      } catch {
        failedKeys.push(...writes.map(({ key }) => key));
      }
    }
    if (database && removals.length > 0) {
      // Deliberately outside the write's failure path. An exhausted quota
      // rejects the write transaction before it opens, and deleting is how
      // the page gives that space back, so a failed write is exactly when
      // this still has to run.
      try {
        const transaction = await database.createBucketTransaction(
          [RECORD_STORE],
          'readwrite',
          { allowWhenStorageFull: true },
        );
        const store = transaction.objectStore(RECORD_STORE);
        await Promise.all(removals.map((key) => store.delete(key)));
        await transaction.done;
      } catch {
        failedKeys.push(...removals);
      }
    }
    if (failedKeys.length === 0) {
      flushFailureStreak = 0;
      return;
    }
    // Re-queue so the next flush tries again. A cache that cannot reach
    // disk still serves the page from the map.
    flushFailureStreak += 1;
    failedKeys.forEach((key) => dirtyKeys.add(key));
  })().finally(() => {
    flushPromise = undefined;
    if (isClearing) {
      return;
    }
    if (dirtyKeys.size === 0) {
      // A chained explicit flush can drain the queue after an earlier tail
      // armed the timer; that timer would only wake to find nothing.
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
      return;
    }
    if (flushFailureStreak === 0) {
      // Written while this flush ran. The timer that would have covered them
      // already fired into this flush, so nothing else is scheduled for them.
      armFlushTimer(FLUSH_DEBOUNCE_MS);
      return;
    }
    if (flushFailureStreak <= MAX_CONSECUTIVE_FLUSH_RETRIES) {
      armFlushTimer(FLUSH_DEBOUNCE_MS * flushFailureStreak);
    }
    // Past the cap the keys stay queued and the map keeps serving them; the
    // next real write is what tries the database again.
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

/**
 * Load records from IndexedDB.
 *
 * With `namespaces`, only those are read, one key range each: records are
 * stored sorted by key, so a range is a seek and a sequential read rather
 * than a scan. That is what lets the startup path load the one namespace the
 * first frame needs without paying for the rest.
 */
export async function readWebUiSnapshotEntriesFromIdb(options?: {
  namespaces?: readonly string[];
}): Promise<Map<string, string>> {
  const database = await getDatabase();
  const result = new Map<string, string>();
  const collect = (key: unknown, value: unknown) => {
    if (typeof key === 'string' && typeof value === 'string') {
      result.set(key, value);
    }
  };
  if (!options?.namespaces) {
    const entries = (await database.getAllEntries(RECORD_STORE)) as Map<
      string,
      unknown
    >;
    entries.forEach((value, key) => collect(key, value));
    return result;
  }
  const transaction = await database.createBucketTransaction(
    [RECORD_STORE],
    'readonly',
  );
  const store = transaction.objectStore(RECORD_STORE);
  await Promise.all(
    options.namespaces.map(async (namespace) => {
      const range = IDBKeyRange.bound(
        `${namespace}:`,
        `${namespace};`,
        false,
        true,
      );
      const [keys, values] = await Promise.all([
        store.getAllKeys(range),
        store.getAll(range),
      ]);
      keys.forEach((key, index) => collect(key, values[index]));
    }),
  );
  await transaction.done;
  return result;
}

/**
 * Markers that describe the store itself rather than a namespace's records —
 * the build hash the hydration compares against. Written without a manifest
 * because nothing retains them and the startup path reads them before any
 * namespace exists.
 */
export const UI_SNAPSHOT_META_NAMESPACE = 'ui-snapshot-meta';

export function readUiSnapshotMeta(key: string): string | undefined {
  return getMap().get(
    buildUiSnapshotRecordKey(UI_SNAPSHOT_META_NAMESPACE, key),
  );
}

export function writeUiSnapshotMeta(key: string, value: string): void {
  if (isClearing) {
    return;
  }
  const recordKey = buildUiSnapshotRecordKey(UI_SNAPSHOT_META_NAMESPACE, key);
  getMap().set(recordKey, value);
  scheduleFlush(recordKey);
}

/** Wipe every namespace. Used by the app's own "clear data", which restarts
 *  afterwards, and by a build whose stored shapes no longer match. */
export async function resetWebUiSnapshotStore(): Promise<void> {
  isClearing = true;
  try {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    dirtyKeys.clear();
    flushFailureStreak = 0;
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
  flushFailureStreak = 0;
  getMap().clear();
}
