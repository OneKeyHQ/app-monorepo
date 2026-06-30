import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAllNetworkAccountInfo,
  IAllNetworkAccountsInfoResult,
} from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledSlidingWindow } from '@onekeyhq/shared/src/utils/promiseAllSettledSlidingWindow';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { perfTokenListView } from '../components/TokenListView/perfTokenListView';

import { makeColdRequestFactory } from './makeColdRequestFactory';
import { reorderNetworksByCachePriority } from './reorderNetworksByCachePriority';
import { shouldSkipRedundantAllNetworkRun } from './shouldSkipRedundantAllNetworkRun';
import { usePromiseResult } from './usePromiseResult';

// Native keeps a strict cap to avoid Hermes memory spikes.
// Web keeps full fan-out to preserve Home startup latency.
const getAllNetworkTaskConcurrencyLimit = (taskCount: number) =>
  platformEnv.isNative
    ? PROMISE_CONCURRENCY_LIMIT
    : Math.max(taskCount, PROMISE_CONCURRENCY_LIMIT);

// L4b: the token-list LIVE fan-out gets a dedicated, wider native cap so its
// bounded waves drain faster. iOS has the memory headroom for 16; low-end
// Android keeps the shared PROMISE_CONCURRENCY_LIMIT Hermes-OOM guard (#9986).
// Web keeps the full uncapped fan-out. NEVER bump the shared
// PROMISE_CONCURRENCY_LIMIT — it also gates history/market/search/staking/discovery.
const TOKEN_LIST_FAN_OUT_CONCURRENCY_LIMIT_IOS = 16;
const getTokenListFanOutConcurrencyLimit = (taskCount: number) => {
  if (!platformEnv.isNative) {
    return Math.max(taskCount, PROMISE_CONCURRENCY_LIMIT);
  }
  return platformEnv.isNativeIOS
    ? TOKEN_LIST_FAN_OUT_CONCURRENCY_LIMIT_IOS
    : PROMISE_CONCURRENCY_LIMIT;
};
type IAllNetworkAccountsBaseCacheKey = string;
type IAllNetworkAccountsBaseCacheEntry = {
  createdAt: number;
  promise: Promise<IAllNetworkAccountsInfoResult>;
};

const ALL_NETWORK_ACCOUNTS_BASE_CACHE_TTL_MS = 15_000;
const ALL_NETWORK_ACCOUNTS_BASE_CACHE_MAX_ENTRIES = 100;
const allNetworkAccountsBaseCache = new Map<
  IAllNetworkAccountsBaseCacheKey,
  IAllNetworkAccountsBaseCacheEntry
>();

function sweepAllNetworkAccountsBaseCache(now = Date.now()) {
  for (const [key, entry] of Array.from(
    allNetworkAccountsBaseCache.entries(),
  )) {
    if (now - entry.createdAt >= ALL_NETWORK_ACCOUNTS_BASE_CACHE_TTL_MS) {
      allNetworkAccountsBaseCache.delete(key);
    }
  }
  while (
    allNetworkAccountsBaseCache.size >
    ALL_NETWORK_ACCOUNTS_BASE_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = allNetworkAccountsBaseCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    allNetworkAccountsBaseCache.delete(oldestKey);
  }
}

function buildAllNetworkAccountsBaseCacheKey({
  walletId,
  accountId,
  networkId,
  networksEnabledOnly,
  excludeTestNetwork,
}: {
  walletId: string;
  accountId: string;
  networkId: string;
  networksEnabledOnly: boolean;
  excludeTestNetwork: boolean;
}): IAllNetworkAccountsBaseCacheKey {
  return [
    walletId,
    accountId,
    networkId,
    networksEnabledOnly ? '1' : '0',
    excludeTestNetwork ? '1' : '0',
  ].join('::');
}

