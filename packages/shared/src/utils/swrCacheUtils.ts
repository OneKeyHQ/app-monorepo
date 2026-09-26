/* cspell:ignore ISWR IMMKV */
import { isEqual } from 'lodash';

import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

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
// Namespaces live in their own module; the storage layer names its own from
// the same list and must not import this one.
import {
  BG_OWNED_SWR_NAMESPACES,
  swrCacheNamespaces as NS,
} from './swrCacheNamespaceNames';
import {
  clearAllSwrCacheNamespaces,
  readSwrCacheEntry,
  removeSwrCacheByPrefix,
  removeSwrCacheEntries,
  swrKeyPrefix,
  writeSwrCacheEntries,
} from './swrCacheNamespaceStorage';

import type { ISwrCacheStoredEntry } from './swrCacheNamespaceStorage';
import type * as HL from '../../types/hyperliquid/sdk';
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

let _cache: ISWRStore | undefined;
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

/**
 * The store this runtime has looked at, not the store on disk.
 *
 * Each namespace keeps its own records and a read names its key, so nothing
 * is loaded up front: a miss reads through to the namespace, and what comes
 * back is kept here for the next read. That is also how the perps snapshots
 * bg writes become visible — `reloadFromStorage` drops what is not pending
 * and the next read goes back to the file.
 */
function loadStore(): ISWRStore {
  if (_cache === undefined) {
    _cache = {};
    resetCacheSerializedChars(_cache);
  }
  return _cache;
}

/** Read a key this runtime has not seen yet, honouring its own pending
 *  deletions so a read cannot put back what `remove` just dropped. */
function readThroughToStore<T>(key: string): ISWREntry<T> | undefined {
  const stored = readSwrCacheEntry(key);
  if (!stored || typeof stored.t !== 'number') {
    return undefined;
  }
  if (isDeletedLocally(key, stored.t)) {
    return undefined;
  }
  const entry = { d: stored.d, t: stored.t } as ISWREntry<T>;
  const serialized = serializeSWRCacheEntry(key, entry);
  if (!serialized) {
    return undefined;
  }
  setCachedEntry(loadStore(), serialized);
  // Adopting a value that is already on disk is not a change to persist.
  _updatedKeys.delete(key);
  return entry;
}

