import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IUsePortfolioDataProps {
  tokenAddress: string;
  networkId: string;
  accountAddress?: string;
  xpubSegwit?: string;
}

export function usePortfolioData({
  tokenAddress,
  networkId,
  accountAddress,
  xpubSegwit,
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

      return backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
        tokenAddress,
        networkId,
        accountAddress,
        xpubSegwit,
      });
    },
    [tokenAddress, networkId, accountAddress, xpubSegwit],
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
