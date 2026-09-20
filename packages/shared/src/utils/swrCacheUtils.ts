/* cspell:ignore ISWR IMMKV */
import { isEqual } from 'lodash';

import { defaultLogger } from '../logger/logger';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import {
  SWR_ACCOUNT_SELECTOR_MAX_ENTRIES,
  SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS,
  SWR_CACHE_MAX_ENTRIES,
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
  SWR_CACHE_MAX_SERIALIZED_CHARS,
  SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS,
  isValidSWRCacheKey,
} from './swrCacheLimits';

import type * as HL from '../../types/hyperliquid/sdk';
import type { ISyncStorage } from '../storage/instance/syncStorageInstance';
import type {
  INativeSWRCacheCanonicalEntry,
  INativeSWRCacheEntriesListener,
  INativeSWRCachePatchIntent,
  INativeSWRCacheSerializedEntry,
} from '../storage/nativeStorageTypes';
import type { EAppSWRCacheScopes } from '../storage/syncStorageKeys';

export {
  SWR_CACHE_MAX_ENTRIES,
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
  SWR_CACHE_MAX_SERIALIZED_CHARS,
  isValidSWRCacheKey,
};

// SWR cache uses the dedicated cold-start cache MMKV instance,
// separate from onekey-app-setting.
type ISWREntry<T = any> = {
  /** data */
  d: T;
  /** timestamp (ms) */
  t: number;
};

type ISWRStore = Record<string, ISWREntry>;

const SWR_CACHE_CAPACITY_LOG_COOLDOWN_MS = 10 * 60_000;
const SWR_CACHE_CAPACITY_LOG_MAX_NAMESPACES = 8;

export type ISWRCacheCapacityLimitReason =
  | 'bootstrapEntryCountLimit'
  | 'bootstrapSizeLimit'
  | 'entryCountLimit'
  | 'entryLimit'
  | 'keyLimit'
  | 'totalSizeLimit';

export type ISWRCacheCapacityDrop = {
  entrySerializedChars?: number;
  key: string;
  reason: ISWRCacheCapacityLimitReason;
};

type ISWRCacheCapacityLogState = {
  affectedEntryCount: number;
  eventCount: number;
  lastLoggedAt?: number;
  maxObservedEntrySerializedChars: number;
  namespaces: Set<string>;
};

const swrCacheCapacityLogStates = new Map<
  ISWRCacheCapacityLimitReason,
  ISWRCacheCapacityLogState
>();

type IPrunableSWREntry = { t?: number };

type IPruneSWRCacheStoreOptions = {
  maxEntries?: number;
  maxEntrySerializedChars?: number;
  maxSerializedChars?: number;
};

type ISerializedSWRCacheEntry<T extends IPrunableSWREntry> = {
  entry: T;
  entrySerializedChars: number;
  index: number;
  key: string;
  // Absent for entries adopted from a native mirror, which never re-joins them.
  pair?: string;
  serializedChars: number;
  updatedAt: number;
};

type ISWRCacheBudgets = {
  maxEntries: number;
  maxEntrySerializedChars: number;
  maxSerializedChars: number;
};

function serializeSWRCacheEntry<T extends IPrunableSWREntry>(
  key: string,
  entry: T,
): ISerializedSWRCacheEntry<T> | undefined {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return undefined;
  }
  try {
    const serializedEntry = JSON.stringify(entry);
    if (typeof serializedEntry !== 'string') {
      return undefined;
    }
    const pair = `${JSON.stringify(key)}:${serializedEntry}`;
    return {
      entry,
      entrySerializedChars: serializedEntry.length,
      index: 0,
      key,
      pair,
      serializedChars: pair.length,
      updatedAt: typeof entry.t === 'number' ? entry.t : 0,
    };
  } catch {
    return undefined;
  }
}

function resolveSWRCacheBudgets(
  options?: IPruneSWRCacheStoreOptions,
): ISWRCacheBudgets {
  return {
    maxEntries: options?.maxEntries ?? SWR_CACHE_MAX_ENTRIES,
    maxEntrySerializedChars:
      options?.maxEntrySerializedChars ?? SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars:
      options?.maxSerializedChars ?? SWR_CACHE_MAX_SERIALIZED_CHARS,
  };
}

// Newest first within the count and size budgets, account scopes on their
// own budget, then back in the original order. Reports every drop.
function retainSWRCacheCandidates<T extends IPrunableSWREntry>(
  candidates: ISerializedSWRCacheEntry<T>[],
  budgets: ISWRCacheBudgets,
  removedKeys: string[],
  capacityDrops: ISWRCacheCapacityDrop[],
): ISerializedSWRCacheEntry<T>[] {
  const { maxEntries, maxEntrySerializedChars, maxSerializedChars } = budgets;
  candidates.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || right.index - left.index,
  );

  const retained: ISerializedSWRCacheEntry<T>[] = [];
  let totalSerializedChars = 2;
  let accountSelectorEntries = 0;
  let accountSelectorSerializedChars = 2;
  const accountSelectorDrops: ISWRCacheCapacityDrop[] = [];
  candidates.forEach((candidate) => {
    const separatorChars = retained.length > 0 ? 1 : 0;
    const isAccountSelector = isAccountSelectorCacheKey(candidate.key);
    const accountSeparatorChars = accountSelectorEntries > 0 ? 1 : 0;
    if (
      isAccountSelector &&
      (accountSelectorEntries >= SWR_ACCOUNT_SELECTOR_MAX_ENTRIES ||
        accountSelectorSerializedChars +
          accountSeparatorChars +
          candidate.serializedChars >
          SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS)
    ) {
      removedKeys.push(candidate.key);
      accountSelectorDrops.push({
        entrySerializedChars: candidate.entrySerializedChars,
        key: candidate.key,
        reason:
          accountSelectorEntries >= SWR_ACCOUNT_SELECTOR_MAX_ENTRIES
            ? 'entryCountLimit'
            : 'totalSizeLimit',
      });
      return;
    }
    let reason: ISWRCacheCapacityLimitReason | undefined;
    if (retained.length >= maxEntries) {
      reason = 'entryCountLimit';
    } else if (
      totalSerializedChars + separatorChars + candidate.serializedChars >
      maxSerializedChars
    ) {
      reason = 'totalSizeLimit';
    }
    if (reason) {
      removedKeys.push(candidate.key);
      capacityDrops.push({
        entrySerializedChars: candidate.entrySerializedChars,
        key: candidate.key,
        reason,
      });
    } else {
      retained.push(candidate);
      totalSerializedChars += separatorChars + candidate.serializedChars;
      if (isAccountSelector) {
        accountSelectorEntries += 1;
        accountSelectorSerializedChars +=
          accountSeparatorChars + candidate.serializedChars;
      }
    }
  });
  retained.sort((left, right) => left.index - right.index);

  reportSWRCacheCapacityDrops(capacityDrops, {
    maxEntries,
    maxEntrySerializedChars,
    maxSerializedChars,
    retainedEntryCount: retained.length,
    retainedSerializedChars: totalSerializedChars,
  });
  reportSWRCacheCapacityDrops(accountSelectorDrops, {
    maxEntries: SWR_ACCOUNT_SELECTOR_MAX_ENTRIES,
    maxEntrySerializedChars,
    maxSerializedChars: SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS,
    retainedEntryCount: accountSelectorEntries,
    retainedSerializedChars: accountSelectorSerializedChars,
  });
  return retained;
}

