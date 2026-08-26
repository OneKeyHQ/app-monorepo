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
    _cache =
      getSyncStorage().getObject<ISWRStore>(
        EAppSyncStorageKeys.onekey_swr_cache,
      ) ?? {};
  } catch {
    _cache = {};
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
    _cache = store;
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
    // Merged per key because main and bg each hold their own copy of this
    // store over one shared MMKV file: a wholesale write from the runtime
    // holding the older copy erased everything the other had persisted since.
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
    evictOldestOverCap(merged);
    // This merge prevents a stale runtime from blindly replacing newer entries,
    // but MMKV does not make the JS read-merge-write sequence transactional.
    getSyncStorage().setObject(EAppSyncStorageKeys.onekey_swr_cache, merged);
    // Adopting the merged store also refreshes this runtime's copy, which
    // otherwise only ages — reads pick up what the other runtime persisted.
    // Skipped without a store to merge against: `merged` is then only the
    // pending keys, and on a backend that persists nothing (both extension
    // runtimes get the no-op stub) this copy is the only one.
    if (disk) {
      _cache = merged;
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
  specifiedTokenSelectorView: 'specifiedTokenSelectorView',
  swapHistoryPreviewList: 'swapHistoryPreviewList',
  swapStockChart: 'swapStockChart',
  swapStockTokenDetail: 'swapStockTokenDetail',
  swapStockSpeedConfig: 'swapStockSpeedConfig',
  swapStockPayTokenDetails: 'swapStockPayTokenDetails',
  swapStockPositionsMetadata: 'swapStockPositionsMetadata',
  borrowMarkets: 'borrowMarkets',
  borrowReserves: 'borrowReserves',
  borrowHealthFactor: 'borrowHealthFactor',
  borrowRewards: 'borrowRewards',
  borrowEModeStatus: 'borrowEModeStatus',
  earnAccount: 'earnAccount',
  earnProtocolDetail: 'earnProtocolDetail',
} as const;
export type ISwrCacheNamespace = (typeof NS)[keyof typeof NS];
export const swrCacheNamespaces = NS;
export const prefixOf = (namespace: ISwrCacheNamespace) => `${namespace}:`;

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
  swapStockPositionsMetadata: ({ scope }: { scope: string }) =>
    [NS.swapStockPositionsMetadata, 'v1', scope].join(':'),
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
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    locale: string;
    currencyId: string;
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
