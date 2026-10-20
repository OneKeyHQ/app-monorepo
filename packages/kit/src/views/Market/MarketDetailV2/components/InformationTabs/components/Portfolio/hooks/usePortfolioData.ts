import { useCallback, useRef, useState } from 'react';

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
  // Each change of scope starts a new visit, so a failure recorded on an
  // earlier visit to the same token never settles a fresh request.
  const visitRef = useRef({ scopeKey, id: 0 });
  if (visitRef.current.scopeKey !== scopeKey) {
    visitRef.current = { scopeKey, id: visitRef.current.id + 1 };
  }
  const visitId = visitRef.current.id;
  // The visit whose request failed. A failure keeps the previous result on
  // screen, so it is tracked apart from the result to still settle.
  const [failedVisitId, setFailedVisitId] = useState<number | undefined>();
  const {
    result: portfolioResult,
    isLoading: isRefreshing,
    run: fetchPortfolio,
  } = usePromiseResult<IScopedPortfolioData>(
    async () => {
      if (!accountAddress) {
        return { list: [], networkId, tokenAddress, accountAddress };
      }

      const requestVisitId = visitRef.current.id;
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
        return { ...result, networkId, tokenAddress, accountAddress };
      } catch (error) {
        setFailedVisitId(requestVisitId);
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

  // A result left from another token or another account is not this one's
  // answer: neither its rows nor its settlement carry over.
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

  // True once the page knows whether this token has a position for the
  // current account.
  const isPortfolioSettled =
    isAccountResolved && (isCurrentPortfolioScope || failedVisitId === visitId);

  return {
    portfolioData: isCurrentPortfolioScope ? portfolioResult?.list || [] : [],
    isPortfolioSettled,
    fetchPortfolio,
    isRefreshing,
    onRefresh,
  };
}