export function pruneSWRCacheStore<T extends IPrunableSWREntry>(
  store: Record<string, T>,
  options?: IPruneSWRCacheStoreOptions,
): {
  removedKeys: string[];
  serialized: string;
  store: Record<string, T>;
} {
  const budgets = resolveSWRCacheBudgets(options);
  const removedKeys: string[] = [];
  const capacityDrops: ISWRCacheCapacityDrop[] = [];
  const candidates: ISerializedSWRCacheEntry<T>[] = [];

  Object.entries(store).forEach(([key, entry], index) => {
    if (!isValidSWRCacheKey(key)) {
      removedKeys.push(key);
      capacityDrops.push({ key, reason: 'keyLimit' });
      return;
    }
    const serializedEntry = serializeSWRCacheEntry(key, entry);
    if (!serializedEntry) {
      removedKeys.push(key);
      return;
    }
    if (
      serializedEntry.entrySerializedChars > budgets.maxEntrySerializedChars
    ) {
      removedKeys.push(key);
      capacityDrops.push({
        entrySerializedChars: serializedEntry.entrySerializedChars,
        key,
        reason: 'entryLimit',
      });
      return;
    }
    serializedEntry.index = index;
    candidates.push(serializedEntry);
  });

  const retained = retainSWRCacheCandidates(
    candidates,
    budgets,
    removedKeys,
    capacityDrops,
  );

  const retainedStore = {} as Record<string, T>;
  retained.forEach(({ entry, key }) => {
    Object.defineProperty(retainedStore, key, {
      configurable: true,
      enumerable: true,
      value: entry,
      writable: true,
    });
  });

  return {
    removedKeys,
    serialized: `{${retained
      .map(
        ({ entry, key, pair }) =>
          pair ?? `${JSON.stringify(key)}:${JSON.stringify(entry)}`,
      )
      .join(',')}}`,
    store: retainedStore,
  };
}

let _syncStorage: ISyncStorage | undefined;
let _cache: ISWRStore | undefined;
let _nativeEntriesSubscribed = false;
let _nativeEntriesSource: INativeSWRCacheEntriesSource | null | undefined;
let _cacheEntrySerializedChars = new Map<string, number>();
let _cacheSerializedChars = 2;
let _dirty = false;
let _flushTimer: ReturnType<typeof setTimeout> | undefined;
// Keyed by target: a reload performed for one book must not suppress the first
// read of another, which the other runtime may have persisted in between.
const _lastReloadForTargetAt = new Map<string, number>();

// Replaying the whole hydrated store instead would revive keys the other
// runtime removed after this JS heap took its snapshot.
const _updatedKeys = new Set<string>();

// Without these, the copy still sitting on disk would revive a key deleted here.
const _removedKeysAt = new Map<string, number>();
let _removedPrefixesAt: Array<{ prefix: string; at: number }> = [];
let _clearedAllAt = 0;

function isDeletedLocally(key: string, diskTimestamp: number): boolean {
  if (_clearedAllAt && diskTimestamp <= _clearedAllAt) return true;
  const removedAt = _removedKeysAt.get(key);
  if (removedAt !== undefined && diskTimestamp <= removedAt) return true;
  for (const removed of _removedPrefixesAt) {
    if (key.startsWith(removed.prefix) && diskTimestamp <= removed.at) {
      return true;
    }
  }
  return false;
}

const FLUSH_DEBOUNCE_MS = 2000;

function getSyncStorage(): ISyncStorage {
  if (!_syncStorage) {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { coldStartCacheStorage } =
      require('../storage/instance/syncStorageInstance') as typeof import('../storage/instance/syncStorageInstance');
    _syncStorage = coldStartCacheStorage;
  }
  return _syncStorage;
}

type INativeSWRCacheEntriesSource = {
  applyPatch: (patch: INativeSWRCachePatchIntent) => void | Promise<void>;
  read: () => INativeSWRCacheSerializedEntry[];
  subscribe: (listener: INativeSWRCacheEntriesListener) => () => void;
};

// Native main: the mirror holds one serialized entry per key and reports
// what bg changed, so this copy is kept current without whole-store reads.
// The runtime storage wrapper declares every optional capability and forwards
// it with `?.`, so presence proves nothing: only a backend that implements the
// read answers with an array. Detected once per runtime.
function getNativeSWRCacheEntriesSource():
  | INativeSWRCacheEntriesSource
  | undefined {
  if (_nativeEntriesSource !== undefined) {
    return _nativeEntriesSource ?? undefined;
  }
  const { applySWRCachePatch, readSWRCacheEntries, subscribeSWRCacheEntries } =
    getSyncStorage();
  const entries = readSWRCacheEntries?.();
  _nativeEntriesSource =
    applySWRCachePatch &&
    readSWRCacheEntries &&
    subscribeSWRCacheEntries &&
    Array.isArray(entries)
      ? {
          applyPatch: applySWRCachePatch,
          read: () => readSWRCacheEntries() ?? [],
          subscribe: subscribeSWRCacheEntries,
        }
      : null;
  return _nativeEntriesSource ?? undefined;
}

function parseSerializedSWRCacheEntry(
  key: string,
  serialized: string,
): ISerializedSWRCacheEntry<ISWREntry> | undefined {
  try {
    const entry = JSON.parse(serialized) as unknown;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return undefined;
    }
    const updatedAt = (entry as ISWREntry).t;
    return {
      entry: entry as ISWREntry,
      entrySerializedChars: serialized.length,
      index: 0,
      key,
      serializedChars: JSON.stringify(key).length + 1 + serialized.length,
      updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
    };
  } catch {
    return undefined;
  }
}

function hydrateFromNativeEntries(
  source: INativeSWRCacheEntriesSource,
): ISWRStore {
  const removedKeys: string[] = [];
  const capacityDrops: ISWRCacheCapacityDrop[] = [];
  const candidates: ISerializedSWRCacheEntry<ISWREntry>[] = [];
  source.read().forEach(([key, serialized], index) => {
    if (!isValidSWRCacheKey(key)) {
      capacityDrops.push({ key, reason: 'keyLimit' });
      return;
    }
    if (serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS) {
      capacityDrops.push({
        entrySerializedChars: serialized.length,
        key,
        reason: 'entryLimit',
      });
      return;
    }
    const candidate = parseSerializedSWRCacheEntry(key, serialized);
    if (!candidate) {
      return;
    }
    candidate.index = index;
    candidates.push(candidate);
  });
  const retained = retainSWRCacheCandidates(
    candidates,
    resolveSWRCacheBudgets(),
    removedKeys,
    capacityDrops,
  );
  const store: ISWRStore = {};
  _cacheEntrySerializedChars = new Map();
  _cacheSerializedChars = 2;
  retained.forEach((candidate) => setCachedEntry(store, candidate));
  if (removedKeys.length > 0) {
    const removedAt = Date.now();
    removedKeys.forEach((key) => {
      _updatedKeys.delete(key);
      _removedKeysAt.set(key, removedAt);
    });
    _dirty = true;
  }
  return store;
}

// The mirror was primed again (bootstrap or bg restart): rebuild from it,
// keeping this runtime's not yet flushed writes and deletions on top.
function rehydrateFromNativeEntries(source: INativeSWRCacheEntriesSource) {
  const previous = _cache;
  const store = hydrateFromNativeEntries(source);
  _cache = store;
  if (!previous) {
    return;
  }
  for (const key of _updatedKeys) {
    const entry = previous[key];
    const candidate = entry ? serializeSWRCacheEntry(key, entry) : undefined;
    if (candidate) {
      setCachedEntry(store, candidate);
    }
  }
  for (const key of Object.keys(store)) {
    if (!_updatedKeys.has(key) && isDeletedLocally(key, store[key].t ?? 0)) {
      removeCachedEntry(store, key);
    }
  }
}

// Same precedence as the flush merge: a pending local write beats anything
// older, a local deletion beats anything not newer than it.
function adoptNativeCanonicalEntries(entries: INativeSWRCacheCanonicalEntry[]) {
  const store = _cache;
  if (!store) {
    return;
  }
  entries.forEach(([key, serialized]) => {
    if (!isValidSWRCacheKey(key)) {
      return;
    }
    const incoming =
      serialized === null ||
      serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS
        ? undefined
        : parseSerializedSWRCacheEntry(key, serialized);
    if (serialized !== null && !incoming) {
      return;
    }
    if (_updatedKeys.has(key)) {
      const local = store[key];
      if (!incoming || (local && (local.t ?? 0) >= incoming.updatedAt)) {
        return;
      }
      _updatedKeys.delete(key);
      setCachedEntry(store, incoming);
      return;
    }
    if (!incoming) {
      removeCachedEntry(store, key);
      return;
    }
    if (isDeletedLocally(key, incoming.updatedAt)) {
      return;
    }
    setCachedEntry(store, incoming);
  });
}

