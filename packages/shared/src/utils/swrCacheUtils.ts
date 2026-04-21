/* cspell:ignore ISWR IMMKV */
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import type { ISyncStorage } from '../storage/instance/syncStorageInstance';

// SWR cache uses the dedicated cold-start cache MMKV instance,
// separate from onekey-app-setting.
type ISWREntry<T = any> = {
  /** data */
  d: T;
  /** timestamp (ms) */
  t: number;
};

type ISWRStore = Record<string, ISWREntry>;

// Max entries to prevent unbounded MMKV growth.
const MAX_ENTRIES = 80;

let _syncStorage: ISyncStorage | undefined;
let _cache: ISWRStore | undefined;
let _dirty = false;
let _flushTimer: ReturnType<typeof setTimeout> | undefined;

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
    _cache =
      getSyncStorage().getObject<ISWRStore>(
        EAppSyncStorageKeys.onekey_swr_cache,
      ) ?? {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function flush() {
  if (!_dirty || !_cache) return;
  try {
    getSyncStorage().setObject(EAppSyncStorageKeys.onekey_swr_cache, _cache);
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

function get<T>(key: string): T | undefined {
  const entry = loadStore()[key] as ISWREntry<T> | undefined;
  return entry?.d;
}

function getWithTimestamp<T>(
  key: string,
): { data: T; updatedAt: number } | undefined {
  const entry = loadStore()[key] as ISWREntry<T> | undefined;
  if (!entry) return undefined;
  return { data: entry.d, updatedAt: entry.t };
}

function set<T>(key: string, data: T): void {
  const store = loadStore();
  store[key] = { d: data, t: Date.now() };
  _dirty = true;

  // Evict oldest entries when over limit.
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.toSorted(
      (a, b) => (store[a].t ?? 0) - (store[b].t ?? 0),
    );
    const removeCount = keys.length - MAX_ENTRIES;
    for (let i = 0; i < removeCount; i += 1) {
      delete store[sorted[i]];
    }
  }

  scheduleFlush();
}

function isFresh(key: string, maxAge: number): boolean {
  const entry = loadStore()[key];
  if (!entry) return false;
  return Date.now() - entry.t < maxAge;
}

function remove(key: string): void {
  const store = loadStore();
  if (store[key] !== undefined) {
    delete store[key];
    _dirty = true;
    scheduleFlush();
  }
}

function clearAll(): void {
  _cache = {};
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
      'allNetCompat',
      'v1',
      walletId,
      networkId ?? '',
      filterNetworksWithoutAccount ? '1' : '0',
      indexedAccountId ?? '',
      withNetworksInfo ? '1' : '0',
      enabledNetworkIdsKey ?? '',
    ].join(':'),
  defiEnabled: (networkId: string) => `defiEnabled:${networkId}`,
};

export const swrCacheUtils = {
  get,
  getWithTimestamp,
  set,
  remove,
  isFresh,
  clearAll,
  flushNow,
};
