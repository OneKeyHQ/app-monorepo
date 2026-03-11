import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce, throttle } from 'lodash';
import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { earnTestnetNetworkIds } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
  useEarnPortfolioInvestmentsAtom,
} from '../../../states/jotai/contexts/earn';

import { useEarnAccountKey } from './useEarnAccountKey';

// ============================================================================
// Types
// ============================================================================

export interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}

interface IFetchInvestmentParams {
  publicKey?: string;
  vault?: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  symbol: string;
  accountId: string;
}

interface IFetchInvestmentResult {
  key: string;
  investment?: IEarnPortfolioInvestment;
  remove?: boolean;
}

interface IAccountAssetPair {
  isAirdrop: boolean;
  params: IFetchInvestmentParams;
}

// ============================================================================
// Pure Utility Functions
// ============================================================================

const createInvestmentKey = (item: {
  provider: string;
  symbol: string;
  vault?: string;
  networkId: string;
}): string =>
  `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

const resolveVault = ({
  protocolVault,
  requestVault,
}: {
  protocolVault?: string;
  requestVault?: string;
}) => protocolVault || requestVault;

const hasPositiveFiatValue = (value: string | undefined): boolean =>
  new BigNumber(value || '0').gt(0);

const isEarnTestnetNetwork = (networkId: string): boolean =>
  earnTestnetNetworkIds.includes(networkId);

const hasAnyAssets = (
  assets: Array<{
    assetsStatus?: Array<{ title: { text: string } }>;
    rewardAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean =>
  assets.length > 0 &&
  assets.some(
    (asset) =>
      (asset.assetsStatus && asset.assetsStatus.length > 0) ||
      (asset.rewardAssets && asset.rewardAssets.length > 0),
  );

const hasAnyAirdropAssets = (
  assets: Array<{
    airdropAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean =>
  assets.length > 0 &&
  assets.some((asset) => asset.airdropAssets && asset.airdropAssets.length > 0);

const sortByFiatValueDesc = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] =>
  investments.toSorted((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

const filterValidInvestments = (
  values: Iterable<IEarnPortfolioInvestment>,
): IEarnPortfolioInvestment[] =>
  Array.from(values).filter((inv) => {
    if (hasAnyAirdropAssets(inv.airdropAssets)) return true;
    if (isEarnTestnetNetwork(inv.network.networkId)) {
      return hasAnyAssets(inv.assets);
    }
    return hasPositiveFiatValue(inv.totalFiatValue);
  });

const createInvestmentKeyFromInvestment = (
  investment: IEarnPortfolioInvestment,
): string => {
  const firstAsset = investment.assets[0] || investment.airdropAssets[0];
  const resolvedVault = resolveVault({
    protocolVault: investment.protocol.vault,
    requestVault: firstAsset?.metadata?.protocol?.vault,
  });
  return createInvestmentKey({
    provider: investment.protocol.providerDetail.code,
    symbol: firstAsset?.token.info.symbol || '',
    vault: resolvedVault,
    networkId: investment.network.networkId,
  });
};

const buildInvestmentMapFromList = (
  investments: IEarnPortfolioInvestment[],
): Map<string, IEarnPortfolioInvestment> =>
  new Map(
    investments.map((inv) => [createInvestmentKeyFromInvestment(inv), inv]),
  );

const calculateTotalFiatValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, inv) => {
    if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
      return sum;
    }
    return sum.plus(new BigNumber(inv.totalFiatValue || '0'));
  }, new BigNumber(0));

const calculateTotalEarnings24hValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, inv) => {
    if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
      return sum;
    }
    return sum.plus(new BigNumber(inv.earnings24hFiatValue || '0'));
  }, new BigNumber(0));

const mergeInvestments = (
  existing: IEarnPortfolioInvestment,
  incoming: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => {
  const existingTotal = new BigNumber(existing.totalFiatValue || '0');
  const incomingTotal = new BigNumber(incoming.totalFiatValue || '0');
  const existingTotalUsd = new BigNumber(existing.totalFiatValueUsd || '0');
  const incomingTotalUsd = new BigNumber(incoming.totalFiatValueUsd || '0');

  return {
    ...existing,
    assets: [...existing.assets, ...incoming.assets],
    airdropAssets: [...existing.airdropAssets, ...incoming.airdropAssets],
    totalFiatValue: existingTotal.plus(incomingTotal).toFixed(),
    totalFiatValueUsd: existingTotalUsd.plus(incomingTotalUsd).toFixed(),
  };
};

const aggregateByProtocol = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] => {
  const protocolMap = investments.reduce((map, investment) => {
    const protocolKey = investment.protocol.providerDetail.code;
    const existing = map.get(protocolKey);

    if (existing) {
      map.set(protocolKey, mergeInvestments(existing, investment));
    } else {
      map.set(protocolKey, { ...investment });
    }

    return map;
  }, new Map<string, IEarnPortfolioInvestment>());

  return sortByFiatValueDesc(Array.from(protocolMap.values()));
};

// ============================================================================
// Investment Fetching
// ============================================================================

async function fetchSingleInvestment(
  params: IFetchInvestmentParams,
  isAirdrop: boolean,
): Promise<IFetchInvestmentResult | null> {
  if (isAirdrop) {
    const result =
      await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail(
        params,
      );

    const key = createInvestmentKey({
      provider: result.protocol.providerDetail.code,
      symbol: result.assets?.[0]?.token.info.symbol || '',
      vault: result.protocol.vault,
      networkId: result.network.networkId,
    });

    const enrichedAirdropAssets = result.assets.map((asset) => ({
      ...asset,
      metadata: {
        protocol: result.protocol,
        network: result.network,
      },
    }));

    return {
      key,
      investment: {
        totalFiatValue: '0',
        totalFiatValueUsd: '0',
        earnings24hFiatValue: '0',
        protocol: result.protocol,
        network: result.network,
        assets: [],
        airdropAssets: enrichedAirdropAssets,
      },
    };
  }

  const result =
    await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(params);

  const resolvedProtocolVault = resolveVault({
    protocolVault: result.protocol.vault,
    // Use request vault as fallback (Pendle PT market address).
    requestVault: params.vault,
  });
  const normalizedProtocol = resolvedProtocolVault
    ? { ...result.protocol, vault: resolvedProtocolVault }
    : result.protocol;

  const key = createInvestmentKey({
    provider: result.protocol.providerDetail.code,
    symbol: result.assets?.[0]?.token.info.symbol || '',
    vault: resolvedProtocolVault,
    networkId: result.network.networkId,
  });

  const shouldRemove = isEarnTestnetNetwork(result.network.networkId)
    ? !hasAnyAssets(result.assets)
    : !hasPositiveFiatValue(result.totalFiatValue);

  if (shouldRemove) {
    return { key, remove: true };
  }

  const enrichedAssets = result.assets.map((asset) => {
    const resolvedAssetVault = resolveVault({
      protocolVault: result.protocol.vault,
      requestVault: params.vault,
    });
    return {
      ...asset,
      metadata: {
        protocol: resolvedAssetVault
          ? { ...result.protocol, vault: resolvedAssetVault }
          : result.protocol,
        network: result.network,
        fiatValue: result.totalFiatValue,
        fiatValueUsd: result.totalFiatValueUsd,
        netPnl: result.netPnl,
        netPnlFiatValue: result.netPnlFiatValue,
      },
    };
  });

  return {
    key,
    investment: {
      totalFiatValue: result.totalFiatValue,
      totalFiatValueUsd: result.totalFiatValueUsd,
      earnings24hFiatValue: result.earnings24hFiatValue,
      netPnl: result.netPnl,
      netPnlFiatValue: result.netPnlFiatValue,
      protocol: normalizedProtocol,
      network: result.network,
      assets: enrichedAssets,
      airdropAssets: [],
    },
  };
}

// ============================================================================
// Custom Hooks
// ============================================================================

interface IInvestmentStateOptions {
  initialInvestments?: IEarnPortfolioInvestment[];
  initialTotalFiatValue?: string;
  initialTotalEarnings24hFiatValue?: string;
}

function useInvestmentState(options: IInvestmentStateOptions = {}) {
  const {
    initialInvestments,
    initialTotalFiatValue,
    initialTotalEarnings24hFiatValue,
  } = options;

  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    () => initialInvestments ?? [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    () => new BigNumber(initialTotalFiatValue || 0),
  );
  const [earnTotalEarnings24hFiatValue, setEarnTotalEarnings24hFiatValue] =
    useState<BigNumber>(
      () => new BigNumber(initialTotalEarnings24hFiatValue || 0),
    );

  const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(
    initialInvestments && initialInvestments.length > 0
      ? buildInvestmentMapFromList(initialInvestments)
      : new Map(),
  );

  const updateInvestments = useCallback(
    (
      newMap: Map<string, IEarnPortfolioInvestment>,
      shouldUpdateTotals = true,
    ): IEarnPortfolioInvestment[] => {
      const validInvestments = filterValidInvestments(newMap.values());
      const sorted = sortByFiatValueDesc(validInvestments);
      setInvestments(sorted);

      if (shouldUpdateTotals) {
        setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
        setEarnTotalEarnings24hFiatValue(
          calculateTotalEarnings24hValue(sorted),
        );
      }

      investmentMapRef.current = buildInvestmentMapFromList(validInvestments);
      return sorted;
    },
    [],
  );

  const clearInvestments = useCallback(() => {
    investmentMapRef.current.clear();
    setInvestments([]);
    setEarnTotalFiatValue(new BigNumber(0));
    setEarnTotalEarnings24hFiatValue(new BigNumber(0));
  }, []);

  return {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  };
}

interface IRequestControllerState {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  requestId: string;
  isLoadingNewAccount: boolean;
}

function useRequestController(
  accountId: string | undefined,
  indexedAccountId: string | undefined,
) {
  const stateRef = useRef<IRequestControllerState>({
    accountId,
    indexedAccountId,
    requestId: '',
    isLoadingNewAccount: true,
  });

  const hasAccountChanged = useCallback(() => {
    const state = stateRef.current;
    return (
      state.accountId !== accountId ||
      state.indexedAccountId !== indexedAccountId
    );
  }, [accountId, indexedAccountId]);

  const startNewRequest = useCallback(
    (isAccountChange = false) => {
      const newRequestId = generateUUID();
      stateRef.current = {
        accountId,
        indexedAccountId,
        requestId: newRequestId,
        isLoadingNewAccount: isAccountChange
          ? true
          : stateRef.current.isLoadingNewAccount,
      };
      return newRequestId;
    },
    [accountId, indexedAccountId],
  );

  const isRequestStale = useCallback((requestId: string) => {
    return requestId !== stateRef.current.requestId;
  }, []);

  const finishLoadingNewAccount = useCallback(() => {
    stateRef.current.isLoadingNewAccount = false;
  }, []);

  const isLoadingNewAccount = useCallback(() => {
    return stateRef.current.isLoadingNewAccount;
  }, []);

  return {
    hasAccountChanged,
    startNewRequest,
    isRequestStale,
    finishLoadingNewAccount,
    isLoadingNewAccount,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

export const useEarnPortfolio = ({
  isActive = true,
}: {
  isActive?: boolean;
} = {}): IUseEarnPortfolioReturn => {
  const isMountedRef = useRef(true);
  const isSyncingAtomRef = useRef(false);

  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const accountIdValue = account?.id ?? '';
  const indexedAccountIdValue = indexedAccount?.id ?? '';
  const accountIndexedAccountIdValue = account?.indexedAccountId;

  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();
  const [portfolioCache, setPortfolioCache] = useEarnPortfolioInvestmentsAtom();
  const earnAccountKey = useEarnAccountKey();

  const currentOverviewData =
    earnAccountKey && earnAccount ? earnAccount[earnAccountKey] : undefined;

  const cachedInvestments = useMemo(() => {
    if (!earnAccountKey) return undefined;
    return portfolioCache[earnAccountKey];
  }, [portfolioCache, earnAccountKey]);

  const [isLoading, setIsLoading] = useState(
    () => !(cachedInvestments && cachedInvestments.length > 0),
  );

  const {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  } = useInvestmentState({
    initialInvestments: cachedInvestments,
    initialTotalFiatValue: currentOverviewData?.totalFiatValue,
    initialTotalEarnings24hFiatValue: currentOverviewData?.earnings24h,
  });

  const {
    hasAccountChanged,
    startNewRequest,
    isRequestStale,
    finishLoadingNewAccount,
    isLoadingNewAccount,
  } = useRequestController(accountIdValue, indexedAccountIdValue);

  const lastSyncedValuesRef = useRef({ totalFiatValue: '', earnings24h: '' });

  // Throttled UI update for progressive loading
  const throttledUIUpdate = useMemo(
    () =>
      throttle(
        (newMap: Map<string, IEarnPortfolioInvestment>) => {
          updateInvestments(newMap, false);
        },
        500,
        { leading: true, trailing: true },
      ),
    [updateInvestments],
  );

  // Handle account changes
  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
      throttledUIUpdate.cancel();
      lastSyncedValuesRef.current = { totalFiatValue: '', earnings24h: '' };
      startNewRequest(true);
      setIsLoading(true);
    }
  }, [hasAccountChanged, clearInvestments, throttledUIUpdate, startNewRequest]);

  // Main fetch function
  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!isActive || !isMountedRef.current) return;

      const requestId = hasAccountChanged()
        ? startNewRequest(true)
        : startNewRequest(false);

      const requestMap = new Map(investmentMapRef.current);

      if (!accountIdValue && !indexedAccountIdValue) {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      const isPartialRefresh = Boolean(options);
      if (!isPartialRefresh && isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        const [assets, accounts] = await Promise.all([
          backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
          backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
            accountId: accountIdValue,
            networkId: allNetworkId,
            indexedAccountId:
              accountIndexedAccountIdValue || indexedAccountIdValue,
          }),
        ]);

        if (isRequestStale(requestId) || !isMountedRef.current) return;

        // Update earn accounts in global state
        if (earnAccountKey) {
          const normalizedAccounts = accounts.map((accountItem) => ({
            tokens: [],
            networkId: accountItem.networkId,
            accountAddress: accountItem.accountAddress,
            publicKey: accountItem.publicKey,
          }));
          const previousAccountData =
            actions.current.getEarnAccount(earnAccountKey) || {};
          actions.current.updateEarnAccounts({
            key: earnAccountKey,
            earnAccount: {
              ...previousAccountData,
              accounts: normalizedAccounts,
              isOverviewLoaded: true,
            },
          });
        }

        // Build account-asset pairs
        const accountAssetPairs: IAccountAssetPair[] = accounts.flatMap(
          (accountItem) =>
            assets
              .filter((asset) => asset.networkId === accountItem.networkId)
              .map((asset) => ({
                isAirdrop: asset.type === 'airdrop',
                params: {
                  accountId: accountIdValue || '',
                  accountAddress: accountItem.accountAddress,
                  networkId: accountItem.networkId,
                  provider: asset.provider,
                  symbol: asset.symbol,
                  ...(asset.vault && { vault: asset.vault }),
                  ...(accountItem.publicKey && {
                    publicKey: accountItem.publicKey,
                  }),
                },
              })),
        );

        // Filter pairs based on refresh options
        const pairsToFetch = options
          ? accountAssetPairs.filter((pair) => {
              const { params, isAirdrop } = pair;
              if (options.provider && params.provider !== options.provider)
                return false;
              if (options.networkId && params.networkId !== options.networkId)
                return false;
              if (options.symbol) {
                if (isAirdrop) {
                  if (
                    options.rewardSymbol &&
                    params.symbol !== options.rewardSymbol
                  ) {
                    return false;
                  }
                } else if (params.symbol !== options.symbol) {
                  return false;
                }
              }
              return true;
            })
          : accountAssetPairs;

        const keysUpdatedInThisSession = new Set<string>();
        const limit = pLimit(6);

        const tasks = pairsToFetch.map(({ params, isAirdrop }) =>
          limit(async () => {
            if (isRequestStale(requestId) || !isMountedRef.current) return;

            let result: IFetchInvestmentResult | null = null;
            try {
              result = await fetchSingleInvestment(params, isAirdrop);
            } catch (error) {
              console.warn(
                `[useEarnPortfolio] Failed to fetch investment for ${params.provider}/${params.symbol}:`,
                error,
              );
              return;
            }

            if (isRequestStale(requestId) || !isMountedRef.current || !result) {
              return;
            }

            // Skip outdated account responses
            if (params.accountId && params.accountId !== accountIdValue) {
              return;
            }

            const { key: resultKey, investment: newInv, remove } = result;

            if (remove) {
              requestMap.delete(resultKey);
              keysUpdatedInThisSession.add(resultKey);
              if (isMountedRef.current) {
                throttledUIUpdate(new Map(requestMap));
              }
              return;
            }

            if (!newInv) return;

            const existingInMap = requestMap.get(resultKey);
            const hasUpdatedInSession = keysUpdatedInThisSession.has(resultKey);

            let finalInv = newInv;
            if (hasUpdatedInSession && existingInMap) {
              finalInv = mergeInvestments(existingInMap, newInv);
            }

            keysUpdatedInThisSession.add(resultKey);
            requestMap.set(resultKey, finalInv);

            if (isMountedRef.current) {
              throttledUIUpdate(new Map(requestMap));
            }
          }),
        );

        await Promise.all(tasks);

        if (!isRequestStale(requestId) && isMountedRef.current) {
          throttledUIUpdate.flush();

          // Remove stale entries for full refresh
          if (!options) {
            Array.from(requestMap.keys()).forEach((key) => {
              if (!keysUpdatedInThisSession.has(key)) {
                requestMap.delete(key);
              }
            });
          }

          investmentMapRef.current = new Map(requestMap);

          const latestInvestments = updateInvestments(
            new Map(requestMap),
            true,
          );

          if (earnAccountKey && latestInvestments) {
            setPortfolioCache((prev) => ({
              ...prev,
              [earnAccountKey]: latestInvestments,
            }));
          }

          finishLoadingNewAccount();

          if (!isPartialRefresh && isMountedRef.current) {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('[useEarnPortfolio] Fetch investments failed:', error);
        if (
          !isRequestStale(requestId) &&
          !isPartialRefresh &&
          isMountedRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [
      isActive,
      accountIdValue,
      indexedAccountIdValue,
      accountIndexedAccountIdValue,
      allNetworkId,
      hasAccountChanged,
      startNewRequest,
      isRequestStale,
      earnAccountKey,
      actions,
      throttledUIUpdate,
      updateInvestments,
      setPortfolioCache,
      finishLoadingNewAccount,
      investmentMapRef,
    ],
  );

  // Polling with usePromiseResult
  usePromiseResult(
    fetchAndUpdateInvestments,
    [
      isActive,
      accountIdValue,
      indexedAccountIdValue,
      allNetworkId,
      fetchAndUpdateInvestments,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      overrideIsFocused: (isFocused) => isFocused && isActive,
    },
  );

  // Refresh function
  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      await fetchAndUpdateInvestments(options);
    },
    [fetchAndUpdateInvestments],
  );

  // Account data update listener (instance-scoped, not global)
  const fetchRef = useRef(fetchAndUpdateInvestments);
  useEffect(() => {
    fetchRef.current = fetchAndUpdateInvestments;
  }, [fetchAndUpdateInvestments]);

  const shouldRegisterAccountListener =
    isActive && (accountIdValue || indexedAccountIdValue);

  useEffect(() => {
    if (!shouldRegisterAccountListener) {
      return undefined;
    }

    const handleAccountDataUpdate = () => {
      if (isSyncingAtomRef.current) return;
      void fetchRef.current();
    };

    appEventBus.on(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountDataUpdate,
        handleAccountDataUpdate,
      );
    };
  }, [shouldRegisterAccountListener]);

  // Aggregate investments by protocol
  const aggregatedInvestments = useMemo(
    () => aggregateByProtocol(investments),
    [investments],
  );

  // Debounced global state sync
  const debouncedUpdateGlobalState = useMemo(() => {
    return debounce((key: string, fiatValue: string, earnings: string) => {
      const latestAccount = actions.current.getEarnAccount(key);
      if (!latestAccount) return;

      if (
        lastSyncedValuesRef.current.totalFiatValue === fiatValue &&
        lastSyncedValuesRef.current.earnings24h === earnings
      ) {
        return;
      }

      isSyncingAtomRef.current = true;
      lastSyncedValuesRef.current = {
        totalFiatValue: fiatValue,
        earnings24h: earnings,
      };

      actions.current.updateEarnAccounts({
        key,
        earnAccount: {
          ...latestAccount,
          totalFiatValue: fiatValue,
          earnings24h: earnings,
        },
      });

      setTimeout(() => {
        isSyncingAtomRef.current = false;
      }, 100);
    }, 500);
  }, [actions]);

  // Sync totals to global state
  useEffect(() => {
    if (!earnAccountKey || isLoadingNewAccount()) return;

    const totalFiatValueStr = earnTotalFiatValue.toFixed();
    const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

    if (
      lastSyncedValuesRef.current.totalFiatValue === totalFiatValueStr &&
      lastSyncedValuesRef.current.earnings24h === earnings24hStr
    ) {
      return;
    }

    debouncedUpdateGlobalState(
      earnAccountKey,
      totalFiatValueStr,
      earnings24hStr,
    );
  }, [
    earnAccountKey,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    debouncedUpdateGlobalState,
    isLoadingNewAccount,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      throttledUIUpdate.cancel();
      debouncedUpdateGlobalState.cancel();
      investmentMapRef.current.clear();
    };
  }, [throttledUIUpdate, debouncedUpdateGlobalState, investmentMapRef]);

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    isLoading,
    refresh,
  };
};