function subscribeToNativeEntries(source: INativeSWRCacheEntriesSource) {
  if (_nativeEntriesSubscribed) {
    return;
  }
  _nativeEntriesSubscribed = true;
  source.subscribe((entries) => {
    if (entries === null) {
      rehydrateFromNativeEntries(source);
    } else {
      adoptNativeCanonicalEntries(entries);
    }
  });
}

function loadStore(): ISWRStore {
  if (_cache !== undefined) return _cache;
  try {
    const nativeEntries = getNativeSWRCacheEntriesSource();
    if (nativeEntries) {
      _cache = hydrateFromNativeEntries(nativeEntries);
      subscribeToNativeEntries(nativeEntries);
    } else {
      const loaded =
        getSyncStorage().getObject<ISWRStore>(
          EAppSyncStorageKeys.onekey_swr_cache,
        ) ?? {};
      _cache = adoptPrunedStore(loaded);
    }
    if (_dirty) {
      scheduleFlush();
    }
  } catch {
    _cache = {};
    resetCacheSerializedChars(_cache);
  }
  return _cache;
}

// getObject() reports an unparseable store and an absent one identically, and
// treating corruption as absent would let flush() drop everything else.
function readStoreFromDisk(): {
  store: ISWRStore | undefined;
  unreadable: boolean;
  rawChars: number;
} {
  let raw: string | undefined;
  try {
    raw = getSyncStorage().getString(EAppSyncStorageKeys.onekey_swr_cache);
  } catch {
    return { store: undefined, unreadable: true, rawChars: 0 };
  }
  if (!raw) {
    return { store: undefined, unreadable: false, rawChars: 0 };
  }
  const rawChars = raw.length;
  try {
    return { store: JSON.parse(raw) as ISWRStore, unreadable: false, rawChars };
  } catch {
    return { store: undefined, unreadable: true, rawChars };
  }
}

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

type IHermesHeapStats = {
  gcCount: number;
  gcTimeSeconds: number;
  heapBytes: number;
  totalAllocatedBytes: number;
};

// Hermes only; every counter is cumulative since the VM was created.
function readHermesHeapStats(): IHermesHeapStats | undefined {
  const hermes = (
    globalThis as {
      HermesInternal?: {
        getInstrumentedStats?: () => Record<string, unknown>;
      };
    }
  ).HermesInternal;
  let stats: Record<string, unknown> | undefined;
  try {
    stats = hermes?.getInstrumentedStats?.();
  } catch {
    return undefined;
  }
  if (!stats) {
    return undefined;
  }
  const gcCount = stats.js_numGCs;
  const gcTimeSeconds = stats.js_gcTime;
  const heapBytes = stats.js_heapSize;
  const totalAllocatedBytes = stats.js_totalAllocatedBytes;
  if (
    typeof gcCount !== 'number' ||
    typeof gcTimeSeconds !== 'number' ||
    typeof heapBytes !== 'number' ||
    typeof totalAllocatedBytes !== 'number'
  ) {
    return undefined;
  }
  return { gcCount, gcTimeSeconds, heapBytes, totalAllocatedBytes };
}

// What the timed operation allocated and how much GC it paid for; empty on
// runtimes without the stats so the log line stays unchanged there.
function diffHermesHeapStats(before: IHermesHeapStats | undefined) {
  const after = before ? readHermesHeapStats() : undefined;
  if (!before || !after) {
    return {};
  }
  return {
    heapBytes: after.heapBytes,
    allocatedBytes: after.totalAllocatedBytes - before.totalAllocatedBytes,
    gcCount: after.gcCount - before.gcCount,
    // Hermes reports cumulative GC wall time in seconds.
    gcMs: Math.round((after.gcTimeSeconds - before.gcTimeSeconds) * 1000),
  };
}

function reloadFromStorage(): void {
  if (getNativeSWRCacheEntriesSource()) {
    // The mirror subscription already delivered every bg write; only this
    // runtime's own pending writes are outstanding.
    flush();
    return;
  }
  flush();
  const startedAt = perfNow();
  const heapBefore = readHermesHeapStats();
  const { store, unreadable, rawChars } = readStoreFromDisk();
  if (unreadable && _cache && Object.keys(_cache).length > 0) {
    // Repairing from an empty copy instead would leave a parseable empty
    // store, costing the runtime holding a full copy its only chance.
    //
    // Every key is marked pending, not just the dirty ones: if the other
    // runtime makes the file parseable again before this flush lands, the
    // merge would otherwise carry nothing forward and the adoption would drop
    // this copy from memory as well.
    for (const key of Object.keys(_cache)) {
      _updatedKeys.add(key);
    }
    _dirty = true;
    scheduleFlush();
  } else if (store) {
    // Only when a store was actually read: on a backend that persists nothing
    // this copy is the only one, and the perps first-frame path reloads every
    // 30s, so clearing here would drop every namespace for the session.
    _cache = adoptPrunedStore(store);
    if (_dirty) {
      scheduleFlush();
    }
  }
  const durationMs = Math.round(perfNow() - startedAt);
  if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
    defaultLogger.app.perf.swrCacheSlowOp({
      op: 'reload',
      durationMs,
      storeChars: rawChars,
      entryCount: _cacheEntrySerializedChars.size,
      ...diffHermesHeapStats(heapBefore),
    });
  }
}

function shouldReloadForTarget(targetKey: string, intervalMs: number): boolean {
  const lastAt = _lastReloadForTargetAt.get(targetKey);
  const now = Date.now();
  return lastAt === undefined || now < lastAt || now - lastAt >= intervalMs;
}

function markReloadForTarget(targetKey: string, intervalMs: number): void {
  const now = Date.now();
  // Entries this old can no longer suppress anything, so dropping them keeps
  // switching across many books from growing the map without bound.
  for (const [key, at] of _lastReloadForTargetAt) {
    if (now - at >= intervalMs) {
      _lastReloadForTargetAt.delete(key);
    }
  }
  _lastReloadForTargetAt.set(targetKey, now);
}

function resetCacheSerializedChars(store: ISWRStore) {
  _cacheEntrySerializedChars = new Map();
  _cacheSerializedChars = 2;
  Object.entries(store).forEach(([key, entry]) => {
    const serializedEntry = serializeSWRCacheEntry(key, entry);
    if (!serializedEntry) {
      return;
    }
    if (_cacheEntrySerializedChars.size > 0) {
      _cacheSerializedChars += 1;
    }
    _cacheEntrySerializedChars.set(key, serializedEntry.serializedChars);
    _cacheSerializedChars += serializedEntry.serializedChars;
  });
}

function removeCachedEntry(store: ISWRStore, key: string) {
  const serializedChars = _cacheEntrySerializedChars.get(key);
  if (serializedChars !== undefined) {
    const entryCount = _cacheEntrySerializedChars.size;
    _cacheEntrySerializedChars.delete(key);
    _cacheSerializedChars -= serializedChars + (entryCount > 1 ? 1 : 0);
  }
  delete store[key];
}

function setCachedEntry(
  store: ISWRStore,
  serializedEntry: ISerializedSWRCacheEntry<ISWREntry>,
) {
  const previousSerializedChars = _cacheEntrySerializedChars.get(
    serializedEntry.key,
  );
  if (previousSerializedChars === undefined) {
    if (_cacheEntrySerializedChars.size > 0) {
      _cacheSerializedChars += 1;
    }
    _cacheSerializedChars += serializedEntry.serializedChars;
  } else {
    _cacheSerializedChars +=
      serializedEntry.serializedChars - previousSerializedChars;
  }
  _cacheEntrySerializedChars.set(
    serializedEntry.key,
    serializedEntry.serializedChars,
  );
  Object.defineProperty(store, serializedEntry.key, {
    configurable: true,
    enumerable: true,
    value: serializedEntry.entry,
    writable: true,
  });
}