function getAllNetworkAccountsBaseCached({
  walletId,
  accountId,
  networkId,
  networksEnabledOnly,
  excludeTestNetwork,
  skipCache,
}: {
  walletId: string;
  accountId: string;
  networkId: string;
  networksEnabledOnly: boolean;
  excludeTestNetwork: boolean;
  skipCache?: boolean;
}): {
  cacheKey: IAllNetworkAccountsBaseCacheKey;
  reused: boolean;
  promise: Promise<IAllNetworkAccountsInfoResult>;
} {
  const cacheKey = buildAllNetworkAccountsBaseCacheKey({
    walletId,
    accountId,
    networkId,
    networksEnabledOnly,
    excludeTestNetwork,
  });

  const now = Date.now();
  sweepAllNetworkAccountsBaseCache(now);
  const cached = allNetworkAccountsBaseCache.get(cacheKey);
  if (
    !skipCache &&
    cached &&
    now - cached.createdAt < ALL_NETWORK_ACCOUNTS_BASE_CACHE_TTL_MS
  ) {
    return { cacheKey, reused: true, promise: cached.promise };
  }
  if (cached) {
    allNetworkAccountsBaseCache.delete(cacheKey);
  }

  const baseTask = backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
    accountId,
    networkId,
    deriveType: undefined,
    nftEnabledOnly: false,
    DeFiEnabledOnly: false,
    excludeTestNetwork,
    networksEnabledOnly,
  });

  const promise: Promise<IAllNetworkAccountsInfoResult> = baseTask
    .then((res) => {
      // Don't cache empty results - new accounts may not have network accounts yet
      if (!res.accountsInfo.length) {
        const current = allNetworkAccountsBaseCache.get(cacheKey);
        if (current?.promise === promise) {
          allNetworkAccountsBaseCache.delete(cacheKey);
        }
      }
      return res;
    })
    .catch((error) => {
      const current = allNetworkAccountsBaseCache.get(cacheKey);
      if (current?.promise === promise) {
        allNetworkAccountsBaseCache.delete(cacheKey);
      }
      throw error;
    });

  allNetworkAccountsBaseCache.set(cacheKey, { createdAt: now, promise });
  sweepAllNetworkAccountsBaseCache(now);

  return { cacheKey, reused: false, promise };
}

function filterAllNetworkAccountsInfoResult({
  result,
  filterFn,
}: {
  result: IAllNetworkAccountsInfoResult;
  filterFn: (accountInfo: IAllNetworkAccountInfo) => boolean;
}): IAllNetworkAccountsInfoResult {
  return {
    accountsInfo: result.accountsInfo.filter(filterFn),
    accountsInfoBackendIndexed:
      result.accountsInfoBackendIndexed.filter(filterFn),
    accountsInfoBackendNotIndexed:
      result.accountsInfoBackendNotIndexed.filter(filterFn),
    allAccountsInfo: result.allAccountsInfo.filter(filterFn),
  };
}

type IEnabledNetworksCompatResult = {
  networkInfoMap: Record<string, INetworkDeriveInfo>;
  compatibleNetworks: IServerNetwork[];
  compatibleNetworksWithoutAccount: IServerNetwork[];
};

const getEmptyEnabledNetworksResult = (): IEnabledNetworksCompatResult => ({
  networkInfoMap: {},
  compatibleNetworks: [],
  compatibleNetworksWithoutAccount: [],
});

// const reorderByPinnedNetworkIds = async (items: IAllNetworkAccountInfo[]) => {
//   const priorityNetworkIds =
//     await backgroundApiProxy.serviceNetwork.getNetworkSelectorPinnedNetworkIds();

//   const priorityNetworkIdsMap = priorityNetworkIds.reduce(
//     (acc, item, index) => {
//       acc[item] = index;
//       return acc;
//     },
//     {} as Record<string, number>,
//   );

//   const priorityItems: IAllNetworkAccountInfo[] = [];
//   const normalItems: IAllNetworkAccountInfo[] = [];
//   for (let i = 0; i < items.length; i += 1) {
//     if (priorityNetworkIdsMap[items[i].networkId] !== undefined) {
//       priorityItems.push(items[i]);
//     } else {
//       normalItems.push(items[i]);
//     }
//   }
//   priorityItems.sort(
//     (a, b) =>
//       priorityNetworkIdsMap[a.networkId] - priorityNetworkIdsMap[b.networkId],
//   );
//   return [...priorityItems, ...normalItems];
// };

