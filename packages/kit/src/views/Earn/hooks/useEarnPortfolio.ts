import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useAllNetworkId } from './useAllNetworkId';

interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
}

export const useEarnPortfolio = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = useAllNetworkId();
  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [earnings24h, setEarnings24h] = useState<BigNumber>(new BigNumber(0));
  const [isLoading, setIsLoading] = useState(true);

  // Track previous account to detect account changes
  const prevAccountRef = useRef<{
    accountId?: string;
    indexedAccountId?: string;
  }>({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
  });

  // Use ref to store investment map for incremental updates
  const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(
    new Map(),
  );

  const getInvestmentKey = useCallback(
    (item: {
      provider: string;
      symbol: string;
      vault?: string;
      networkId: string;
    }) =>
      `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`,
    [],
  );

  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!account && !indexedAccount) {
        setIsLoading(false);
        return;
      }

      // Detect account change
      const accountChanged =
        prevAccountRef.current.accountId !== account?.id ||
        prevAccountRef.current.indexedAccountId !== indexedAccount?.id;

      if (accountChanged) {
        // Clear all data on account change
        investmentMapRef.current.clear();
        setInvestments([]);
        setEarnTotalFiatValue(new BigNumber(0));
        setEarnings24h(new BigNumber(0));
        prevAccountRef.current = {
          accountId: account?.id,
          indexedAccountId: indexedAccount?.id,
        };
      }

      setIsLoading(true);

      const assets =
        await backgroundApiProxy.serviceStaking.getAvailableAssetsV2();
      const accounts =
        await backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });

      const list = accounts.flatMap((item) => {
        const accountAssets = assets.filter(
          (asset) => asset.networkId === item.networkId,
        );
        return accountAssets.map((asset) => ({
          accountAddress: item.accountAddress,
          networkId: item.networkId,
          provider: asset.provider,
          symbol: asset.symbol,
          ...(asset.vault && { vault: asset.vault }),
          ...(item.publicKey && { publicKey: item.publicKey }),
        }));
      });

      // Filter list based on options for targeted refresh
      const filteredList = options
        ? list.filter(
            (item: { provider: string; networkId: string; symbol: string }) => {
              if (options.provider && item.provider !== options.provider)
                return false;
              if (options.networkId && item.networkId !== options.networkId)
                return false;
              if (options.symbol && item.symbol !== options.symbol)
                return false;
              return true;
            },
          )
        : list;

      const uniqueList = Array.from(
        filteredList
          .reduce((map, item) => {
            const key = getInvestmentKey(item);
            if (!map.has(key)) {
              map.set(key, item);
            }
            return map;
          }, new Map())
          .values(),
      );

      const promises = uniqueList.map(async (item) => {
        try {
          const result =
            await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(
              item,
            );

          const key = getInvestmentKey({
            provider: result.protocol.providerDetail.code,
            symbol: result.assets?.[0]?.token.info.symbol || '',
            vault: result.protocol.vault,
            networkId: result.network.networkId,
          });

          const fiatValue = new BigNumber(result.totalFiatValue || '0');

          // Remove from map if zero value
          if (fiatValue.lte(0)) {
            investmentMapRef.current.delete(key);
          } else {
            // Add requestParams to each asset
            const assetsWithParams = result.assets.map((asset) => ({
              ...asset,
              requestParams: {
                provider: result.protocol.providerDetail.code,
                symbol: result.assets?.[0]?.token.info.symbol || '',
                vault: result.protocol.vault,
                networkId: result.network.networkId,
              },
            }));

            const existing = investmentMapRef.current.get(key);
            if (existing) {
              // Merge assets if the same key already exists
              existing.assets = [...existing.assets, ...assetsWithParams];
              const existingTotal = new BigNumber(
                existing.totalFiatValue || '0',
              );
              const newTotal = new BigNumber(result.totalFiatValue || '0');
              existing.totalFiatValue = existingTotal.plus(newTotal).toFixed();
            } else {
              // First time seeing this key, add it
              investmentMapRef.current.set(key, {
                ...result,
                assets: assetsWithParams,
              });
            }
          }

          // Update state with sorted investments
          const sorted = Array.from(investmentMapRef.current.values()).sort(
            (a, b) => {
              const valueA = new BigNumber(a.totalFiatValue || '0');
              const valueB = new BigNumber(b.totalFiatValue || '0');
              return valueB.comparedTo(valueA);
            },
          );
          setInvestments(sorted);

          // Recalculate total fiat value from all investments
          const total = Array.from(investmentMapRef.current.values()).reduce(
            (sum, inv) => sum.plus(new BigNumber(inv.totalFiatValue || '0')),
            new BigNumber(0),
          );
          setEarnTotalFiatValue(total);

          return result;
        } catch (error) {
          return null;
        }
      });

      await Promise.allSettled(promises);
      setIsLoading(false);
    },
    [
      account,
      indexedAccount,
      allNetworkId,
      getInvestmentKey,
      prevAccountRef,
      investmentMapRef,
    ],
  );

  usePromiseResult(
    fetchAndUpdateInvestments,
    [account, allNetworkId, indexedAccount, fetchAndUpdateInvestments],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
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

  const aggregatedInvestments = useMemo(() => {
    const protocolMap = new Map<string, IEarnPortfolioInvestment>();

    investments.forEach((investment) => {
      // Group by protocol name only
      const protocolKey = investment.protocol.providerDetail.code;

      const existing = protocolMap.get(protocolKey);
      if (existing) {
        existing.assets = [...existing.assets, ...investment.assets];
        const existingTotal = new BigNumber(existing.totalFiatValue || '0');
        const newTotal = new BigNumber(investment.totalFiatValue || '0');
        existing.totalFiatValue = existingTotal.plus(newTotal).toFixed();
      } else {
        protocolMap.set(protocolKey, { ...investment });
      }
    });

    // Sort by total fiat value descending
    return Array.from(protocolMap.values()).sort((a, b) => {
      const valueA = new BigNumber(a.totalFiatValue || '0');
      const valueB = new BigNumber(b.totalFiatValue || '0');
      return valueB.comparedTo(valueA);
    });
  }, [investments]);

  return {
    investments: aggregatedInvestments,
    earnings24h,
    earnTotalFiatValue,
    isLoading,
    refresh,
  };
};
