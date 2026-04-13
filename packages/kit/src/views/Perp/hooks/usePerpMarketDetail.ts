/* cspell:ignore Fundings */

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IFundingHistoryRecord,
  IPerpAnnotation,
  IPerpContractInfo,
  IPerpMarketOverview,
  IPerpPredictedFundingVenue,
  IRecentTrade,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPerpFundingHistoryRange = '24h' | '7d' | '30d';

function getFundingRangeStart(range: IPerpFundingHistoryRange) {
  const now = Date.now();
  if (range === '7d') {
    return now - 7 * 24 * 60 * 60 * 1000;
  }
  if (range === '30d') {
    return now - 30 * 24 * 60 * 60 * 1000;
  }
  return now - 24 * 60 * 60 * 1000;
}

export function usePerpMarketOverview(coin?: string) {
  const query = usePromiseResult<IPerpMarketOverview | undefined>(
    async () => {
      if (!coin) {
        return undefined;
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpMarketOverview({
        coin,
      });
    },
    [coin],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );

  return {
    result: query.result,
    isLoading: query.isLoading,
    run: query.run,
  };
}

export function usePerpContractInfo(coin?: string) {
  return usePromiseResult<IPerpContractInfo | undefined>(
    async () => {
      if (!coin) {
        return undefined;
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpContractInfo({
        coin,
      });
    },
    [coin],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );
}

export function usePerpFundingHistory(
  coin: string | undefined,
  range: IPerpFundingHistoryRange,
) {
  return usePromiseResult<IFundingHistoryRecord[]>(
    async () => {
      if (!coin) {
        return [];
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpFundingHistory({
        coin,
        startTime: getFundingRangeStart(range),
        endTime: Date.now(),
      });
    },
    [coin, range],
    {
      watchLoading: true,
      pollingInterval: 60 * 1000,
      initResult: [],
      undefinedResultIfError: true,
    },
  );
}

export function usePerpRecentTrades(coin?: string) {
  return usePromiseResult<IRecentTrade[]>(
    async () => {
      if (!coin) {
        return [];
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({
        coin,
      });
    },
    [coin],
    {
      watchLoading: true,
      pollingInterval: 3 * 1000,
      initResult: [],
      undefinedResultIfError: true,
    },
  );
}

export function usePerpPredictedFundings(coin?: string) {
  return usePromiseResult<IPerpPredictedFundingVenue[]>(
    async () => {
      if (!coin) {
        return [];
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpPredictedFundings({
        coin,
      });
    },
    [coin],
    {
      watchLoading: true,
      pollingInterval: 60 * 1000,
      initResult: [],
      undefinedResultIfError: true,
    },
  );
}

export function usePerpAnnotation(coin?: string) {
  return usePromiseResult<IPerpAnnotation | undefined>(
    async () => {
      if (!coin) {
        return undefined;
      }
      return backgroundApiProxy.serviceHyperliquid.getPerpAnnotation({
        coin,
      });
    },
    [coin],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );
}