function useAllNetworkRequests<T>(params: {
  accountId: string | undefined;
  networkId: string | undefined;
  walletId: string | undefined;
  isAllNetworks: boolean | undefined;
  allNetworkRequests: ({
    accountId,
    networkId,
    dbAccount,
    allNetworkDataInit,
  }: {
    accountId: string;
    networkId: string;
    dbAccount?: IDBAccount;
    allNetworkDataInit?: boolean;
  }) => Promise<T | undefined>;
  allNetworkCacheRequests?: ({
    dbAccount,
    accountId,
    networkId,
    accountAddress,
    xpub,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }) => Promise<any>;
  allNetworkCacheData?: ({
    data,
    accountId,
    networkId,
    generation,
  }: {
    data: any;
    accountId: string;
    networkId: string;
    // Monotonic run generation (see runGenerationRef). Threaded into the LWW
    // materialized view's `seedFloor` so a stale earlier run's cache seed can
    // never clobber a newer run's live result.
    generation: number;
  }) => Promise<void>;
  allNetworkAccountsData?: ({
    accounts,
    allAccounts,
  }: {
    accounts: IAllNetworkAccountInfo[];
    allAccounts: IAllNetworkAccountInfo[];
  }) => void;
  clearAllNetworkData: () => void;
  abortAllNetworkRequests?: () => void;
  isNFTRequests?: boolean;
  isDeFiRequests?: boolean;
  disabled?: boolean;
  shouldAlwaysFetch?: boolean;
  onStarted?: ({
    accountId,
    networkId,
    allNetworkDataInit,
  }: {
    accountId?: string;
    networkId?: string;
    allNetworkDataInit?: boolean;
  }) => Promise<void>;
  onFinished?: ({
    accountId,
    networkId,
  }: {
    accountId?: string;
    networkId?: string;
  }) => Promise<void>;
  onCacheChecked?: ({
    accountId,
    networkId,
    hasCache,
  }: {
    accountId?: string;
    networkId?: string;
    hasCache: boolean;
  }) => Promise<void> | void;
  // Fires once per network as its live fetch settles (only on the steady-state
  // sliding-window branch). Lets the consumer paint progressively (L2) instead
  // of waiting for the whole fan-out. The monotonic run `generation` lets the
  // consumer's LWW materialized view reject a stale earlier run's settle.
  onRequestSettled?: (result: T, generation: number) => void;
  revalidateOnFocus?: boolean;
}) {
  type IAllNetworkRequestsRunConfig = {
    alwaysSetState?: boolean;
    skipAccountsCache?: boolean;
    ignoreDisabled?: boolean;
  };
  const {
    accountId: currentAccountId,
    networkId: currentNetworkId,
    walletId: currentWalletId,
    isAllNetworks,
    allNetworkRequests,
    allNetworkCacheRequests,
    allNetworkCacheData,
    allNetworkAccountsData,
    abortAllNetworkRequests,
    clearAllNetworkData,
    isNFTRequests,
    isDeFiRequests,
    disabled,
    shouldAlwaysFetch,
    onStarted,
    onFinished,
    onCacheChecked,
    onRequestSettled,
    revalidateOnFocus = false,
  } = params;
  const allNetworkDataInit = useRef(false);
  const isFetching = useRef(false);
  const runCountRef = useRef(0);
  // Monotonic run generation for the consumer's LWW materialized view. Unlike
  // `runCountRef` (reset to 0 on owner/enabled-network change), this is NEVER
  // reset — it must stay monotonic across same-owner re-runs so the LWW
  // generation guard (out-of-order/stale-write rejection) holds.
  const runGenerationRef = useRef(0);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);
  const [isLocked] = useAppIsLockedAtom();
  const [enabledNetworksChangedNonce, setEnabledNetworksChangedNonce] =
    useState(0);
  const rerunAfterCurrentRef = useRef(false);
  const rerunConfigRef = useRef<IAllNetworkRequestsRunConfig | undefined>(
    undefined,
  );
  const runWithQueueRef = useRef<
    ((config?: IAllNetworkRequestsRunConfig) => Promise<void>) | undefined
  >(undefined);
  // Single-shot signal that the next run should bypass the all-network
  // accounts base cache. usePromiseResult does not forward the runner config
  // into the method body, so we relay it through this ref and consume it
  // inside the runner.
  const skipAccountsCacheRef = useRef(false);
  const ignoreDisabledRef = useRef(false);
  // L5: relay `alwaysSetState` into the runner body (like skipAccountsCacheRef)
  // so the redundant-run gate can exempt every explicit refresh.
  // `lastRunSignatureRef` is the owner identity of the last run that proceeded.
  const alwaysSetStateRef = useRef(false);
  const lastRunSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const onEnabledNetworksChanged = () => {
      if (!isAllNetworks) {
        return;
      }
      allNetworkAccountsBaseCache.clear();
      allNetworkDataInit.current = false;
      runCountRef.current = 0;
      setEnabledNetworksChangedNonce((v) => v + 1);
      // owner intentionally omitted (this appEventBus-listener effect must not
      // depend on the owner); it appears on the following `allnet.run` line.
      void runWithQueueRef.current?.();
    };
    appEventBus.on(
      EAppEventBusNames.EnabledNetworksChanged,
      onEnabledNetworksChanged,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.EnabledNetworksChanged,
        onEnabledNetworksChanged,
      );
    };
  }, [isAllNetworks]);

  // Hardware wallets create default network accounts in series after connect
  // (BTC -> EVM -> TRON -> SOL). The 15s account-list cache can otherwise
  // capture a half-formed snapshot that contains only the first impl, which
  // makes Spot show only BTC and DeFi filter to an empty network set.
  // Invalidate this wallet's entries on every batch so the next run picks up
  // the latest DB account set. allNetworkDataInit stays as-is to avoid
  // clearAllNetworkData wiping the visible list between batches.
  useEffect(() => {
    if (!isAllNetworks) return;
    if (!currentWalletId) return;
    const walletIdAtSubscribe = currentWalletId;
    const onAddDBAccounts = (payload?: { walletId: string }) => {
      if (!payload?.walletId) return;
      if (payload.walletId !== walletIdAtSubscribe) return;
      const prefix = `${walletIdAtSubscribe}::`;
      for (const key of Array.from(allNetworkAccountsBaseCache.keys())) {
        if (key.startsWith(prefix)) {
          allNetworkAccountsBaseCache.delete(key);
        }
      }
      // alwaysSetState forces the runner past usePromiseResult's focus
      // check, otherwise the refresh is dropped when the consuming tab
      // (e.g. DeFi) is mounted but not the active tab during the HW connect
      // batch — the cache would be cleared but no fetch would actually run.
      // owner intentionally omitted (see enabledNetworks trigger above).
      void runWithQueueRef.current?.({
        skipAccountsCache: true,
        alwaysSetState: true,
      });
    };
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, onAddDBAccounts);
    return () => {
      appEventBus.off(EAppEventBusNames.AddDBAccountsToWallet, onAddDBAccounts);
    };
  }, [isAllNetworks, currentWalletId]);

  useEffect(() => {
    if (currentAccountId && currentNetworkId && currentWalletId) {
      allNetworkDataInit.current = false;
      runCountRef.current = 0;
      perfTokenListView.markStart('useAllNetworkRequestsRun_debounceDelay');
    }
  }, [
    currentAccountId,
    currentNetworkId,
    currentWalletId,
    isAllNetworks,
    isNFTRequests,
    isDeFiRequests,
    enabledNetworksChangedNonce,
  ]);

  const { run, result } = usePromiseResult(
    async () => {
      const ignoreDisabledForThisRun = ignoreDisabledRef.current;
      ignoreDisabledRef.current = false;
      const effectiveDisabled = disabled && !ignoreDisabledForThisRun;
      const shouldDebounceWait =
        !effectiveDisabled &&
        !isFetching.current &&
        !!currentAccountId &&
        !!currentNetworkId &&
        !!currentWalletId &&
        !!isAllNetworks &&
        runCountRef.current > 0;
      if (shouldDebounceWait) {
        await timerUtils.wait(POLLING_DEBOUNCE_INTERVAL);
      }
      perfTokenListView.markEnd(
        'useAllNetworkRequestsRun_debounceDelay',
        '执行 useAllNetworkRequests 的 usePromiseResult debounced 延迟: POLLING_DEBOUNCE_INTERVAL',
      );

      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__useAllNetworkRequests,
      });

      perfTokenListView.markStart('useAllNetworkRequestsRun');

      if (effectiveDisabled) return;
      if (isFetching.current) {
        rerunAfterCurrentRef.current = true;
        return;
      }
      if (!currentAccountId || !currentNetworkId || !currentWalletId) return;
      if (!isAllNetworks) return;

      // L5: drop redundant same-owner re-fires (usePromiseResult dep-identity
      // churn during/after a switch). Read+reset the relayed alwaysSetState
      // here; with skipAccountsCache / ignoreDisabled it marks every explicit
      // refresh as must-run, and owner/enabled-network changes reset
      // `allNetworkDataInit` — so neither is ever skipped.
      const alwaysSetStateForThisRun = alwaysSetStateRef.current;
      alwaysSetStateRef.current = false;
      const currentRunSignature = `${currentAccountId}|${currentNetworkId}|${currentWalletId}|${
        isNFTRequests ? 1 : 0
      }|${isDeFiRequests ? 1 : 0}`;
      const isMustRun =
        alwaysSetStateForThisRun ||
        skipAccountsCacheRef.current ||
        ignoreDisabledForThisRun;
      if (
        shouldSkipRedundantAllNetworkRun({
          isMustRun,
          allNetworkDataInit: allNetworkDataInit.current,
          currentSignature: currentRunSignature,
          lastSignature: lastRunSignatureRef.current,
        })
      ) {
        return;
      }
      lastRunSignatureRef.current = currentRunSignature;

      runCountRef.current += 1;
      runGenerationRef.current += 1;
      // Capture the generation for THIS run — threaded into the cache-seed
      // (`allNetworkCacheData`) and the per-network settle (`onRequestSettled`)
      // so the consumer's LWW materialized view rejects a stale earlier run.
      const runGeneration = runGenerationRef.current;
      isFetching.current = true;

      let onStartedError: unknown;
      let onStartedTask: Promise<void> | undefined;

      try {
        if (!allNetworkDataInit.current) {
          clearAllNetworkData();
        }

        abortAllNetworkRequests?.();

        perfMark('AllNet:useAllNetworkRequests:start', {
          isNFTRequests: !!isNFTRequests,
          isDeFiRequests: !!isDeFiRequests,
          allNetworkDataInit: !!allNetworkDataInit.current,
        });

        if (onStarted) {
          onStartedTask = onStarted({
            accountId: currentAccountId,
            networkId: currentNetworkId,
            allNetworkDataInit: allNetworkDataInit.current,
          }).catch((err) => {
            onStartedError = err;
          });
        }

        perf.markStart('getAllNetworkAccountsWithEnabledNetworks');
        const allNetAccountsStart = Date.now();
        perfMark('AllNet:getAllNetworkAccounts:start', {
          isNFTRequests: !!isNFTRequests,
          isDeFiRequests: !!isDeFiRequests,
        });

        const networksEnabledOnly = !accountUtils.isOthersAccount({
          accountId: currentAccountId,
        });

        const skipAccountsCacheForThisRun = skipAccountsCacheRef.current;
        skipAccountsCacheRef.current = false;

        const { promise: accountsTask } = getAllNetworkAccountsBaseCached({
          walletId: currentWalletId,
          accountId: currentAccountId,
          networkId: currentNetworkId,
          excludeTestNetwork: true,
          networksEnabledOnly,
          skipCache: skipAccountsCacheForThisRun,
        });

        const deFiEnabledNetworksMapTask = isDeFiRequests
          ? backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap()
          : undefined;

        const baseResult = await accountsTask;
        const deFiEnabledNetworksMap = deFiEnabledNetworksMapTask
          ? await deFiEnabledNetworksMapTask
          : undefined;

        let accountsInfoResult = baseResult;
        if (isNFTRequests) {
          accountsInfoResult = filterAllNetworkAccountsInfoResult({
            result: baseResult,
            filterFn: (acc) => acc.isNftEnabled,
          });
        } else if (isDeFiRequests) {
          accountsInfoResult = filterAllNetworkAccountsInfoResult({
            result: baseResult,
            filterFn: (acc) => !!deFiEnabledNetworksMap?.[acc.networkId],
          });
        }

        const {
          accountsInfo,
          accountsInfoBackendIndexed,
          accountsInfoBackendNotIndexed,
          allAccountsInfo,
        } = accountsInfoResult;
        perf.markEnd('getAllNetworkAccountsWithEnabledNetworks');
        perfMark('AllNet:getAllNetworkAccounts:done', {
          duration: Date.now() - allNetAccountsStart,
          counts: {
            accountsInfo: accountsInfo?.length ?? 0,
            accountsInfoBackendIndexed: accountsInfoBackendIndexed?.length ?? 0,
            accountsInfoBackendNotIndexed:
              accountsInfoBackendNotIndexed?.length ?? 0,
            allAccountsInfo: allAccountsInfo?.length ?? 0,
          },
        });

        setIsEmptyAccount(false);

        allNetworkAccountsData?.({
          accounts: accountsInfo,
          allAccounts: allAccountsInfo,
        });

        if (!accountsInfo || isEmpty(accountsInfo)) {
          setIsEmptyAccount(true);
        }

        let resp: Array<T> | null = null;

        // if (concurrentNetworks.length === 0 && sequentialNetworks.length === 0) {
        if (accountsInfo.length === 0) {
          setIsEmptyAccount(true);
        }

        if (onStartedTask) {
          await onStartedTask;
          if (onStartedError) {
            if (onStartedError instanceof Error) {
              // oxlint-disable-next-line no-throw-literal
              throw onStartedError;
            }
            const err = new Error('onStarted failed');
            throw err;
          }
        }

        // L3: networks whose local cache is non-empty (likely funded). Populated
        // by the cache probe below, consumed to prioritize the live fan-out so
        // the first concurrency wave fetches the user's real holdings first.
        const cachePriorityNetworkIds = new Set<string>();
        if (!allNetworkDataInit.current) {
          let cacheHasData = false;
          try {
            perf.markStart('allNetworkCacheRequests');
            const cachedData = (
              await promiseAllSettledEnhanced(
                Array.from(accountsInfo).map(
                  (networkDataString: IAllNetworkAccountInfo) => async () => {
                    const {
                      accountId,
                      networkId,
                      accountXpub,
                      apiAddress,
                      dbAccount,
                    } = networkDataString;
                    const cachedDataResult = await allNetworkCacheRequests?.({
                      dbAccount,
                      accountId,
                      networkId,
                      xpub: accountXpub,
                      accountAddress: apiAddress,
                    });
                    return cachedDataResult as unknown;
                  },
                ),
                {
                  continueOnError: true,
                  concurrency: getAllNetworkTaskConcurrencyLimit(
                    accountsInfo.length,
                  ),
                },
              )
            ).filter(Boolean);
            perf.markEnd('allNetworkCacheRequests');

            // `cachedData` is already filtered to non-null results — i.e. only
            // networks that returned cached (non-empty) tokens. Remember them
            // (L3) so the live fan-out fetches funded networks in the first wave.
            cachedData.forEach((d) => {
              const priorityNetworkId = (d as { networkId?: string } | null)
                ?.networkId;
              if (priorityNetworkId) {
                cachePriorityNetworkIds.add(priorityNetworkId);
              }
            });

            if (cachedData && !isEmpty(cachedData)) {
              cacheHasData = true;
              allNetworkDataInit.current = true;
              perf.done();
              perfTokenListView.markEnd(
                'useAllNetworkRequestsRun',
                '执行时间明细请查看 EPerformanceTimerLogNames.allNetwork__useAllNetworkRequests',
              );
              await allNetworkCacheData?.({
                data: cachedData,
                accountId: currentAccountId,
                networkId: currentNetworkId,
                generation: runGeneration,
              });
            }
          } catch (e) {
            console.error(e);
          } finally {
            try {
              await onCacheChecked?.({
                accountId: currentAccountId,
                networkId: currentNetworkId,
                hasCache: cacheHasData,
              });
            } catch (e) {
              console.error(e);
            }
          }
        }

        if (allNetworkDataInit.current) {
          const allNetworks = reorderNetworksByCachePriority(
            accountsInfo,
            cachePriorityNetworkIds,
          );
          const requestFactories = allNetworks.map((networkDataString) => {
            const { accountId, networkId, dbAccount } = networkDataString;
            return () =>
              allNetworkRequests({
                accountId,
                networkId,
                dbAccount,
                allNetworkDataInit: allNetworkDataInit.current,
              });
          });

          try {
            // L4a: sliding-window executor (worker-pool) replaces the
            // batch-barrier so a slow network no longer idles the rest of its
            // wave — the next network starts the instant a slot frees.
            // L4b: a dedicated native cap (iOS 16 / Android 8) drains the waves
            // faster on iOS without touching the shared PROMISE_CONCURRENCY_LIMIT.
            resp = (
              await promiseAllSettledSlidingWindow(requestFactories, {
                continueOnError: true,
                concurrency: getTokenListFanOutConcurrencyLimit(
                  requestFactories.length,
                ),
                // L2: hand each network's result to the consumer the instant it
                // settles, so it can paint progressively instead of waiting for
                // the whole fan-out.
                onSettled: (settledResult) => {
                  if (settledResult) {
                    onRequestSettled?.(settledResult, runGeneration);
                  }
                },
              })
            ).filter(Boolean);
          } catch (e) {
            console.error(e);
            resp = null;
            abortAllNetworkRequests?.();
          }
        } else {
          const respTemp: Array<T> = [];
          // Fix A: the COLD path must feed the progressive-paint pipeline the
          // same way the WARM path does via `onSettled`. `promiseAllSettledEnhanced`
          // has no `onSettled`, so each factory calls `onRequestSettled` itself
          // when it resolves (see `makeColdRequestFactory` for the full rationale
          // + the placeholder filter — extracted there so it is unit-tested).
          const makeColdFactory = (networkDataString: IAllNetworkAccountInfo) =>
            makeColdRequestFactory<T>({
              networkInfo: networkDataString,
              allNetworkRequests,
              onRequestSettled,
              runGeneration,
              getAllNetworkDataInit: () => allNetworkDataInit.current,
            });
          try {
            const factories = Array.from(accountsInfoBackendIndexed).map(
              makeColdFactory,
            );
            const r = (
              await promiseAllSettledEnhanced(factories, {
                continueOnError: true,
                concurrency: getAllNetworkTaskConcurrencyLimit(
                  factories.length,
                ),
              })
            ).filter(Boolean) as Array<T>;
            respTemp.push(...r);
          } catch (e) {
            console.error(e);
            // pass
          }

          try {
            const factories = Array.from(accountsInfoBackendNotIndexed).map(
              makeColdFactory,
            );
            const r = (
              await promiseAllSettledEnhanced(factories, {
                continueOnError: true,
                concurrency: getAllNetworkTaskConcurrencyLimit(
                  factories.length,
                ),
              })
            ).filter(Boolean) as Array<T>;
            respTemp.push(...r);
          } catch (e) {
            console.error(e);
            // pass
          }
          resp = respTemp.length ? respTemp : null;
        }
        if (accountsInfo.length && accountsInfo.length > 0) {
          allNetworkDataInit.current = true;
        }

        return resp;
      } finally {
        isFetching.current = false;
        // Wait for onStarted to settle before firing onFinished, so
        // the started/finished events for this run land in monotonic
        // order (true -> false). Without this, an early throw above
        // can fire onFinished while onStarted is still in flight,
        // letting a stale "isRefreshing: true" arrive after "false".
        if (onStartedTask) {
          try {
            await onStartedTask;
          } catch (e) {
            console.error(e);
          }
        }
        // Fire onFinished from finally so the "isRefreshing: false" signal
        // (consumed by DeFi tab's runAfterTokensDone) is always emitted —
        // even when the work above threw before reaching the prior call site.
        try {
          await onFinished?.({
            accountId: currentAccountId,
            networkId: currentNetworkId,
          });
        } catch (e) {
          console.error(e);
        }
        if (rerunAfterCurrentRef.current) {
          rerunAfterCurrentRef.current = false;
          const rerunConfig = rerunConfigRef.current;
          rerunConfigRef.current = undefined;
          setTimeout(() => {
            void runWithQueueRef.current?.(rerunConfig);
          }, 0);
        }
      }
    },
    [
      disabled,
      currentAccountId,
      currentNetworkId,
      currentWalletId,
      isAllNetworks,
      abortAllNetworkRequests,
      isNFTRequests,
      isDeFiRequests,
      allNetworkAccountsData,
      onStarted,
      onFinished,
      onCacheChecked,
      clearAllNetworkData,
      allNetworkCacheRequests,
      allNetworkCacheData,
      allNetworkRequests,
      onRequestSettled,
    ],
    {
      revalidateOnFocus,
      debounced: 0,
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused || !!shouldAlwaysFetch) && !isLocked,
    },
  );

  const runWithQueue = useCallback(
    async (config?: IAllNetworkRequestsRunConfig) => {
      if (isFetching.current) {
        rerunAfterCurrentRef.current = true;
        rerunConfigRef.current = {
          ...rerunConfigRef.current,
          ...config,
          alwaysSetState:
            !!rerunConfigRef.current?.alwaysSetState ||
            !!config?.alwaysSetState,
          skipAccountsCache:
            !!rerunConfigRef.current?.skipAccountsCache ||
            !!config?.skipAccountsCache,
          ignoreDisabled:
            !!rerunConfigRef.current?.ignoreDisabled ||
            !!config?.ignoreDisabled,
        };
        return;
      }
      if (config?.skipAccountsCache) {
        skipAccountsCacheRef.current = true;
      }
      if (config?.alwaysSetState) {
        alwaysSetStateRef.current = true;
      }
      if (config?.ignoreDisabled) {
        ignoreDisabledRef.current = true;
      }
      await run(config);
    },
    [run],
  );

  runWithQueueRef.current = runWithQueue;

  return {
    run: runWithQueue,
    result,
    isEmptyAccount,
  };
}

function useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
  walletId,
  networkId,
  filterNetworksWithoutAccount,
  indexedAccountId,
  withNetworksInfo = false,
  deferMs = 0,
  enabledNetworks: enabledNetworksParam,
}: {
  walletId: string;
  networkId?: string;
  filterNetworksWithoutAccount?: boolean;
  indexedAccountId?: string;
  withNetworksInfo?: boolean;
  deferMs?: number;
  enabledNetworks?: IServerNetwork[];
}) {
  const initResult = useMemo(() => getEmptyEnabledNetworksResult(), []);
  const enabledNetworkIdsKey = useMemo(() => {
    if (!enabledNetworksParam) {
      return '';
    }
    return Array.from(
      new Set(enabledNetworksParam.map((network) => network.id)),
    )
      .toSorted((a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      })
      .join(',');
  }, [enabledNetworksParam]);

  const { result, run } = usePromiseResult(
    async () => {
      if (!walletId) {
        return getEmptyEnabledNetworksResult();
      }
      const networkInfoMap: Record<string, INetworkDeriveInfo> = {};
      if (networkId && !networkUtils.isAllNetwork({ networkId })) {
        return getEmptyEnabledNetworksResult();
      }

      if (enabledNetworksParam && enabledNetworksParam.length === 0) {
        return getEmptyEnabledNetworksResult();
      }

      const [{ enabledNetworks, disabledNetworks }, networksResp] =
        await Promise.all([
          backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
          backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeTestNetwork: true,
            excludeAllNetworkItem: true,
          }),
        ]);
      const { networks } = networksResp;

      if (deferMs > 0) {
        await timerUtils.wait(deferMs);
      }

      let enabledNetworkIds: string[];

      if (enabledNetworksParam) {
        const enabledNetworkIdSet = new Set(
          enabledNetworksParam.map((n) => n.id),
        );
        enabledNetworkIds = networks
          .filter((n) => enabledNetworkIdSet.has(n.id))
          .map((n) => n.id);
      } else {
        enabledNetworkIds = networks
          .filter((n) =>
            isEnabledNetworksInAllNetworks({
              networkId: n.id,
              disabledNetworks,
              enabledNetworks,
              isTestnet: n.isTestnet,
            }),
          )
          .map((n) => n.id);
      }

      const compatibleNetworks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          {
            walletId,
            networkIds: enabledNetworkIds,
          },
        );

      const compatibleNetworksWithoutAccount: IServerNetwork[] = [];

      const mainnetItems = compatibleNetworks.mainnetItems;

      if (withNetworksInfo) {
        for (const network of mainnetItems) {
          const [globalDeriveType, vaultSettings] = await Promise.all([
            backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
              networkId: network.id,
            }),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: network.id,
            }),
          ]);
          const suffixToDeriveType: Record<string, string> = {};
          for (const [dt, info] of Object.entries(
            vaultSettings.accountDeriveInfo ?? {},
          )) {
            if (info.idSuffix) {
              suffixToDeriveType[info.idSuffix.toLowerCase()] = dt;
            }
          }
          networkInfoMap[network.id] = {
            deriveType: globalDeriveType,
            mergeDeriveAssetsEnabled: !!vaultSettings.mergeDeriveAssetsEnabled,
            suffixToDeriveType,
          };
        }
      }

      if (filterNetworksWithoutAccount && indexedAccountId) {
        const networksByImpl = compatibleNetworks.mainnetItems.reduce(
          (acc, network) => {
            if (!acc[network.impl]) {
              acc[network.impl] = [];
            }
            acc[network.impl].push(network);
            return acc;
          },
          {} as Record<string, IServerNetwork[]>,
        );

        const { accounts: allDbAccounts } =
          await backgroundApiProxy.serviceAccount.getAllAccounts();

        // Process networks by implementation group
        for (const [_, networksInGroup] of Object.entries(networksByImpl)) {
          const firstNetwork = networksInGroup[0];

          const [{ networkAccounts }, vaultSettings] = await Promise.all([
            backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                allDbAccounts,
                skipDbQueryIfNotFoundFromAllDbAccounts: true,
                indexedAccountId,
                networkId: firstNetwork.id,
                excludeEmptyAccount: true,
              },
            ),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: firstNetwork.id,
            }),
          ]);

          if (vaultSettings.mergeDeriveAssetsEnabled) {
            if (!networkAccounts || networkAccounts.length === 0) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            }
          } else {
            const currentDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: firstNetwork.id,
                },
              );

            if (!networkAccounts || networkAccounts.length === 0) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            } else if (
              !networkAccounts.some(
                (account) => account.deriveType === currentDeriveType,
              )
            ) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            }
          }
        }
      }

      const resultValue = {
        networkInfoMap,
        compatibleNetworks: mainnetItems,
        compatibleNetworksWithoutAccount,
      };
      return resultValue;
    },
    [
      walletId,
      networkId,
      filterNetworksWithoutAccount,
      indexedAccountId,
      withNetworksInfo,
      deferMs,
      enabledNetworksParam,
    ],
    {
      initResult,
      revalidateOnFocus: true,
      swrKey: walletId
        ? swrKeys.allNetworksCompatible({
            walletId,
            networkId,
            filterNetworksWithoutAccount,
            indexedAccountId,
            withNetworksInfo,
            enabledNetworkIdsKey,
          })
        : undefined,
    },
  );

  const enabledNetworksCompatibleWithWalletId =
    result?.compatibleNetworks ?? [];
  const enabledNetworksWithoutAccount =
    result?.compatibleNetworksWithoutAccount ?? [];

  return {
    networkInfoMap: result?.networkInfoMap ?? {},
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  };
}

export {
  useAllNetworkRequests,
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks,
};
