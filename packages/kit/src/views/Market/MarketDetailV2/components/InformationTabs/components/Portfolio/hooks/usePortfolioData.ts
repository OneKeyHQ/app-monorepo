import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IUsePortfolioDataProps {
  tokenAddress: string;
  networkId: string;
  accountAddress?: string;
}

export function usePortfolioData({
  tokenAddress,
  networkId,
  accountAddress,
}: IUsePortfolioDataProps) {
  const {
    result: portfolioData,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult(
    async () => {
      if (!accountAddress) {
        console.log('[MarketDeriveType] usePortfolioData: no accountAddress');
        return { list: [] };
      }

      console.log('[MarketDeriveType] usePortfolioData fetching:', {
        tokenAddress,
        networkId,
        accountAddress,
      });

      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
          tokenAddress,
          networkId,
          accountAddress,
        });

      console.log('[MarketDeriveType] usePortfolioData result:', {
        portfolioCount: response.list?.length || 0,
        accountAddress,
      });

      return response;
    },
    [tokenAddress, networkId, accountAddress],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchPortfolio();
  }, [fetchPortfolio]);

  return {
    portfolioData: portfolioData?.list || [],
    fetchPortfolio,
    isRefreshing,
    onRefresh,
  };
}
