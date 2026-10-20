import { useCallback, useState } from 'react';

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
  accountAddress?: string;
};

function getPortfolioScopeKey({
  networkId,
  tokenAddress,
  accountAddress,
}: {
  networkId: string;
  tokenAddress: string;
  accountAddress?: string;
}) {
  return `${networkId}:${tokenAddress}:${accountAddress ?? ''}`;
}

export function usePortfolioData({
  tokenAddress,
  networkId,
  accountAddress,
  xpub,
}: IUsePortfolioDataProps) {
  // The scope whose last request failed, so its first load stops showing a
  // skeleton. Cleared by the next successful request.
  const [failedScopeKey, setFailedScopeKey] = useState<string | undefined>();
  const {
    result: portfolioResult,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult<IScopedPortfolioData>(
    async () => {
      if (!accountAddress) {
        return { list: [], networkId, tokenAddress, accountAddress };
      }

      try {
        const result =
          await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
            tokenAddress,
            networkId,
            accountAddress,
            xpub,
            // Without it a failed request comes back as an empty list, which
            // reads as "no position" and wipes rows already on screen.
            throwOnError: true,
          });
        setFailedScopeKey(undefined);
        return { ...result, networkId, tokenAddress, accountAddress };
      } catch (error) {
        setFailedScopeKey(
          getPortfolioScopeKey({ networkId, tokenAddress, accountAddress }),
        );
        throw error;
      }
    },
    [tokenAddress, networkId, accountAddress, xpub],
    {
      watchLoading: true,
      // A failed poll keeps the last good rows and is not rethrown, since the
      // polling and revalidation runs have no one to catch it.
      keepResultIfError: true,
      pollingInterval: accountAddress
        ? timerUtils.getTimeDurationMs({ seconds: 5 })
        : undefined,
    },
  );

  // A result left from another token or another account is not this one's:
  // its rows are never shown here.
  const isCurrentPortfolioScope =
    equalTokenNoCaseSensitive({
      token1: portfolioResult
        ? {
            networkId: portfolioResult.networkId,
            contractAddress: portfolioResult.tokenAddress,
          }
        : undefined,
      token2: { networkId, contractAddress: tokenAddress },
    }) && portfolioResult?.accountAddress === accountAddress;

  const onRefresh = useCallback(async () => {
    await fetchPortfolio();
  }, [fetchPortfolio]);

  // The first result for this token and account is not back yet. The
  // position list shows a skeleton then instead of a brief "No data".
  const isPortfolioPending =
    !isCurrentPortfolioScope &&
    failedScopeKey !==
      getPortfolioScopeKey({ networkId, tokenAddress, accountAddress });

  return {
    portfolioData: isCurrentPortfolioScope ? portfolioResult?.list || [] : [],
    isPortfolioPending,
    fetchPortfolio,
    isRefreshing,
    onRefresh,
  };
}