function evictOldestOverBudget(store: ISWRStore, removedAt: number) {
  const sorted = Object.keys(store).toSorted(
    (a, b) => (store[a].t ?? 0) - (store[b].t ?? 0),
  );
  const capacityDrops: ISWRCacheCapacityDrop[] = [];
  let index = 0;
  while (
    index < sorted.length &&
    (_cacheEntrySerializedChars.size > SWR_CACHE_MAX_ENTRIES ||
      _cacheSerializedChars > SWR_CACHE_MAX_SERIALIZED_CHARS)
  ) {
    const key = sorted[index];
    const reason: ISWRCacheCapacityLimitReason =
      _cacheEntrySerializedChars.size > SWR_CACHE_MAX_ENTRIES
        ? 'entryCountLimit'
        : 'totalSizeLimit';
    capacityDrops.push({ key, reason });
    removeCachedEntry(store, key);
    _updatedKeys.delete(key);
    _removedKeysAt.set(key, removedAt);
    index += 1;
  }
  reportSWRCacheCapacityDrops(capacityDrops, {
    maxEntries: SWR_CACHE_MAX_ENTRIES,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
    retainedEntryCount: _cacheEntrySerializedChars.size,
    retainedSerializedChars: _cacheSerializedChars,
  });
}

function evictOldestAccountSelectorEntries(
  store: ISWRStore,
  removedAt: number,
) {
  const keys = Object.keys(store)
    .filter(isAccountSelectorCacheKey)
    .toSorted((a, b) => (store[a].t ?? 0) - (store[b].t ?? 0));
  let count = keys.length;
  let serializedChars =
    2 +
    Math.max(0, count - 1) +
    keys.reduce(
      (sum, key) => sum + (_cacheEntrySerializedChars.get(key) ?? 0),
      0,
    );
  const drops: ISWRCacheCapacityDrop[] = [];
  for (const key of keys) {
    if (
      count <= SWR_ACCOUNT_SELECTOR_MAX_ENTRIES &&
      serializedChars <= SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS
    ) {
      break;
    }
    drops.push({
      key,
      reason:
        count > SWR_ACCOUNT_SELECTOR_MAX_ENTRIES
          ? 'entryCountLimit'
          : 'totalSizeLimit',
    });
    serializedChars -=
      (_cacheEntrySerializedChars.get(key) ?? 0) + (count > 1 ? 1 : 0);
    count -= 1;
    removeCachedEntry(store, key);
    _updatedKeys.delete(key);
    _removedKeysAt.set(key, removedAt);
  }
  reportSWRCacheCapacityDrops(drops, {
    maxEntries: SWR_ACCOUNT_SELECTOR_MAX_ENTRIES,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars: SWR_ACCOUNT_SELECTOR_MAX_SERIALIZED_CHARS,
    retainedEntryCount: count,
    retainedSerializedChars: serializedChars,
  });
}

function adoptPrunedStore(store: ISWRStore): ISWRStore {
  const result = pruneSWRCacheStore(store);
  resetCacheSerializedChars(result.store);
  if (result.removedKeys.length > 0) {
    const removedAt = Date.now();
    result.removedKeys.forEach((key) => {
      _updatedKeys.delete(key);
      if (isValidSWRCacheKey(key)) {
        _removedKeysAt.set(key, removedAt);
      }
    });
    _dirty = true;
  }
  return result.store;
}

function buildNativeSWRCachePatch() {
  const patch: INativeSWRCachePatchIntent = {
    ...(Number.isSafeInteger(_clearedAllAt) && _clearedAllAt > 0
      ? { clearBefore: _clearedAllAt }
      : {}),
    removePrefixes: [..._removedPrefixesAt],
    removals: [..._removedKeysAt],
    updates: [..._updatedKeys].flatMap((key) => {
      const entry = _cache?.[key];
      if (!entry) {
        return [];
      }
      return [[key, JSON.stringify(entry)] as const];
    }),
  };
  const patchChars = patch.updates.reduce(
    (sum, [, value]) => sum + value.length,
    0,
  );
  return { patch, patchChars };
}

function clearPendingIntents() {
  _updatedKeys.clear();
  _removedKeysAt.clear();
  _removedPrefixesAt = [];
  _clearedAllAt = 0;
  _dirty = false;
}

// Only the changed entries are serialized; the mirror applies them per key
// and bg's acknowledgement comes back through the subscription.
function flushToNativeEntries(source: INativeSWRCacheEntriesSource) {
  try {
    const startedAt = perfNow();
    const heapBefore = readHermesHeapStats();
    const updatedKeyCount = _updatedKeys.size;
    const { patch, patchChars } = buildNativeSWRCachePatch();
    // A pending write that bg since superseded leaves nothing to send.
    if (
      patch.clearBefore !== undefined ||
      patch.removePrefixes.length > 0 ||
      patch.removals.length > 0 ||
      patch.updates.length > 0
    ) {
      void source.applyPatch(patch);
    }
    clearPendingIntents();
    const durationMs = Math.round(perfNow() - startedAt);
    if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
      defaultLogger.app.perf.swrCacheSlowOp({
        op: 'flush',
        durationMs,
        storeChars: _cacheSerializedChars,
        entryCount: _cacheEntrySerializedChars.size,
        readMs: 0,
        pruneMs: 0,
        patchMs: durationMs,
        adoptMs: 0,
        updatedKeyCount,
        patchChars,
        ...diffHermesHeapStats(heapBefore),
      });
    }
  } catch {
    // Mirror apply failure is non-fatal; cache is best-effort.
  }
}

function flush() {
  if (!_dirty || !_cache) return;
  const nativeEntries = getNativeSWRCacheEntriesSource();
  if (nativeEntries) {
    flushToNativeEntries(nativeEntries);
    return;
  }
  try {
    const startedAt = perfNow();
    const heapBefore = readHermesHeapStats();
    // Each runtime keeps its own JS cache. Native persistence is bg-owned, so
    // native callers send only changed entries and deletion intents; other
    // platforms retain the full-store adapter below.
    const { store: disk, unreadable, rawChars } = readStoreFromDisk();
    const readAt = perfNow();
    const merged: ISWRStore = {};
    if (unreadable) {
      // Nothing on disk survives, so rebuild from this copy — a pending-keys
      // only write would drop every entry it still holds.
      Object.assign(merged, _cache);
    } else if (disk) {
      for (const [key, entry] of Object.entries(disk)) {
        if (entry && !isDeletedLocally(key, entry.t ?? 0)) {
          merged[key] = entry;
        }
      }
    }
    for (const key of _updatedKeys) {
      const entry = _cache[key];
      if (entry) {
        const diskEntry = merged[key];
        if (!diskEntry || (entry.t ?? 0) >= (diskEntry.t ?? 0)) {
          merged[key] = entry;
        }
      }
    }
    const limitedMerged = pruneSWRCacheStore(merged).store;
    const prunedAt = perfNow();
    const updatedKeyCount = _updatedKeys.size;
    let patchChars = 0;
    const storage = getSyncStorage();
    if (storage.applySWRCachePatch) {
      const built = buildNativeSWRCachePatch();
      patchChars = built.patchChars;
      void storage.applySWRCachePatch(built.patch);
    } else {
      void storage.setObject(
        EAppSyncStorageKeys.onekey_swr_cache,
        limitedMerged,
      );
    }
    const patchedAt = perfNow();
    // Adopting the merged store also refreshes this runtime's copy, which
    // otherwise only ages — reads pick up what the other runtime persisted.
    // Skipped without a store to merge against: `merged` is then only the
    // pending keys, and on a backend that persists nothing (both extension
    // runtimes get the no-op stub) this copy is the only one.
    if (disk) {
      _cache = limitedMerged;
      resetCacheSerializedChars(limitedMerged);
    }
    clearPendingIntents();
    const finishedAt = perfNow();
    const durationMs = Math.round(finishedAt - startedAt);
    if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
      defaultLogger.app.perf.swrCacheSlowOp({
        op: 'flush',
        durationMs,
        storeChars: rawChars,
        entryCount: _cacheEntrySerializedChars.size,
        readMs: Math.round(readAt - startedAt),
        pruneMs: Math.round(prunedAt - readAt),
        patchMs: Math.round(patchedAt - prunedAt),
        adoptMs: Math.round(finishedAt - patchedAt),
        updatedKeyCount,
        patchChars,
        ...diffHermesHeapStats(heapBefore),
      });
    }
  } catch {
    // MMKV write failure is non-fatal; cache is best-effort.
  }
}

