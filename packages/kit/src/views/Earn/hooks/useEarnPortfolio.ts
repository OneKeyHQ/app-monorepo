import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}

type IInvestmentKey = string;
type IInvestmentMap = Map<IInvestmentKey, IEarnPortfolioInvestment>;

// Pure utility functions
const createInvestmentKey = (item: {
  provider: string;
  symbol: string;
  vault?: string;
  networkId: string;
}): IInvestmentKey =>
  `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

const hasPositiveFiatValue = (value: string | undefined): boolean =>
  new BigNumber(value || '0').gt(0);

const sortByFiatValueDesc = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] =>
  [...investments].sort((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

const calculateTotalFiatValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, inv) => {
    // Skip airdrop-only investments (investments with only airdropAssets and no normal assets)
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

const hasListaCheckAction = (investment: IEarnPortfolioInvestment): boolean =>
  investment.airdropAssets?.some((airdrop) =>
    (airdrop.airdropAssets || []).some(
      (reward) => reward.button?.type === 'listaCheck',
    ),
  ) ?? false;

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

// Custom hook for managing investment state
const useInvestmentState = () => {
  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [earnTotalEarnings24hFiatValue, setEarnTotalEarnings24hFiatValue] =
    useState<BigNumber>(new BigNumber(0));
  const investmentMapRef = useRef<IInvestmentMap>(new Map());

  const updateInvestments = useCallback((newMap: IInvestmentMap) => {
    // Filter out zero-value investments (including airdrops)
    const validInvestments = Array.from(newMap.values()).filter((inv) => {
      // Always keep investments that surface listaCheck actions even if fiat value is 0
      if (hasListaCheckAction(inv)) {
        return true;
      }
      // Only keep investments with positive fiat value
      return hasPositiveFiatValue(inv.totalFiatValue);
    });

    const sorted = sortByFiatValueDesc(validInvestments);
    setInvestments(sorted);
    setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
    setEarnTotalEarnings24hFiatValue(calculateTotalEarnings24hValue(sorted));
    investmentMapRef.current = new Map(
      validInvestments.map((inv) => {
        const firstAsset = inv.assets[0] || inv.airdropAssets[0];
        return [
          createInvestmentKey({
            provider: inv.protocol.providerDetail.code,
            symbol: firstAsset?.token.info.symbol || '',
            vault: inv.protocol.vault,
            networkId: inv.network.networkId,
          }),
          inv,
        ];
      }),
    );
  }, []);

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
};

// Custom hook for managing account state
const useAccountState = (
  account?: { id: string } | null,
  indexedAccount?: { id: string } | null,
) => {
  const prevAccountRef = useRef({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
  });
  const currentRequestIdRef = useRef(0);

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
    currentRequestIdRef.current += 1;
  }, [accountId, indexedAccountId]);

  const isRequestStale = useCallback((requestId: number) => {
    return requestId !== currentRequestIdRef.current;
  }, []);

  const getCurrentRequestId = useCallback(
    () => currentRequestIdRef.current,
    [],
  );

  return {
    hasAccountChanged,
    markAccountChange,
    isRequestStale,
    getCurrentRequestId,
  };
};

export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

export const useEarnPortfolio = (): IUseEarnPortfolioReturn => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = getNetworkIdsMap().onekeyall;
  const accountIdValue = account?.id ?? '';
  const indexedAccountIdValue = indexedAccount?.id ?? '';
  const accountIndexedAccountIdValue = account?.indexedAccountId;
  const [isLoading, setIsLoading] = useState(true);
  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();

  const {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  } = useInvestmentState();

  const {
    hasAccountChanged,
    markAccountChange,
    isRequestStale,
    getCurrentRequestId,
  } = useAccountState(account, indexedAccount);

  const earnAccountKey = useMemo(
    () =>
      actions.current.buildEarnAccountsKey({
        accountId: accountIdValue || undefined,
        indexAccountId:
          accountIndexedAccountIdValue || indexedAccountIdValue || undefined,
        networkId: allNetworkId,
      }),
    [
      actions,
      accountIdValue,
      accountIndexedAccountIdValue,
      indexedAccountIdValue,
      allNetworkId,
    ],
  );

  // Handle account changes
  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
    }
  }, [hasAccountChanged, clearInvestments]);

  const fetchInvestmentDetail = useCallback(
    async (
      item: {
        accountAddress: string;
        networkId: string;
        provider: string;
        symbol: string;
        vault?: string;
        publicKey?: string;
      },
      isAirdrop: boolean,
      requestId: number,
    ) => {
      try {
        if (isAirdrop) {
          const result =
            await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail(
              item,
            );

          if (isRequestStale(requestId)) {
            return null;
          }

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

          const investment: IEarnPortfolioInvestment = {
            totalFiatValue: '0',
            earnings24hFiatValue: '0',
            protocol: result.protocol,
            network: result.network,
            assets: [],
            airdropAssets: enrichedAirdropAssets,
          };

          return { key, investment };
        }

        const result =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(item);

        if (
          isRequestStale(requestId) ||
          !hasPositiveFiatValue(result.totalFiatValue)
        ) {
          return null;
        }

        const key = createInvestmentKey({
          provider: result.protocol.providerDetail.code,
          symbol: result.assets?.[0]?.token.info.symbol || '',
          vault: result.protocol.vault,
          networkId: result.network.networkId,
        });

        const enrichedAssets = result.assets.map((asset) =>
          enrichAssetWithMetadata(asset, result),
        );

        const investment: IEarnPortfolioInvestment = {
          totalFiatValue: result.totalFiatValue,
          earnings24hFiatValue: result.earnings24hFiatValue,
          protocol: result.protocol,
          network: result.network,
          assets: enrichedAssets,
          airdropAssets: [],
        };

        return { key, investment };
      } catch (error) {
        return null;
      }
    },
    [isRequestStale],
  );

  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!accountIdValue && !indexedAccountIdValue) {
        setIsLoading(false);
        return;
      }

      // Check if account changed and update requestId BEFORE getting current requestId
      // This ensures the new fetch uses the updated requestId
      if (hasAccountChanged()) {
        markAccountChange();
      }

      const requestId = getCurrentRequestId();
      // Only set loading state for full refresh, not for partial refresh
      const isPartialRefresh = Boolean(options);
      if (!isPartialRefresh) {
        setIsLoading(true);
      }

      const [assets, accounts] = await Promise.all([
        backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
        backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
          accountId: accountIdValue,
          networkId: allNetworkId,
          indexedAccountId:
            accountIndexedAccountIdValue || indexedAccountIdValue,
        }),
      ]);

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

      // Filter pairs directly
      const pairsWithType = options
        ? accountAssetPairs.filter((pair) => {
            const { params, isAirdrop } = pair;
            if (options.provider && params.provider !== options.provider)
              return false;
            if (options.networkId && params.networkId !== options.networkId)
              return false;
            // For symbol filtering:
            // - Normal assets: match against options.symbol (staked token symbol)
            // - Airdrop assets: match against options.rewardSymbol (reward token symbol)
            if (options.symbol) {
              if (isAirdrop) {
                // For airdrop, check if rewardSymbol is provided and matches
                if (
                  options.rewardSymbol &&
                  params.symbol !== options.rewardSymbol
                ) {
                  return false;
                }
                // If no rewardSymbol provided, skip symbol check for airdrops
                // This allows refreshing all airdrops for the provider
              } else if (params.symbol !== options.symbol) {
                // For normal assets, match symbol directly
                return false;
              }
            }
            return true;
          })
        : accountAssetPairs;

      // Track which keys we fetched in this round
      const fetchedKeys = new Set<IInvestmentKey>();
      // Collect new data in this refresh batch
      const batchMap = new Map<IInvestmentKey, IEarnPortfolioInvestment>();

      // Create fetch promises
      const fetchPromises = pairsWithType.map(({ params, isAirdrop }) => {
        const key = createInvestmentKey(params);
        fetchedKeys.add(key);
        return fetchInvestmentDetail(params, isAirdrop, requestId);
      });

      // Wait for all promises to complete and collect results
      const results = await Promise.allSettled(fetchPromises);

      // Process all results at once after all fetches complete
      if (!isRequestStale(requestId)) {
        results.forEach((result) => {
          if (result.status !== 'fulfilled' || !result.value) return;

          const { key, investment } = result.value;

          // Merge with existing data for the same key
          const existing = batchMap.get(key);
          if (existing) {
            batchMap.set(key, {
              ...existing,
              assets: [...existing.assets, ...investment.assets],
              airdropAssets: [
                ...existing.airdropAssets,
                ...investment.airdropAssets,
              ],
              totalFiatValue: new BigNumber(existing.totalFiatValue || '0')
                .plus(new BigNumber(investment.totalFiatValue || '0'))
                .toFixed(),
            });
          } else {
            batchMap.set(key, investment);
          }
        });

        // After all fetches complete, apply final updates and remove stale keys
        const finalMap = new Map(investmentMapRef.current);

        // Apply all batch data to final map
        batchMap.forEach((value, key) => {
          finalMap.set(key, value);
        });

        // Only remove stale keys if this is a full refresh (no filter options)
        // If options are provided, we're doing a partial refresh and shouldn't delete other data
        if (!options) {
          Array.from(finalMap.keys()).forEach((key) => {
            if (!fetchedKeys.has(key)) {
              finalMap.delete(key);
            }
          });
        }

        // Single update after all data is collected
        updateInvestments(finalMap);
        // Only clear loading state for full refresh
        if (!isPartialRefresh) {
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
      getCurrentRequestId,
      fetchInvestmentDetail,
      updateInvestments,
      isRequestStale,
      hasAccountChanged,
      markAccountChange,
      earnAccountKey,
      actions,
      // investmentMapRef is a ref, doesn't need to be in deps
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
      revalidateOnReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      alwaysSetState: true,
    },
  );

  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      await fetchAndUpdateInvestments(options);
    },
    [fetchAndUpdateInvestments],
  );

  const aggregatedInvestments = useMemo(
    () => aggregateByProtocol(investments),
    [investments],
  );

  useEffect(() => {
    if (!earnAccountKey) return;
    const currentAccount = earnAccount?.[earnAccountKey];
    if (!currentAccount) return;

    const totalFiatValueStr = earnTotalFiatValue.toFixed();
    const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

    // Only update if values actually changed to prevent infinite loops
    if (
      currentAccount.totalFiatValue === totalFiatValueStr &&
      currentAccount.earnings24h === earnings24hStr
    ) {
      return;
    }

    actions.current.updateEarnAccounts({
      key: earnAccountKey,
      earnAccount: {
        ...currentAccount,
        totalFiatValue: totalFiatValueStr,
        earnings24h: earnings24hStr,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    earnAccountKey,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    // Do NOT include earnAccount or actions to prevent infinite loops
    // earnAccount will trigger updates when we call updateEarnAccounts
  ]);

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    isLoading,
    refresh,
  };
};
