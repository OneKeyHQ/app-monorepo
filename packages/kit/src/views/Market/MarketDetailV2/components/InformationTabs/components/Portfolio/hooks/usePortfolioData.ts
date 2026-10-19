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
  // Whether accountAddress is final for this network; see useNetworkAccount.
  isAccountResolved?: boolean;
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
  isAccountResolved = false,
}: IUsePortfolioDataProps) {
  const scopeKey = getPortfolioScopeKey({
    networkId,
    tokenAddress,
    accountAddress,
  });
  // The scope whose latest request failed. A failure keeps the previous result
  // on screen, so it is tracked apart from the result to still settle.
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
          });
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
      pollingInterval: accountAddress
        ? timerUtils.getTimeDurationMs({ seconds: 5 })
        : undefined,
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

  // True once the page knows whether this token has a position for the
  // current account, so a result left from another token or account is not
  // read as this one's answer.
  const isPortfolioSettled =
    isAccountResolved &&
    ((isCurrentPortfolioScope &&
      portfolioResult?.accountAddress === accountAddress) ||
      failedScopeKey === scopeKey);

  return {
    portfolioData: isCurrentPortfolioScope ? portfolioResult?.list || [] : [],
    isPortfolioSettled,
    fetchPortfolio,
    isRefreshing,
    onRefresh,
  };
}