function scheduleFlush() {
  if (_flushTimer !== undefined) {
    clearTimeout(_flushTimer);
  }
  _flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
}

// --- Public API ---

function reportInvalidSWRCacheKey(key: string) {
  reportSWRCacheCapacityDrops([{ key, reason: 'keyLimit' }], {
    maxEntries: SWR_CACHE_MAX_ENTRIES,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
    retainedEntryCount: _cacheEntrySerializedChars.size,
    retainedSerializedChars: _cacheSerializedChars,
  });
}

function get<T>(key: string): T | undefined {
  if (!isValidSWRCacheKey(key)) return undefined;
  const entry = loadStore()[key] as ISWREntry<T> | undefined;
  return entry?.d;
}

function getWithTimestamp<T>(
  key: string,
): { data: T; updatedAt: number } | undefined {
  if (!isValidSWRCacheKey(key)) return undefined;
  const entry = loadStore()[key] as ISWREntry<T> | undefined;
  if (!entry) return undefined;
  return { data: entry.d, updatedAt: entry.t };
}

function set<T>(key: string, data: T): void {
  if (!isValidSWRCacheKey(key)) {
    reportInvalidSWRCacheKey(key);
    return;
  }
  const store = loadStore();
  const now = Date.now();
  const existing = store[key];
  // Pollers re-set an unchanged payload for as long as a screen stays open,
  // and every flush re-reads and re-serializes the whole store. An unchanged
  // result only refreshes the timestamp: the key stays pending so the fresher
  // timestamp rides along with the next flush, but it never starts one.
  if (existing && isEqual(existing.d, data)) {
    existing.t = now;
    _updatedKeys.add(key);
    _dirty = true;
    return;
  }
  const entry = { d: data, t: now };
  const serializedEntry = serializeSWRCacheEntry(key, entry);
  if (
    !serializedEntry ||
    serializedEntry.entrySerializedChars > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS
  ) {
    removeCachedEntry(store, key);
    _updatedKeys.delete(key);
    _removedKeysAt.set(key, now);
    _dirty = true;
    if (serializedEntry) {
      reportSWRCacheCapacityDrops(
        [
          {
            entrySerializedChars: serializedEntry.entrySerializedChars,
            key,
            reason: 'entryLimit',
          },
        ],
        {
          maxEntries: SWR_CACHE_MAX_ENTRIES,
          maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
          maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
          retainedEntryCount: _cacheEntrySerializedChars.size,
          retainedSerializedChars: _cacheSerializedChars,
        },
      );
    }
    scheduleFlush();
    return;
  }
  setCachedEntry(store, serializedEntry);
  _updatedKeys.add(key);
  _dirty = true;
  if (isAccountSelectorCacheKey(key)) {
    evictOldestAccountSelectorEntries(store, now);
  }
  evictOldestOverBudget(store, now);
  scheduleFlush();
}

function isFresh(key: string, maxAge: number): boolean {
  if (!isValidSWRCacheKey(key)) return false;
  const entry = loadStore()[key];
  if (!entry) return false;
  return Date.now() - entry.t < maxAge;
}

function remove(key: string): void {
  if (!isValidSWRCacheKey(key)) {
    reportInvalidSWRCacheKey(key);
    return;
  }
  const store = loadStore();
  removeCachedEntry(store, key);
  _updatedKeys.delete(key);
  // Recorded even when the key is locally absent: the other runtime's copy
  // may still hold it, and the merge must not bring it back.
  _removedKeysAt.set(key, Date.now());
  _dirty = true;
  scheduleFlush();
}

// Drops every entry whose key starts with `prefix`. Used by bg services
// to invalidate a whole namespace (e.g. all walletList:* slots) on a
// mutation whose payload doesn't identify which specific slot is dirty.
function removeByPrefix(prefix: string): void {
  if (!prefix) return;
  if (!isValidSWRCacheKey(prefix)) {
    reportInvalidSWRCacheKey(prefix);
    return;
  }
  const store = loadStore();
  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      removeCachedEntry(store, key);
    }
  }
  for (const key of _updatedKeys) {
    if (key.startsWith(prefix)) {
      _updatedKeys.delete(key);
    }
  }
  // Recorded unconditionally for the same reason as remove().
  _removedPrefixesAt.push({ prefix, at: Date.now() });
  _dirty = true;
  scheduleFlush();
}

function clearAll(): void {
  _cache = {};
  resetCacheSerializedChars(_cache);
  _updatedKeys.clear();
  _clearedAllAt = Date.now();
  _dirty = true;
  scheduleFlush();
}

/** Call on app background to persist immediately. */
function flushNow(): void {
  if (_flushTimer !== undefined) {
    clearTimeout(_flushTimer);
    _flushTimer = undefined;
  }
  flush();
}

// --- Centralized SWR key namespaces ---
// Leading segment of every key produced by the matching swrKeys.X(...).
// Pair with `swrCacheUtils.removeByPrefix(prefixOf(namespace))` to
// invalidate a whole namespace at once.
const NS = {
  allNetworksCompatible: 'allNetCompat',
  unifiedNetworkSelectorMeta: 'unsMeta',
  unifiedNetworkSelectorValues: 'unsValues',
  networkContentData: 'netContent',
  recentNetworks: 'recentNets',
  walletListSideBar: 'walletList',
  accountSelectorList: 'accSelList',
  accountSelectorValues: 'accSelValues',
  discoveryHomePageData: 'disHomePage',
  discoveryHomeBookmarks: 'disHomeBookmarks',
  perpsOrderBookTickOptions: 'perpsOrderBookTicks',
  perpsL2BookSnapshot: 'perpsL2Book',
  historyTxDetail: 'historyTxDetail',
  marketHomeBanners: 'marketHomeBanners',
  marketHomeConfig: 'marketHomeConfig',
  marketHomeStocks: 'marketHomeStocks',
  marketHomeTokenList: 'marketHomeTokenList',
  marketStockDetail: 'marketStockDetail',
  marketStockTokenVariants: 'marketStockVariants',
  marketTokenDetail: 'marketTokenDetail',
  marketTokenSecurity: 'marketTokenSecurity',
  tokenSelectorView: 'tokenSelectorView',
  specifiedTokenSelectorView: 'specifiedTokenSelectorView',
  swapHistoryPreviewList: 'swapHistoryPreviewList',
  swapStockChart: 'swapStockChart',
  swapStockTokenDetail: 'swapStockTokenDetail',
  swapStockSpeedConfig: 'swapStockSpeedConfig',
  swapStockPayTokenDetails: 'swapStockPayTokenDetails',
  borrowMarkets: 'borrowMarkets',
  borrowReserves: 'borrowReserves',
  borrowHealthFactor: 'borrowHealthFactor',
  borrowRewards: 'borrowRewards',
  borrowEModeStatus: 'borrowEModeStatus',
  earnAccount: 'earnAccount',
  earnProtocolDetail: 'earnProtocolDetail',
  fiatCryptoTokenList: 'fiatCryptoTokenList',
  fiatCryptoNetworkSupport: 'fiatCryptoNetSupport',
  bulkSendAddressesInputSeed: 'bulkSendSeed',
  bulkCopyAddressesWallets: 'bulkCopyWallets',
  bulkCopyAddressesNetworkIds: 'bulkCopyNetIds',
  bulkCopyAddressesAccounts: 'bulkCopyAccounts',
  chainSelectorInputNetworks: 'chainSelNets',
  homeWalletTabSupport: 'homeWalletTabs',
} as const;
export type ISwrCacheNamespace = (typeof NS)[keyof typeof NS];
export const swrCacheNamespaces = NS;
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;

function isAccountSelectorCacheKey(key: string) {
  return key.startsWith(`${NS.accountSelectorList}:`);
}

const SWR_CACHE_SAFE_LOG_NAMESPACES = Object.values(NS);

function getSafeSWRCacheLogNamespace(key: string) {
  return (
    SWR_CACHE_SAFE_LOG_NAMESPACES.find(
      (namespace) => key === namespace || key.startsWith(`${namespace}:`),
    ) ?? 'unknown'
  );
}

