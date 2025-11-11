import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

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
        return { list: [] };
      }

      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
          tokenAddress,
          networkId,
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
