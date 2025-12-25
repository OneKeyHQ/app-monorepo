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
import type {
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
  useEarnPortfolioInvestmentsAtom,
} from '../../../states/jotai/contexts/earn';
import { useEarnAccountKey } from './useEarnAccountKey';

let currentAccountDataFetcher: (() => void) | null = null;
let accountDataUpdateListenerRegistered = false;
const handleAccountDataUpdateGlobal = () => {
  currentAccountDataFetcher?.();
};

function registerAccountDataUpdateFetcher(fetcher: () => void) {
  currentAccountDataFetcher = fetcher;
  if (!accountDataUpdateListenerRegistered) {
    appEventBus.on(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdateGlobal,
    );
    accountDataUpdateListenerRegistered = true;
  }
}

function unregisterAccountDataUpdateFetcher(fetcher: () => void) {
  if (currentAccountDataFetcher === fetcher) {
    currentAccountDataFetcher = null;
  }
  if (accountDataUpdateListenerRegistered && !currentAccountDataFetcher) {
    appEventBus.off(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdateGlobal,
    );
    accountDataUpdateListenerRegistered = false;
  }
}

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
  key: IInvestmentKey;
  investment?: IEarnPortfolioInvestment;
  remove?: boolean;
}

type IInvestmentKey = string;
type IInvestmentMap = Map<IInvestmentKey, IEarnPortfolioInvestment>;