export function reportSWRCacheCapacityDrops(
  drops: readonly ISWRCacheCapacityDrop[],
  limits: {
    maxEntries: number;
    maxEntrySerializedChars: number;
    maxSerializedChars: number;
    retainedEntryCount: number;
    retainedSerializedChars: number;
  },
) {
  if (drops.length === 0) {
    return;
  }
  const dropsByReason = new Map<
    ISWRCacheCapacityLimitReason,
    ISWRCacheCapacityDrop[]
  >();
  drops.forEach((drop) => {
    const reasonDrops = dropsByReason.get(drop.reason) ?? [];
    reasonDrops.push(drop);
    dropsByReason.set(drop.reason, reasonDrops);
  });

  dropsByReason.forEach((reasonDrops, reason) => {
    let state = swrCacheCapacityLogStates.get(reason);
    if (!state) {
      state = {
        affectedEntryCount: 0,
        eventCount: 0,
        maxObservedEntrySerializedChars: 0,
        namespaces: new Set<string>(),
      };
      swrCacheCapacityLogStates.set(reason, state);
    }
    state.affectedEntryCount += reasonDrops.length;
    state.eventCount += 1;
    reasonDrops.forEach(({ entrySerializedChars, key }) => {
      if (state.namespaces.size < SWR_CACHE_CAPACITY_LOG_MAX_NAMESPACES) {
        state.namespaces.add(getSafeSWRCacheLogNamespace(key));
      }
      state.maxObservedEntrySerializedChars = Math.max(
        state.maxObservedEntrySerializedChars,
        entrySerializedChars ?? 0,
      );
    });

    const now = Date.now();
    const canLog =
      state.lastLoggedAt === undefined ||
      now < state.lastLoggedAt ||
      now - state.lastLoggedAt >= SWR_CACHE_CAPACITY_LOG_COOLDOWN_MS;
    if (!canLog) {
      return;
    }
    try {
      defaultLogger.app.perf.swrCacheCapacityLimit({
        affectedEntryCount: state.affectedEntryCount,
        cooldownMs: SWR_CACHE_CAPACITY_LOG_COOLDOWN_MS,
        eventCount: state.eventCount,
        maxEntries: limits.maxEntries,
        maxEntrySerializedChars: limits.maxEntrySerializedChars,
        maxObservedEntrySerializedChars: state.maxObservedEntrySerializedChars,
        maxSerializedChars: limits.maxSerializedChars,
        namespaces: [...state.namespaces],
        reason,
        retainedEntryCount: limits.retainedEntryCount,
        retainedSerializedChars: limits.retainedSerializedChars,
      });
    } catch {
      // Cache behavior must not depend on diagnostic logging availability.
    }
    state.lastLoggedAt = now;
    state.affectedEntryCount = 0;
    state.eventCount = 0;
    state.maxObservedEntrySerializedChars = 0;
    state.namespaces.clear();
  });
}

type IBorrowScopedSWRKeyParams = {
  networkId: string;
  provider: string;
  marketAddress: string;
  accountId?: string;
};

function buildBorrowScopedSWRKey(
  namespace:
    | typeof NS.borrowReserves
    | typeof NS.borrowHealthFactor
    | typeof NS.borrowRewards
    | typeof NS.borrowEModeStatus,
  { networkId, provider, marketAddress, accountId }: IBorrowScopedSWRKeyParams,
) {
  return [
    namespace,
    'v1',
    networkId,
    provider.toLowerCase(),
    marketAddress,
    accountId ?? 'public',
  ].join(':');
}