function lookupEntry<T>(key: string): ISWREntry<T> | undefined {
  const store = loadStore();
  const entry = store[key] as ISWREntry<T> | undefined;
  if (entry) {
    return entry;
  }
  return readThroughToStore<T>(key);
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

/**
 * Forget what this runtime has read, so the next read goes back to disk.
 *
 * Both runtimes write these namespaces. Nothing notifies this one when the
 * other commits, so the way its writes become visible is to drop the copy
 * held here — pending writes first, so nothing still pending is lost.
 */
function reloadFromStorage(): void {
  flush();
  const startedAt = perfNow();
  const heapBefore = readHermesHeapStats();
  const store = loadStore();
  const retained: ISWRStore = {};
  // A key still waiting to be flushed is this runtime's newest value; every
  // other key is a copy of the file and can be read again on demand.
  _updatedKeys.forEach((key) => {
    const entry = store[key];
    if (entry) {
      retained[key] = entry;
    }
  });
  _cache = retained;
  resetCacheSerializedChars(retained);
  const durationMs = Math.round(perfNow() - startedAt);
  if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
    defaultLogger.app.perf.swrCacheSlowOp({
      op: 'reload',
      durationMs,
      storeChars: _cacheSerializedChars,
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

function clearPendingIntents() {
  _updatedKeys.clear();
  _removedKeysAt.clear();
  _removedPrefixesAt = [];
  _clearedAllAt = 0;
  _dirty = false;
}

function flush() {
  if (!_dirty || !_cache) return;
  try {
    const startedAt = perfNow();
    const heapBefore = readHermesHeapStats();
    const updatedKeyCount = _updatedKeys.size;
    // Order matters: the wipes are what this runtime decided is gone, and
    // they must not take the writes that followed them with them.
    if (_clearedAllAt > 0) {
      clearAllSwrCacheNamespaces();
    }
    _removedPrefixesAt.forEach(({ prefix }) => removeSwrCacheByPrefix(prefix));
    removeSwrCacheEntries([..._removedKeysAt.keys()]);
    const updates: Array<readonly [string, ISwrCacheStoredEntry]> = [];
    _updatedKeys.forEach((key) => {
      const entry = _cache?.[key];
      if (entry) {
        updates.push([key, { d: entry.d, t: entry.t }]);
      }
    });
    if (updates.length > 0) {
      writeSwrCacheEntries(updates);
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
        patchChars: updates.reduce(
          (sum, [key]) => sum + (_cacheEntrySerializedChars.get(key) ?? 0),
          0,
        ),
        ...diffHermesHeapStats(heapBefore),
      });
    }
  } catch {
    // Persisting is best effort; the copy in memory still serves the screen.
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
  return lookupEntry<T>(key)?.d;
}

function getWithTimestamp<T>(
  key: string,
): { data: T; updatedAt: number } | undefined {
  if (!isValidSWRCacheKey(key)) return undefined;
  const entry = lookupEntry<T>(key);
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
  const existing = lookupEntry(key);
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

/**
 * Drop every namespace this runtime owns, for a reset that wipes the wallet
 * and account database.
 *
 * Narrower than `clearAll` on purpose, in two ways. It leaves the namespaces
 * bg writes alone, so a wipe here cannot collide with them. And it records a
 * removal per namespace rather than one `clearedAll` mark, so the read-through
 * suppression that mark implies cannot also swallow bg's later perps writes
 * for the rest of the session.
 *
 * Wider than dropping the wallet-shaped namespaces: a reset re-uses wallet ids
 * (`hd-1`), so any namespace keyed by one — the network selector's, the token
 * selectors', Earn, Borrow — would otherwise carry the previous run's snapshot
 * into a supposedly empty profile.
 */
function clearUiOwnedNamespaces(): void {
  const bgOwned = new Set<string>(BG_OWNED_SWR_NAMESPACES);
  const isBgOwned = (key: string) => bgOwned.has(swrKeyPrefix(key));
  // By namespace, not by key prefix: `swrKeys.swapHistoryPreviewList()` is the
  // bare namespace with no colon after it, so a `<namespace>:` prefix match
  // would clear its file and leave the entry in this runtime's memory.
  const store = loadStore();
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (isBgOwned(key)) {
      return;
    }
    removeCachedEntry(store, key);
    _updatedKeys.delete(key);
    _removedKeysAt.set(key, now);
  });
  _dirty = true;
  // The store holds records this runtime never read, and records under the
  // fallback namespace that no `swrKeys` entry names, so the wipe is asked of
  // the storage layer by namespace rather than assembled from the registry.
  try {
    clearAllSwrCacheNamespaces({
      exceptSwrPrefixes: BG_OWNED_SWR_NAMESPACES,
    });
  } catch {
    // Best effort; the removals recorded above still persist below.
  }
  flushNow();
}

/**
 * Persist what is pending, without waiting for the debounce.
 *
 * On native that is the whole story: the snapshot store writes MMKV
 * synchronously. Everywhere else it queues an IndexedDB transaction behind a
 * debounce of its own, so this kicks that too — an extension popup closed
 * right after a wallet deletion takes its timers with it, and the generic
 * app-background flush does not cover extension surfaces.
 */
function flushNow(): void {
  if (_flushTimer !== undefined) {
    clearTimeout(_flushTimer);
    _flushTimer = undefined;
  }
  flush();
  void flushSnapshotStore();
}

/**
 * Flush and wait for the snapshot store, for a caller that can wait.
 *
 * Resolves `true` when what was pending is on disk. The store re-queues a
 * batch it could not write and retries it on a timer, so a `false` here means
 * the removal is still only in memory — and the surface that asked for it may
 * close before that timer fires. The caller decides what that is worth; there
 * is nothing to be done about a database that will not open, so this reports
 * rather than throws.
 */
async function flushNowAndPersist(): Promise<boolean> {
  if (_flushTimer !== undefined) {
    clearTimeout(_flushTimer);
    _flushTimer = undefined;
  }
  flush();
  return flushSnapshotStore();
}

function flushSnapshotStore(): Promise<boolean> {
  if (platformEnv.isNative) {
    // MMKV is written synchronously inside `flush()` above.
    return Promise.resolve(true);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { flushUiSnapshotStoreNow } =
      require('../storage/DisplaySnapshotStorage/webUiSnapshotStore') as typeof import('../storage/DisplaySnapshotStorage/webUiSnapshotStore');
    return flushUiSnapshotStoreNow();
  } catch {
    // The store may not be loaded on every surface, and this cannot tell that
    // apart from a store that failed to load — so it does not claim a commit.
    return Promise.resolve(false);
  }
}

// --- Centralized SWR key namespaces ---

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
  // Home All Networks chip's missing-address dot: the enabled compatible
  // networks the indexed account has no address on. Shares the namespace so
  // an enabled-network change drops it with the compat entries.
  allNetworksWithoutAccount: ({
    walletId,
    indexedAccountId,
  }: {
    walletId: string;
    indexedAccountId: string;
  }) =>
    [NS.allNetworksCompatible, 'noAddr', 'v1', walletId, indexedAccountId].join(
      ':',
    ),
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
  // The stock identity behind a swap stock token (contract -> stockId). Only
  // tokens persisted before `stockId` existed need the lookup, and persisting
  // what it resolves keeps that round trip off the next mount's critical path.
  swapStockTokenIdentity: ({ tokenScope }: { tokenScope: string }) =>
    [NS.swapStockTokenIdentity, 'v1', tokenScope].join(':'),
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
    [NS.swapStockPayTokenDetails, 'v2', scope].join(':'),
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

/**
 * Writing contract.
 *
 * Entries are written by the SWR layer alone: `usePromiseResult` persists what
 * its fetcher returned, in the runtime that owns the hook. Feature code does
 * not maintain them by hand — after a mutation, refresh the hook and let it
 * write the truth, rather than `set`/`remove`-ing a key to keep it in step.
 * Two callers patching one key is how a namespace ends up with two writers
 * over one file and no lock between the runtimes.
 *
 * bg is not a writer, and a removal is a write. It does not invalidate these
 * namespaces either: the UI runtime receives the same mutation events and
 * drops its own entries (`kit/src/utils/swrCacheMutationInvalidation.ts`),
 * so nothing has to cross the runtime boundary for the cache's sake. The
 * exception is the perps snapshots, which bg both owns and writes.
 */
export const swrCacheUtils = {
  get,
  getWithTimestamp,
  getFreshPerpsL2BookSnapshot,
  set,
  removeByPrefix,
  remove,
  isFresh,
  clearAll,
  clearUiOwnedNamespaces,
  flushNow,
  flushNowAndPersist,
  reloadFromStorage,
  getSizeStats,
};

export { prefixOf, swrCacheNamespaces } from './swrCacheNamespaceNames';
export type { ISwrCacheNamespace } from './swrCacheNamespaceNames';
