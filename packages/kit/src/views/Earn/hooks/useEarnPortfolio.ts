import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useAllNetworkId } from './useAllNetworkId';

interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
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
  investments.reduce(
    (sum, inv) => sum.plus(new BigNumber(inv.totalFiatValue || '0')),
    new BigNumber(0),
  );

const filterByOptions = <
  T extends { provider: string; networkId: string; symbol: string },
>(
  list: Array<T>,
  options?: IRefreshOptions,
): T[] => {
  if (!options) return list;

  return list.filter((item) => {
    if (options.provider && item.provider !== options.provider) return false;
    if (options.networkId && item.networkId !== options.networkId) return false;
    if (options.symbol && item.symbol !== options.symbol) return false;
    return true;
  });
};

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
  const investmentMapRef = useRef<IInvestmentMap>(new Map());

  const updateInvestments = useCallback((newMap: IInvestmentMap) => {
    // Filter out zero-value investments
    // BUT keep airdrop investments even if their value is 0
    const validInvestments = Array.from(newMap.values()).filter((inv) => {
      const hasAirdrop = inv.airdropAssets && inv.airdropAssets.length > 0;
      const hasNormalAssets = hasPositiveFiatValue(inv.totalFiatValue);
      return hasAirdrop || hasNormalAssets;
    });

    const sorted = sortByFiatValueDesc(validInvestments);
    setInvestments(sorted);
    setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
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
  }, []);

  return {
    investments,
    earnTotalFiatValue,
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

export const useEarnPortfolio = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = useAllNetworkId();
  const [isLoading, setIsLoading] = useState(true);

  const {
    investments,
    earnTotalFiatValue,
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

  // Handle account changes
  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
      markAccountChange();
    }
  }, [hasAccountChanged, markAccountChange, clearInvestments]);

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
            totalFiatValue: result.totalFiatValue,
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
      if (!account && !indexedAccount) {
        setIsLoading(false);
        return;
      }

      const requestId = getCurrentRequestId();
      setIsLoading(true);

      const [assets, accounts] = await Promise.all([
        backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
        backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        }),
      ]);

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
            const { params } = pair;
            if (options.provider && params.provider !== options.provider)
              return false;
            if (options.networkId && params.networkId !== options.networkId)
              return false;
            if (options.symbol && params.symbol !== options.symbol)
              return false;
            return true;
          })
        : accountAssetPairs;

      // Track which keys we fetched in this round
      const fetchedKeys = new Set<IInvestmentKey>();
      // Collect new data in this refresh batch
      const batchMap = new Map<IInvestmentKey, IEarnPortfolioInvestment>();

      // RAF throttling for batch updates
      let rafId: number | null = null;
      let pendingUpdate = false;

      const scheduleUpdate = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          if (isRequestStale(requestId)) return;

          const updatedMap = new Map(investmentMapRef.current);
          batchMap.forEach((value, batchKey) => {
            updatedMap.set(batchKey, value);
          });
          updateInvestments(updatedMap);
          pendingUpdate = false;
          rafId = null;
        });
      };

      // Create fetch promises
      const fetchPromises = pairsWithType.map(({ params, isAirdrop }) => {
        const key = createInvestmentKey(params);
        fetchedKeys.add(key);
        return fetchInvestmentDetail(params, isAirdrop, requestId);
      });

      // Process results incrementally
      const processResult = (
        result: Awaited<ReturnType<typeof fetchInvestmentDetail>>,
      ) => {
        if (!result || isRequestStale(requestId)) return;

        const { key, investment } = result;

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

        // Schedule batched update via RAF
        scheduleUpdate();
      };

      // Process each result as it arrives
      for (const promise of fetchPromises) {
        void promise.then(processResult);
      }

      await Promise.allSettled(fetchPromises);

      // Cancel any pending RAF before final update
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (!isRequestStale(requestId)) {
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

        updateInvestments(finalMap);
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      account,
      indexedAccount,
      allNetworkId,
      getCurrentRequestId,
      fetchInvestmentDetail,
      updateInvestments,
      isRequestStale,
      // investmentMapRef is a ref, doesn't need to be in deps
    ],
  );

  usePromiseResult(
    fetchAndUpdateInvestments,
    [account, allNetworkId, indexedAccount, fetchAndUpdateInvestments],
    {
      watchLoading: true,
      revalidateOnReconnect: true,
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

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    isLoading,
    refresh,
  };
};