// --- Centralized SWR key builders ---
export const swrKeys = {
  allNetworksCompatible: ({
    walletId,
    networkId,
    filterNetworksWithoutAccount,
    indexedAccountId,
    withNetworksInfo,
    enabledNetworkIdsKey,
  }: {
    walletId: string;
    networkId?: string;
    filterNetworksWithoutAccount?: boolean;
    indexedAccountId?: string;
    withNetworksInfo?: boolean;
    enabledNetworkIdsKey?: string;
  }) =>
    [
      NS.allNetworksCompatible,
      'v1',
      walletId,
      networkId ?? '',
      filterNetworksWithoutAccount ? '1' : '0',
      indexedAccountId ?? '',
      withNetworksInfo ? '1' : '0',
      enabledNetworkIdsKey ?? '',
    ].join(':'),
  // UnifiedNetworkSelector modal's list/meta bundle:
  // allNetworks + allNetworksState + compatibleNetworks grouped together so
  // the modal can render its skeleton synchronously on mount. Balances/DeFi
  // deliberately live outside this key — see UnifiedNetworkSelector/index.tsx.
  unifiedNetworkSelectorMeta: ({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId?: string;
  }) =>
    [NS.unifiedNetworkSelectorMeta, 'v1', walletId, accountId ?? ''].join(':'),
  // UnifiedNetworkSelector modal's balances/DeFi bundle: formatted per-network
  // USD values + currency + DeFi overview. SWR-cached (cold-start MMKV) so the
  // "networks with assets" section is present on the first frame, eliminating
  // the layout jump. Currency is deliberately NOT in the key — it only labels
  // the same primitive values. Each account keeps its own snapshot via
  // walletId + accountId + indexedAccountId.
  unifiedNetworkSelectorValues: ({
    walletId,
    accountId,
    indexedAccountId,
  }: {
    walletId: string;
    accountId?: string;
    indexedAccountId?: string;
  }) =>
    [
      NS.unifiedNetworkSelectorValues,
      'v1',
      walletId,
      accountId ?? '',
      indexedAccountId ?? '',
    ].join(':'),
  // NetworkContent (the "Network" tab inside UnifiedNetworkSelector) bundles
  // sorted chainSelectorNetworks + account balances + DeFi overview into one
  // result object. Balances/DeFi are included despite being volatile because
  // the sorted list itself depends on them — caching them together lets the
  // first render match the final UI. walletId + accountId in the key
  // guarantees each account sees its own snapshot.
  networkContentData: ({
    walletId,
    accountId,
    indexedAccountId,
    networkIdsKey,
  }: {
    walletId?: string;
    accountId?: string;
    indexedAccountId?: string;
    networkIdsKey?: string;
  }) =>
    // v3: v2 stored an empty frequentlyUsedItems (stripped to avoid a
    // "ghost row" flash). In practice this caused the opposite problem —
    // every cold open jumped from 0 pinned networks to the account's real
    // set (often 8 items), a far larger visual glitch. v3 persists the
    // real frequentlyUsedItems again so the first frame already matches
    // the post-revalidate layout for accounts whose pinned segment is
    // stable across sessions. Old v2 (empty-freq) entries are orphaned.
    [
      NS.networkContentData,
      'v3',
      walletId ?? '',
      accountId ?? '',
      indexedAccountId ?? '',
      networkIdsKey ?? '*',
    ].join(':'),
  // RecentNetworks chip row. `scope` identifies which UI surface rendered
  // the component. availableNetworks is deliberately NOT in the key: the
  // upstream list often hydrates empty-then-full on first render, and
  // including it here would make swrKey flip between two cache slots mid-
  // mount, which trips usePromiseResult's prevSwrKey reset logic and
  // flashes the chip row. availableNetworks only filters the method output
  // — its transient values are safe to ignore for cache identity.
  //
  // walletId/accountId ARE in the key: the fetcher passes availableNetworks
  // (derived from the account) to bg for filtering, so the cached result is
  // account-specific. Without wallet/account in the key, switching accounts
  // would leak one account's recent chips into another's first paint. v2
  // bumps the version to orphan the old (account-agnostic) v1 entries.
  recentNetworks: ({
    scope,
    showAllNetwork,
    walletId,
    accountId,
  }: {
    scope: EAppSWRCacheScopes;
    showAllNetwork: boolean;
    walletId?: string;
    accountId?: string;
  }) =>
    [
      NS.recentNetworks,
      'v2',
      scope,
      showAllNetwork ? '1' : '0',
      walletId ?? '',
      accountId ?? '',
    ].join(':'),
  defiEnabled: (networkId: string) => `defiEnabled:${networkId}`,
  // Home wallet tab support (Perps / DeFi tab visibility). Seeds the first
  // frame so the tab row does not reflow once the background gating resolves
  // (OK-61505). scopeKey = buildHomeWalletTabSupportScopeKey().
  homeWalletTabSupport: ({ scopeKey }: { scopeKey: string }) =>
    [NS.homeWalletTabSupport, 'v1', scopeKey].join(':'),
  discoveryHomePageData: () => [NS.discoveryHomePageData, 'v1'].join(':'),
  discoveryHomeBookmarks: () => [NS.discoveryHomeBookmarks, 'v1'].join(':'),
  // Account selector left sidebar wallet list. One slot per
  // `hideNonBackedUpWallet` variant — every selector instance (main /
  // send-target / dapp-connect) shares the same wallets data, so we
  // intentionally keep this single-slot. Other inputs (HardwareFeaturesUpdate
  // ts, passphraseProtectionChangedAt) only drive a re-fetch and must stay
  // out of the key, otherwise prevSwrKey reset (see usePromiseResult.ts)
  // would blank the sidebar on every device/passphrase event.
  walletListSideBar: ({
    hideNonBackedUpWallet,
  }: {
    hideNonBackedUpWallet?: boolean;
  }) =>
    [NS.walletListSideBar, 'v1', hideNonBackedUpWallet ? '1' : '0'].join(':'),
  // Account selector accounts list: caches the section data that drives the
  // wallet/account picker modal so subsequent opens render the previous
  // structure synchronously instead of flashing the empty state. Account
  // values are loaded separately (see useAccountSelectorValuesLoader) and
  // intentionally NOT in this cache.
  accountSelectorList: ({
    focusedWallet,
    deriveType,
    linkedNetworkId,
    selectedNetworkId,
    keepAllOtherAccounts,
  }: {
    focusedWallet: string;
    deriveType: string;
    linkedNetworkId?: string;
    selectedNetworkId?: string;
    keepAllOtherAccounts?: boolean;
  }) =>
    [
      NS.accountSelectorList,
      'v1',
      focusedWallet,
      deriveType,
      linkedNetworkId ?? '',
      selectedNetworkId ?? '',
      keepAllOtherAccounts ? '1' : '0',
    ].join(':'),
  // Balance texts the account selector rows last displayed, one entry per
  // wallet (see accountSelectorValueDisplayCacheV2). Only UI text is kept, so
  // a wallet revisit or a cold start paints the previous balances on the first
  // frame; live values still load and replace them.
  accountSelectorValues: ({ walletId }: { walletId: string }) =>
    [NS.accountSelectorValues, 'v1', walletId].join(':'),
  perpsOrderBookTickOptions: () =>
    [NS.perpsOrderBookTickOptions, 'v1'].join(':'),
  perpsL2BookSnapshot: ({
    coin,
    nSigFigs,
    mantissa,
  }: {
    coin: string;
    nSigFigs?: number | null;
    mantissa?: number | null;
  }) =>
    [NS.perpsL2BookSnapshot, 'v1', coin, nSigFigs ?? '', mantissa ?? ''].join(
      ':',
    ),
  perpsL2BookSnapshotLatest: ({ coin }: { coin: string }) =>
    [NS.perpsL2BookSnapshot, 'v1', coin, 'latest'].join(':'),
  // Tx history detail response (status / confirmations / ETA). Cached so a
  // re-open renders the last-known confirming subtitle synchronously instead
  // of flashing the "waiting" fallback before the detail request resolves
  // (OK-56372). Keyed by accountAddress because the response's isOwn/direction
  // framing is viewer-specific.
  historyTxDetail: ({
    networkId,
    accountAddress,
    txid,
  }: {
    networkId: string;
    accountAddress?: string;
    txid: string;
  }) =>
    [NS.historyTxDetail, 'v1', networkId, accountAddress ?? '', txid].join(':'),
  marketHomeBanners: (locale: string, mock: boolean) =>
    [NS.marketHomeBanners, 'v1', locale, mock ? 'mock' : 'live'].join(':'),
  marketHomeConfig: (locale: string) =>
    [NS.marketHomeConfig, 'v1', locale].join(':'),
  marketHomeStocks: (queryKey: string) =>
    [NS.marketHomeStocks, 'v1', queryKey].join(':'),
  marketStockDetail: ({
    stockId,
    locale,
  }: {
    stockId: string;
    locale: string;
  }) => [NS.marketStockDetail, 'v1', stockId, locale].join(':'),
  marketStockTokenVariants: ({
    stockId,
    locale,
  }: {
    stockId: string;
    locale: string;
  }) => [NS.marketStockTokenVariants, 'v1', stockId, locale].join(':'),
  marketTokenDetail: ({
    networkId,
    tokenAddress,
    currencyId,
    locale,
  }: {
    networkId: string;
    tokenAddress: string;
    currencyId: string;
    locale: string;
  }) =>
    [
      NS.marketTokenDetail,
      'v1',
      networkId,
      tokenAddress,
      currencyId,
      locale,
    ].join(':'),
  // Each item carries a localized `content` that the UI shows as-is, so a
  // report cached in one language must not be replayed in another.
  marketTokenSecurity: ({
    networkId,
    tokenAddress,
    locale,
  }: {
    networkId: string;
    tokenAddress: string;
    locale: string;
  }) =>
    [NS.marketTokenSecurity, 'v1', networkId, tokenAddress, locale].join(':'),
  marketHomeTokenList: ({
    networkId,
    locale,
    sortBy,
    sortType,
    pageSize,
    minLiquidity,
    type,
    category,
    timeFrame,
  }: {
    networkId: string;
    locale: string;
    sortBy?: string;
    sortType?: string;
    pageSize?: number;
    minLiquidity?: number;
    type?: string;
    category?: string;
    timeFrame?: string;
  }) => {
    const parts = [
      NS.marketHomeTokenList,
      'v2',
      networkId,
      locale,
      sortBy ?? '',
      sortType ?? '',
      pageSize ?? '',
      minLiquidity ?? '',
      type ?? '',
      timeFrame ?? '',
    ];
    if (category) {
      parts.push(category);
    }
    return parts.join(':');
  },
  tokenSelectorView: ({
    ownerMode,
    filterMode,
    accountId,
    networkId,
    indexedAccountId,
    activeAccountId,
    activeNetworkId,
    isAllNetworks,
    mergeDeriveAddressData,
  }: {
    ownerMode: 'normal' | 'active-account' | 'filtered';
    filterMode: 'all-token' | 'wallet-token' | 'dapp-token';
    accountId?: string;
    networkId?: string;
    indexedAccountId?: string;
    activeAccountId?: string;
    activeNetworkId?: string;
    isAllNetworks?: boolean;
    mergeDeriveAddressData?: boolean;
  }) =>
    [
      NS.tokenSelectorView,
      'v1',
      ownerMode,
      filterMode,
      accountId ?? '',
      networkId ?? '',
      indexedAccountId ?? '',
      activeAccountId ?? '',
      activeNetworkId ?? '',
      isAllNetworks ? '1' : '0',
      mergeDeriveAddressData ? '1' : '0',
    ].join(':'),
  specifiedTokenSelectorView: ({
    accountId,
    networkId,
    indexedAccountId,
    targetsKey,
  }: {
    accountId: string;
    networkId: string;
    indexedAccountId?: string;
    targetsKey: string;
  }) =>
    [
      NS.specifiedTokenSelectorView,
      'v1',
      accountId,
      networkId,
      indexedAccountId ?? '',
      targetsKey,
    ].join(':'),
  swapStockTokenDetail: ({ tokenScope }: { tokenScope: string }) =>
    [NS.swapStockTokenDetail, 'v1', tokenScope].join(':'),
  // Keep the existing unversioned key stable so users retain the history
  // snapshot that already powers the ordinary Swap first frame.
  swapHistoryPreviewList: () => NS.swapHistoryPreviewList,
  swapStockChart: ({
    networkId,
    tokenAddress,
    isNative,
    range,
    requestCurrency,
  }: {
    networkId: string;
    tokenAddress: string;
    isNative?: boolean;
    range: string;
    requestCurrency: string;
  }) =>
    [
      NS.swapStockChart,
      'v1',
      networkId,
      tokenAddress,
      isNative ? 'native' : 'token',
      range,
      requestCurrency,
    ].join(':'),
  swapStockSpeedConfig: ({ networkId }: { networkId: string }) =>
    [NS.swapStockSpeedConfig, 'v1', networkId].join(':'),
  swapStockPayTokenDetails: ({ scope }: { scope: string }) =>
    [NS.swapStockPayTokenDetails, 'v1', scope].join(':'),
  borrowMarkets: () => [NS.borrowMarkets, 'v1'].join(':'),
  borrowReserves: (params: IBorrowScopedSWRKeyParams) =>
    buildBorrowScopedSWRKey(NS.borrowReserves, params),
  borrowHealthFactor: (params: IBorrowScopedSWRKeyParams) =>
    buildBorrowScopedSWRKey(NS.borrowHealthFactor, params),
  borrowRewards: (params: IBorrowScopedSWRKeyParams) =>
    buildBorrowScopedSWRKey(NS.borrowRewards, params),
  borrowEModeStatus: (params: IBorrowScopedSWRKeyParams) =>
    buildBorrowScopedSWRKey(NS.borrowEModeStatus, params),
  earnAccount: ({
    networkId,
    accountId,
    indexedAccountId,
    deriveType,
    btcOnlyTaproot,
  }: {
    networkId: string;
    accountId?: string;
    indexedAccountId?: string;
    deriveType?: string;
    btcOnlyTaproot: boolean;
  }) =>
    [
      NS.earnAccount,
      'v3',
      networkId,
      accountId ?? '',
      indexedAccountId ?? '',
      deriveType ?? '',
      btcOnlyTaproot ? '1' : '0',
    ].join(':'),
  earnProtocolDetail: ({
    networkId,
    symbol,
    provider,
    vault,
    locale,
    currencyId,
    accountScopeKey,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    locale: string;
    currencyId: string;
    // Set only when the request carries an account address. The response then
    // contains that account's balances and rewards, so it must never share a
    // cache entry with the account-less protocol response or with another
    // account.
    accountScopeKey?: string;
  }) =>
    [
      NS.earnProtocolDetail,
      'v2',
      networkId,
      provider.toLowerCase(),
      symbol.toUpperCase(),
      vault ?? '',
      locale.toLowerCase(),
      currencyId.toLowerCase(),
      // Appended only when present. An unconditional '' would add a trailing
      // colon to the account-less key, changing a shape that is already
      // persisted on desktop/web — every existing entry would miss after an
      // upgrade, for no gain in behavior.
      ...(accountScopeKey ? [accountScopeKey] : []),
    ].join(':'),
  // Buy Crypto token list (tokens + networksMap + merge-derive flags). Cached
  // so re-opening the modal paints the previous list synchronously instead of
  // the skeleton; Android opens modals without an animation, so every bg
  // round trip is otherwise visible. accountId is in the key because the bg
  // filters the list by wallet compatibility and (single-network) address.
  fiatCryptoTokenList: ({
    networkId,
    type,
    accountId,
  }: {
    networkId: string;
    type: string;
    accountId?: string;
  }) =>
    [NS.fiatCryptoTokenList, 'v1', networkId, type, accountId ?? ''].join(':'),
  // "Does this network have any buy/sell fiat token" flag behind the home
  // Buy/Sell entry. The entry is fail-closed on it, so without a snapshot
  // every cold start paints it disabled until fiat-pay/list returns
  // (OK-61505). Network + type only: the bg check takes no account input.
  fiatCryptoNetworkSupport: ({
    networkId,
    type,
  }: {
    networkId: string;
    type: string;
  }) => [NS.fiatCryptoNetworkSupport, 'v1', networkId, type].join(':'),
  bulkSendAddressesInputSeed: ({
    networkId,
    accountId,
    indexedAccountId,
    bulkSendMode,
    tokenKey,
  }: {
    networkId?: string;
    accountId?: string;
    indexedAccountId?: string;
    bulkSendMode: string;
    tokenKey?: string;
  }) =>
    [
      NS.bulkSendAddressesInputSeed,
      'v1',
      networkId ?? '',
      accountId ?? '',
      indexedAccountId ?? '',
      bulkSendMode,
      tokenKey ?? '',
    ].join(':'),
  // Bulk copy addresses page: wallet picker list, per-wallet compatible
  // network ids and the per-(wallet, network) account groups, so re-entries
  // paint the previous structure instead of an empty state (OK-61586).
  bulkCopyAddressesWallets: () => [NS.bulkCopyAddressesWallets, 'v1'].join(':'),
  bulkCopyAddressesNetworkIds: ({ walletId }: { walletId: string }) =>
    [NS.bulkCopyAddressesNetworkIds, 'v1', walletId].join(':'),
  bulkCopyAddressesAccounts: ({
    walletId,
    networkId,
  }: {
    walletId: string;
    networkId: string;
  }) => [NS.bulkCopyAddressesAccounts, 'v1', walletId, networkId].join(':'),
  // ChainSelectorInput: the (filtered) network list behind the trigger, so
  // the current network name renders on the first frame.
  chainSelectorInputNetworks: ({
    excludeAllNetworkItem,
    networkIds,
  }: {
    excludeAllNetworkItem?: boolean;
    networkIds?: string[];
  }) =>
    [
      NS.chainSelectorInputNetworks,
      'v1',
      excludeAllNetworkItem ? '1' : '0',
      networkIds?.length ? networkIds.join(',') : '',
    ].join(':'),
};

