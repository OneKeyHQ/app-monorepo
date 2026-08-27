import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAccountPortfolioResponse } from '@onekeyhq/shared/types/marketV2';

interface IUsePortfolioDataProps {
  tokenAddress: string;
  networkId: string;
  accountAddress?: string;
  xpub?: string;
}

type IScopedPortfolioData = IMarketAccountPortfolioResponse & {
  networkId: string;
  tokenAddress: string;
};

export function usePortfolioData({
  tokenAddress,
  networkId,
  accountAddress,
  xpub,
}: IUsePortfolioDataProps) {
  const {
    result: portfolioResult,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult<IScopedPortfolioData>(
    async () => {
      if (!accountAddress) {
        return { list: [], networkId, tokenAddress };
      }

      const result =
        await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
          tokenAddress,
          networkId,
          accountAddress,
          xpub,
        });
      return { ...result, networkId, tokenAddress };
    },
    [tokenAddress, networkId, accountAddress, xpub],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
      undefinedResultIfReRun: true,
    },
  );

  const isCurrentPortfolioScope = equalTokenNoCaseSensitive({
    token1: portfolioResult
      ? {
          networkId: portfolioResult.networkId,
          contractAddress: portfolioResult.tokenAddress,
        }
      : undefined,
    token2: { networkId, contractAddress: tokenAddress },
  });

  const onRefresh = useCallback(async () => {
    await fetchPortfolio();
  }, [fetchPortfolio]);

  return {
    portfolioData: isCurrentPortfolioScope ? portfolioResult?.list || [] : [],
    fetchPortfolio,
    isRefreshing,
    onRefresh,
  };
}
