/* cspell:ignore ISWR IMMKV */
import { defaultLogger } from '../logger/logger';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import {
  SWR_CACHE_MAX_ENTRIES,
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
  SWR_CACHE_MAX_SERIALIZED_CHARS,
  isValidSWRCacheKey,
} from './swrCacheLimits';

import type * as HL from '../../types/hyperliquid/sdk';
import type { ISyncStorage } from '../storage/instance/syncStorageInstance';
import type { INativeSWRCachePatchIntent } from '../storage/nativeStorageTypes';
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
  pair: string;
  serializedChars: number;
  updatedAt: number;
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

export function pruneSWRCacheStore<T extends IPrunableSWREntry>(
  store: Record<string, T>,
  options?: IPruneSWRCacheStoreOptions,
): {
  removedKeys: string[];
  serialized: string;
  store: Record<string, T>;
} {
  const maxEntries = options?.maxEntries ?? SWR_CACHE_MAX_ENTRIES;
  const maxEntrySerializedChars =
    options?.maxEntrySerializedChars ?? SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS;
  const maxSerializedChars =
    options?.maxSerializedChars ?? SWR_CACHE_MAX_SERIALIZED_CHARS;
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
    if (serializedEntry.entrySerializedChars > maxEntrySerializedChars) {
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

  candidates.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || right.index - left.index,
  );

  const retained: ISerializedSWRCacheEntry<T>[] = [];
  let totalSerializedChars = 2;
  for (const candidate of candidates) {
    const separatorChars = retained.length > 0 ? 1 : 0;
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
    }
  }
  retained.sort((left, right) => left.index - right.index);

  const retainedStore = {} as Record<string, T>;
  retained.forEach(({ entry, key }) => {
    Object.defineProperty(retainedStore, key, {
      configurable: true,
      enumerable: true,
      value: entry,
      writable: true,
    });
  });

  reportSWRCacheCapacityDrops(capacityDrops, {
    maxEntries,
    maxEntrySerializedChars,
    maxSerializedChars,
    retainedEntryCount: retained.length,
    retainedSerializedChars: totalSerializedChars,
  });

  return {
    removedKeys,
    serialized: `{${retained.map(({ pair }) => pair).join(',')}}`,
    store: retainedStore,
  };
}

let _syncStorage: ISyncStorage | undefined;
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

function loadStore(): ISWRStore {
  if (_cache !== undefined) return _cache;
  try {
    const loaded =
      getSyncStorage().getObject<ISWRStore>(
        EAppSyncStorageKeys.onekey_swr_cache,
      ) ?? {};
    _cache = adoptPrunedStore(loaded);
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
} {
  let raw: string | undefined;
  try {
    raw = getSyncStorage().getString(EAppSyncStorageKeys.onekey_swr_cache);
  } catch {
    return { store: undefined, unreadable: true };
  }
  if (!raw) {
    return { store: undefined, unreadable: false };
  }
  try {
    return { store: JSON.parse(raw) as ISWRStore, unreadable: false };
  } catch {
    return { store: undefined, unreadable: true };
  }
}

function reloadFromStorage(): void {
  flush();
  const { store, unreadable } = readStoreFromDisk();
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

function flush() {
  if (!_dirty || !_cache) return;
  try {
    // Each runtime keeps its own JS cache. Native persistence is bg-owned, so
    // native callers send only changed entries and deletion intents; other
    // platforms retain the full-store adapter below.
    const { store: disk, unreadable } = readStoreFromDisk();
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
    const storage = getSyncStorage();
    if (storage.applySWRCachePatch) {
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
      void storage.applySWRCachePatch(patch);
    } else {
      void storage.setObject(
        EAppSyncStorageKeys.onekey_swr_cache,
        limitedMerged,
      );
    }
    // Adopting the merged store also refreshes this runtime's copy, which
    // otherwise only ages — reads pick up what the other runtime persisted.
    // Skipped without a store to merge against: `merged` is then only the
    // pending keys, and on a backend that persists nothing (both extension
    // runtimes get the no-op stub) this copy is the only one.
    if (disk) {
      _cache = limitedMerged;
      resetCacheSerializedChars(limitedMerged);
    }
    _updatedKeys.clear();
    _removedKeysAt.clear();
    _removedPrefixesAt = [];
    _clearedAllAt = 0;
    _dirty = false;
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
  discoveryHomePageData: 'disHomePage',
  discoveryHomeBookmarks: 'disHomeBookmarks',
  perpsOrderBookTickOptions: 'perpsOrderBookTicks',
  perpsL2BookSnapshot: 'perpsL2Book',
  historyTxDetail: 'historyTxDetail',
  marketHomeTokenList: 'marketHomeTokenList',
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
  bulkSendAddressesInputSeed: 'bulkSendSeed',
  bulkCopyAddressesWallets: 'bulkCopyWallets',
  bulkCopyAddressesNetworkIds: 'bulkCopyNetIds',
  bulkCopyAddressesAccounts: 'bulkCopyAccounts',
  chainSelectorInputNetworks: 'chainSelNets',
} as const;
export type ISwrCacheNamespace = (typeof NS)[keyof typeof NS];
export const swrCacheNamespaces = NS;
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;

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
      accountScopeKey ?? '',
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
};
