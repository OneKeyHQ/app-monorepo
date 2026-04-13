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
import type {
  IMarketToken,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

export type IPerpFundingHistoryRange = '24h' | '7d' | '30d';

export type IPerpResolvedMarketDetail = {
  matchedToken: IMarketToken;
  detail: IMarketTokenDetail;
};

function normalizeMarketMatchText(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildPerpMarketQueries({
  coin,
  displayName,
}: {
  coin?: string;
  displayName?: string;
}) {
  const querySet = new Set<string>();

  [displayName, coin].forEach((value) => {
    if (!value) {
      return;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    querySet.add(trimmedValue);

    const symbolCandidate = trimmedValue.split(/[-/:\s]/)[0];
    if (symbolCandidate) {
      querySet.add(symbolCandidate);
    }

    const withoutNumericPrefix = trimmedValue.replace(/^\d+/, '');
    if (withoutNumericPrefix) {
      querySet.add(withoutNumericPrefix);
    }
  });

  return [...querySet].filter(Boolean);
}

function getMarketCandidateScore(token: IMarketToken, query: string) {
  const normalizedQuery = normalizeMarketMatchText(query);
  if (!normalizedQuery) {
    return -1;
  }

  const normalizedSymbol = normalizeMarketMatchText(token.symbol);
  const normalizedName = normalizeMarketMatchText(token.name);

  if (normalizedSymbol === normalizedQuery) {
    return 400;
  }

  if (normalizedName === normalizedQuery) {
    return 320;
  }

  return -1;
}

async function resolvePerpMarketDetail({
  coin,
  displayName,
}: {
  coin?: string;
  displayName?: string;
}): Promise<IPerpResolvedMarketDetail | undefined> {
  const queries = buildPerpMarketQueries({ coin, displayName });

  if (!queries.length) {
    return undefined;
  }

  let matchedToken: IMarketToken | undefined;
  let matchedScore = -1;

  for (const query of queries) {
    const results = await backgroundApiProxy.serviceMarket.searchToken(query);

    for (const token of results) {
      const score = getMarketCandidateScore(token, query);
      if (score >= 0) {
        const hasHigherScore = score >= matchedScore;
        const hasHigherMarketCap =
          score > matchedScore ||
          (token.marketCap || 0) > (matchedToken?.marketCap || 0);

        if (hasHigherScore && hasHigherMarketCap) {
          matchedToken = token;
          matchedScore = score;
        }
      }
    }

    if (matchedScore >= 320) {
      break;
    }
  }

  if (!matchedToken || matchedScore < 320) {
    return undefined;
  }

  const detail = await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
    matchedToken.coingeckoId,
  );

  return {
    matchedToken,
    detail,
  };
}

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

export function usePerpResolvedMarketDetail(params: {
  coin?: string;
  displayName?: string;
}) {
  const { coin, displayName } = params;

  return usePromiseResult<IPerpResolvedMarketDetail | undefined>(
    async () => resolvePerpMarketDetail({ coin, displayName }),
    [coin, displayName],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );
}