function uniqueCacheKeys(keys: string[]) {
  return Array.from(new Set(keys));
}

export function getPerpsL2BookSnapshotCacheKeys({
  coin,
  nSigFigs,
  mantissa,
}: {
  coin: string;
  nSigFigs?: number | null;
  mantissa?: number | null;
}) {
  return uniqueCacheKeys([
    swrKeys.perpsL2BookSnapshot({
      coin,
      nSigFigs,
      mantissa,
    }),
    swrKeys.perpsL2BookSnapshotLatest({
      coin,
    }),
  ]);
}

function getFreshPerpsL2BookSnapshot({
  coin,
  nSigFigs,
  mantissa,
  maxAgeMs,
  reloadIfOlderThanMs,
}: {
  coin: string;
  nSigFigs?: number | null;
  mantissa?: number | null;
  maxAgeMs: number;
  reloadIfOlderThanMs: number;
}): { data: HL.IBook; updatedAt: number } | undefined {
  const keys = getPerpsL2BookSnapshotCacheKeys({
    coin,
    nSigFigs,
    mantissa,
  });
  const findEntry = () => {
    for (const key of keys) {
      const entry = getWithTimestamp<HL.IBook>(key);
      const book = entry?.data;
      if (
        entry &&
        book?.coin === coin &&
        book.nSigFigs !== undefined &&
        book.mantissa !== undefined &&
        (book.nSigFigs ?? null) === (nSigFigs ?? null) &&
        (book.mantissa ?? null) === (mantissa ?? null) &&
        Date.now() - entry.updatedAt <= maxAgeMs
      ) {
        return entry;
      }
    }
    return undefined;
  };

  let entry = findEntry();
  const entryAgeMs = entry ? Date.now() - entry.updatedAt : undefined;
  const [targetKey] = keys;
  if (
    (!entry || (entryAgeMs ?? 0) > reloadIfOlderThanMs) &&
    shouldReloadForTarget(targetKey, reloadIfOlderThanMs)
  ) {
    reloadFromStorage();
    markReloadForTarget(targetKey, reloadIfOlderThanMs);
    const reloadedEntry = findEntry();
    entry = reloadedEntry ?? entry;
  }
  return entry;
}

// What this runtime holds in memory right now; never triggers a load.
function getSizeStats() {
  return {
    entryCount: _cache ? Object.keys(_cache).length : 0,
    serializedChars: _cache ? _cacheSerializedChars : 0,
  };
}

export const swrCacheUtils = {
  get,
  getWithTimestamp,
  getFreshPerpsL2BookSnapshot,
  set,
  removeByPrefix,
  remove,
  isFresh,
  clearAll,
  flushNow,
  reloadFromStorage,
  getSizeStats,
};
