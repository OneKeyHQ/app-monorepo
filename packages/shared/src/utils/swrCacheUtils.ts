/* cspell:ignore ISWR IMMKV */
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import type * as HL from '../../types/hyperliquid/sdk';
import type { ISyncStorage } from '../storage/instance/syncStorageInstance';
import type { EAppSWRCacheScopes } from '../storage/syncStorageKeys';

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
const MAX_ENTRIES = 300;

let _syncStorage: ISyncStorage | undefined;
let _cache: ISWRStore | undefined;
let _dirty = false;
let _flushTimer: ReturnType<typeof setTimeout> | undefined;
let _lastReloadFromStorageAt: number | undefined;

// Only these entries were authored by this runtime since the last successful
// flush. Replaying the whole hydrated store would revive keys that the other
// runtime removed after this JS heap took its snapshot.
const _updatedKeys = new Set<string>();

// Deletions performed since the last successful flush. flush() merges with
// the store on disk, and without these a key deleted here would be revived
// by the copy of it still sitting there.
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
    _cache =
      getSyncStorage().getObject<ISWRStore>(
        EAppSyncStorageKeys.onekey_swr_cache,
      ) ?? {};
  } catch {
    _cache = {};
  }
  return _cache;
}

// getObject() collapses "no store yet" and "stored JSON failed to parse" into
// the same undefined, so flush() cannot tell them apart. Reading the raw string
// keeps them distinct: an unparseable store must not be treated as empty, or
// the merge below would persist only the pending keys and drop everything else.
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
    // The file is corrupt but this runtime still holds an intact copy. Swapping
    // it for an empty store would strand every namespace for the rest of the
    // session and leave the next flush nothing to repair the file with, since
    // flush() rebuilds from exactly this copy.
    //
    // The emptiness check is what makes that repair safe to schedule: a runtime
    // that first hydrated after the corruption also holds {}, and flushing that
    // would turn the file into a parseable empty store — which then costs the
    // runtime that does hold a full copy its only chance to restore it.
    _dirty = true;
    scheduleFlush();
  } else {
    _cache = store ?? {};
  }
  _lastReloadFromStorageAt = Date.now();
}

function evictOldestOverCap(store: ISWRStore) {
  const keys = Object.keys(store);
  if (keys.length <= MAX_ENTRIES) return;
  const sorted = keys.toSorted((a, b) => (store[a].t ?? 0) - (store[b].t ?? 0));
  const removeCount = keys.length - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    delete store[sorted[i]];
  }
}

function flush() {
  if (!_dirty || !_cache) return;
  try {
    // Merge per key instead of overwriting the whole object: on native the
    // main and bg runtimes each hold their own copy of this store (hydrated
    // once at boot) over one shared MMKV file, so a wholesale write from the
    // runtime holding the older copy erased everything the other one had
    // persisted since — days-old perps books kept resurfacing this way.
    const { store: disk, unreadable } = readStoreFromDisk();
    const merged: ISWRStore = {};
    if (unreadable) {
      // Nothing on disk is recoverable, so the other runtime's writes are
      // already lost and cannot be merged. Rebuilding from this runtime's copy
      // repairs the store; keeping only the pending keys would compound the
      // corruption by dropping every entry this copy still holds. Local
      // deletions are already absent from _cache, so none get revived.
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
    evictOldestOverCap(merged);
    // This merge prevents a stale runtime from blindly replacing newer entries,
    // but MMKV does not make the JS read-merge-write sequence transactional.
    getSyncStorage().setObject(EAppSyncStorageKeys.onekey_swr_cache, merged);
    // Adopting the merged store also refreshes this runtime's copy, which
    // otherwise only ages — reads pick up what the other runtime persisted.
    _cache = merged;
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
  _updatedKeys.add(key);
  _dirty = true;
  evictOldestOverCap(store);
  scheduleFlush();
}

function isFresh(key: string, maxAge: number): boolean {
  const entry = loadStore()[key];
  if (!entry) return false;
  return Date.now() - entry.t < maxAge;
}

function remove(key: string): void {
  const store = loadStore();
  delete store[key];
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
  const store = loadStore();
  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      delete store[key];
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
  swapStockTokenDetail: 'swapStockTokenDetail',
  swapStockSpeedConfig: 'swapStockSpeedConfig',
  swapStockPayTokenDetails: 'swapStockPayTokenDetails',
} as const;
export type ISwrCacheNamespace = (typeof NS)[keyof typeof NS];
export const swrCacheNamespaces = NS;
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;

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
    sortBy,
    sortType,
    pageSize,
    minLiquidity,
    type,
    category,
    timeFrame,
  }: {
    networkId: string;
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
      'v1',
      networkId,
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
  swapStockTokenDetail: ({ tokenScope }: { tokenScope: string }) =>
    [NS.swapStockTokenDetail, 'v1', tokenScope].join(':'),
  swapStockSpeedConfig: ({ networkId }: { networkId: string }) =>
    [NS.swapStockSpeedConfig, 'v1', networkId].join(':'),
  swapStockPayTokenDetails: ({ scope }: { scope: string }) =>
    [NS.swapStockPayTokenDetails, 'v1', scope].join(':'),
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
  const now = Date.now();
  const shouldReload =
    _lastReloadFromStorageAt === undefined ||
    now < _lastReloadFromStorageAt ||
    now - _lastReloadFromStorageAt >= reloadIfOlderThanMs;
  if ((!entry || (entryAgeMs ?? 0) > reloadIfOlderThanMs) && shouldReload) {
    reloadFromStorage();
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