const createInvestmentKey = (item: {
  provider: string;
  symbol: string;
  vault?: string;
  networkId: string;
}): IInvestmentKey =>
  `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

const hasPositiveFiatValue = (value: string | undefined): boolean =>
  new BigNumber(value || '0').gt(0);

const isEarnTestnetNetwork = (networkId: string): boolean =>
  earnTestnetNetworkIds.includes(networkId);

// Check if investment has any assets (for testnet networks)
// For testnet: check assetsStatus or rewardAssets instead of fiat value
const hasAnyAssets = (
  assets: Array<{
    assetsStatus?: Array<{ title: { text: string } }>;
    rewardAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean => {
  if (assets.length === 0) return false;
  return assets.some(
    (asset) =>
      (asset.assetsStatus && asset.assetsStatus.length > 0) ||
      (asset.rewardAssets && asset.rewardAssets.length > 0),
  );
};

const hasAnyAirdropAssets = (
  assets: Array<{
    airdropAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean => {
  if (assets.length === 0) return false;
  return assets.some(
    (asset) => asset.airdropAssets && asset.airdropAssets.length > 0,
  );
};

const sortByFiatValueDesc = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] =>
  [...investments].sort((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

const filterValidInvestments = (
  values: Iterable<IEarnPortfolioInvestment>,
): IEarnPortfolioInvestment[] =>
  Array.from(values).filter((inv) => {
    if (hasAnyAirdropAssets(inv.airdropAssets)) return true;
    // For testnet networks, check if there are any actual assets
    if (isEarnTestnetNetwork(inv.network.networkId)) {
      return hasAnyAssets(inv.assets);
    }
    return hasPositiveFiatValue(inv.totalFiatValue);
  });

const createInvestmentKeyFromInvestment = (
  investment: IEarnPortfolioInvestment,
): IInvestmentKey => {
  const firstAsset = investment.assets[0] || investment.airdropAssets[0];
  return createInvestmentKey({
    provider: investment.protocol.providerDetail.code,
    symbol: firstAsset?.token.info.symbol || '',
    vault: investment.protocol.vault,
    networkId: investment.network.networkId,
  });
};

const buildInvestmentMapFromList = (
  investments: IEarnPortfolioInvestment[],
): IInvestmentMap =>
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

const enrichAssetWithMetadata = (
  asset: IEarnInvestmentItemV2['assets'][number],
  investment: IEarnInvestmentItemV2,
): IEarnPortfolioInvestment['assets'][number] => ({
  ...asset,
  metadata: {
    protocol: investment.protocol,
    network: investment.network,
  },
});

const mergeInvestments = (
  existing: IEarnPortfolioInvestment,
  incoming: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => {
  const existingTotal = new BigNumber(existing.totalFiatValue || '0');
  const incomingTotal = new BigNumber(incoming.totalFiatValue || '0');

  return {
    ...existing,
    assets: [...existing.assets, ...incoming.assets],
    airdropAssets: [...existing.airdropAssets, ...incoming.airdropAssets],
    totalFiatValue: existingTotal.plus(incomingTotal).toFixed(),
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

const useInvestmentState = ({
  initialInvestments,
  initialTotalFiatValue,
  initialTotalEarnings24hFiatValue,
}: {
  initialInvestments?: IEarnPortfolioInvestment[];
  initialTotalFiatValue?: string;
  initialTotalEarnings24hFiatValue?: string;
} = {}) => {
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
  const investmentMapRef = useRef<IInvestmentMap>(
    initialInvestments && initialInvestments.length > 0
      ? buildInvestmentMapFromList(initialInvestments)
      : new Map(),
  );
  const isLoadingNewAccountRef = useRef(true);

  const updateInvestments = useCallback(
    (
      newMap: IInvestmentMap,
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
    isLoadingNewAccountRef.current = true;
    setEarnTotalFiatValue(new BigNumber(0));
    setEarnTotalEarnings24hFiatValue(new BigNumber(0));
  }, []);

  const finishLoadingNewAccount = useCallback(() => {
    isLoadingNewAccountRef.current = false;
  }, []);

  return {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
    finishLoadingNewAccount,
    isLoadingNewAccountRef,
  };
};

const useAccountState = (
  account?: { id: string } | null,
  indexedAccount?: { id: string } | null,
) => {
  const prevAccountRef = useRef({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
  });
  const currentRequestIdRef = useRef<string>('');

  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;

  const hasAccountChanged = useCallback(() => {
    return (
      prevAccountRef.current.accountId !== accountId ||
      prevAccountRef.current.indexedAccountId !== indexedAccountId
    );
  }, [accountId, indexedAccountId]);

  const markAccountChange = useCallback(() => {
    prevAccountRef.current = { accountId, indexedAccountId };
    currentRequestIdRef.current = generateUUID();
    return currentRequestIdRef.current;
  }, [accountId, indexedAccountId]);

  const startNewRequest = useCallback(() => {
    currentRequestIdRef.current = generateUUID();
    return currentRequestIdRef.current;
  }, []);

  const isRequestStale = useCallback((requestId: string) => {
    return requestId !== currentRequestIdRef.current;
  }, []);

  return {
    hasAccountChanged,
    markAccountChange,
    startNewRequest,
    isRequestStale,
  };
};

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
  const activeAccountIdRef = useRef(accountIdValue);
  useEffect(() => {
    activeAccountIdRef.current = accountIdValue;
  }, [accountIdValue]);

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
    finishLoadingNewAccount,
    isLoadingNewAccountRef,
  } = useInvestmentState({
    initialInvestments: cachedInvestments,
    initialTotalFiatValue: currentOverviewData?.totalFiatValue,
    initialTotalEarnings24hFiatValue: currentOverviewData?.earnings24h,
  });

  const {
    hasAccountChanged,
    markAccountChange,
    startNewRequest,
    isRequestStale,
  } = useAccountState(account, indexedAccount);

  const lastSyncedValuesRef = useRef<{
    totalFiatValue: string;
    earnings24h: string;
  }>({ totalFiatValue: '', earnings24h: '' });

  const throttledUIUpdate = useMemo(
    () =>
      throttle(
        (newMap: IInvestmentMap) => {
          updateInvestments(newMap, false);
        },
        500,
        { leading: true, trailing: true },
      ),
    [updateInvestments],
  );

  // Clean up throttled timer on unmount to avoid dangling timeouts
  useEffect(() => () => throttledUIUpdate.cancel(), [throttledUIUpdate]);

  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
      throttledUIUpdate.cancel();
      lastSyncedValuesRef.current = { totalFiatValue: '', earnings24h: '' };
      markAccountChange();
      setIsLoading(true);
    }
  }, [
    hasAccountChanged,
    clearInvestments,
    throttledUIUpdate,
    markAccountChange,
  ]);

  const fetchInvestmentDetail = useCallback(
    async (
      item: IFetchInvestmentParams,
      isAirdrop: boolean,
      requestId: string,
    ): Promise<IFetchInvestmentResult | null> => {
      try {
        if (isAirdrop) {
          const result =
            await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail(
              item,
            );
          if (isRequestStale(requestId)) return null;

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
              earnings24hFiatValue: '0',
              protocol: result.protocol,
              network: result.network,
              assets: [],
              airdropAssets: enrichedAirdropAssets,
            },
          };
        }

        const result =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(item);

        const key = createInvestmentKey({
          provider: result.protocol.providerDetail.code,
          symbol: result.assets?.[0]?.token.info.symbol || '',
          vault: result.protocol.vault,
          networkId: result.network.networkId,
        });

        if (isRequestStale(requestId)) {
          return null;
        }

        const shouldRemove = isEarnTestnetNetwork(result.network.networkId)
          ? !hasAnyAssets(result.assets)
          : !hasPositiveFiatValue(result.totalFiatValue);

        if (shouldRemove) {
          return {
            key,
            remove: true,
          };
        }

        const enrichedAssets = result.assets.map((asset) =>
          enrichAssetWithMetadata(asset, result),
        );

        return {
          key,
          investment: {
            totalFiatValue: result.totalFiatValue,
            earnings24hFiatValue: result.earnings24hFiatValue,
            protocol: result.protocol,
            network: result.network,
            assets: enrichedAssets,
            airdropAssets: [],
          },
        };
      } catch (error) {
        return null;
      }
    },
    [isRequestStale],
  );

  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!isMountedRef.current) return;

      const requestId = hasAccountChanged()
        ? markAccountChange()
        : startNewRequest();
      // Use a per-request map to avoid cross-request mutations
      const requestMap = new Map(investmentMapRef.current);

      if (!accountIdValue && !indexedAccountIdValue) {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      const isPartialRefresh = Boolean(options);
      if (!isPartialRefresh) {
        if (isMountedRef.current) {
          setIsLoading(true);
        }
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

        const accountAssetPairs = accounts.flatMap((accountItem) =>
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

        const pairsWithType = options
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

        const keysUpdatedInThisSession = new Set<IInvestmentKey>();
        const limit = pLimit(6);

        const tasks = pairsWithType.map(({ params, isAirdrop }) =>
          limit(async () => {
            if (isRequestStale(requestId) || !isMountedRef.current) return;

            const result = await fetchInvestmentDetail(
              params,
              isAirdrop,
              requestId,
            );

            // Skip outdated account responses
            if (
              params.accountId &&
              params.accountId !== activeAccountIdRef.current
            ) {
              return;
            }

            if (!isRequestStale(requestId) && isMountedRef.current && result) {
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
              const hasUpdatedInSession =
                keysUpdatedInThisSession.has(resultKey);

              let finalInv = newInv;

              if (hasUpdatedInSession && existingInMap) {
                finalInv = mergeInvestments(existingInMap, newInv);
              }

              keysUpdatedInThisSession.add(resultKey);
              requestMap.set(resultKey, finalInv);

              if (isMountedRef.current) {
                throttledUIUpdate(new Map(requestMap));
              }
            }
          }),
        );

        await Promise.all(tasks);

        if (!isRequestStale(requestId) && isMountedRef.current) {
          throttledUIUpdate.flush();

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

          if (!isPartialRefresh) {
            if (isMountedRef.current) {
              setIsLoading(false);
            }
          }
        }
      } catch (e) {
        console.error('Fetch investments failed', e);
        if (
          !isRequestStale(requestId) &&
          !isPartialRefresh &&
          isMountedRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accountIdValue,
      indexedAccountIdValue,
      accountIndexedAccountIdValue,
      allNetworkId,
      hasAccountChanged,
      markAccountChange,
      startNewRequest,
      isRequestStale,
      earnAccountKey,
      actions,
      fetchInvestmentDetail,
      throttledUIUpdate,
      updateInvestments,
      setPortfolioCache,
    ],
  );

  usePromiseResult(
    fetchAndUpdateInvestments,
    [
      accountIdValue,
      indexedAccountIdValue,
      allNetworkId,
      fetchAndUpdateInvestments,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      await fetchAndUpdateInvestments(options);
    },
    [fetchAndUpdateInvestments],
  );

  const fetchRef = useRef(fetchAndUpdateInvestments);
  useEffect(() => {
    fetchRef.current = fetchAndUpdateInvestments;
  }, [fetchAndUpdateInvestments]);

  const shouldRegisterAccountListener =
    isActive && (accountIdValue || indexedAccountIdValue);
  useEffect(() => {
    if (!shouldRegisterAccountListener) {
      return () => undefined;
    }

    const fetcher = () => {
      if (isSyncingAtomRef.current) return;
      void fetchRef.current();
    };
    registerAccountDataUpdateFetcher(fetcher);
    return () => {
      unregisterAccountDataUpdateFetcher(fetcher);
    };
  }, [shouldRegisterAccountListener, accountIdValue, indexedAccountIdValue]);

  const aggregatedInvestments = useMemo(
    () => aggregateByProtocol(investments),
    [investments],
  );

  const debouncedUpdateGlobalState = useMemo(() => {
    const fn = debounce((key: string, fiatValue: string, earnings: string) => {
      const latestAccount = actions.current.getEarnAccount(key);
      if (!latestAccount) return;

      // Prevent unnecessary updates if values haven't actually changed
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

      // release flag shortly after writing to atom
      setTimeout(() => {
        isSyncingAtomRef.current = false;
      }, 100);
    }, 500);
    return fn;
  }, [actions]);

  useEffect(
    () => () => {
      debouncedUpdateGlobalState.cancel();
    },
    [debouncedUpdateGlobalState],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      throttledUIUpdate.cancel();
      debouncedUpdateGlobalState.cancel();
      investmentMapRef.current.clear();

      // CRITICAL: Clear all refs to release memory
      fetchRef.current = null as any;
      lastSyncedValuesRef.current = { totalFiatValue: '', earnings24h: '' };
      isSyncingAtomRef.current = false;
      isLoadingNewAccountRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUpdateGlobalState, throttledUIUpdate, investmentMapRef]);

  useEffect(() => {
    if (!earnAccountKey) return;

    // Using ref to avoid triggering effect on every account load state change
    if (isLoadingNewAccountRef.current) return;

    const totalFiatValueStr = earnTotalFiatValue.toFixed();
    const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

    // Check if values have actually changed from what we last synced
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
    // isLoadingNewAccountRef is intentionally not in deps - it's a ref for optimization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    earnAccountKey,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    debouncedUpdateGlobalState,
  ]);

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    isLoading,
    refresh,
  };
};
