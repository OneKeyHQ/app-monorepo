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
  IPerpAssetMetaAssetType,
  IPerpsAssetMetaMap,
} from '@onekeyhq/shared/types/hyperliquid/types';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

export type IPerpFundingHistoryRange = '24h' | '7d' | '30d';

export type IPerpResolvedMarketDetail = {
  assetMetaKey: string;
  assetId: string;
  assetType?: IPerpAssetMetaAssetType;
  localizedMessage?: string;
  detail?: IMarketTokenDetail;
};

function addPerpAssetMetaLookupCandidate(
  candidateSet: Set<string>,
  value?: string,
) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return;
  }

  candidateSet.add(trimmedValue);
}

function buildPerpAssetMetaLookupKeys({
  coin,
  displayName,
}: {
  coin?: string;
  displayName?: string;
}) {
  const candidateSet = new Set<string>();

  [displayName, coin].forEach((value) => {
    addPerpAssetMetaLookupCandidate(candidateSet, value);
  });

  return [...candidateSet];
}

function resolvePerpAssetMeta({
  assetMetaMap,
  lookupKeys,
}: {
  assetMetaMap?: IPerpsAssetMetaMap;
  lookupKeys: string[];
}) {
  if (!assetMetaMap || !lookupKeys.length) {
    return undefined;
  }

  for (const lookupKey of lookupKeys) {
    if (Object.prototype.hasOwnProperty.call(assetMetaMap, lookupKey)) {
      const meta = assetMetaMap[lookupKey];
      return meta?.assetId ? { key: lookupKey, meta } : undefined;
    }
  }

  const assetMetaEntries = Object.entries(assetMetaMap);
  for (const lookupKey of lookupKeys) {
    const normalizedLookupKey = lookupKey.toLowerCase();
    const matchedEntry = assetMetaEntries.find(
      ([assetKey]) => assetKey.toLowerCase() === normalizedLookupKey,
    );
    if (matchedEntry?.[1]?.assetId) {
      const [key, meta] = matchedEntry;
      return { key, meta };
    }
  }

  return undefined;
}

async function resolvePerpMarketDetail({
  coin,
  displayName,
}: {
  coin?: string;
  displayName?: string;
}): Promise<IPerpResolvedMarketDetail | undefined> {
  const lookupKeys = buildPerpAssetMetaLookupKeys({ coin, displayName });

  if (!lookupKeys.length) {
    return undefined;
  }

  const assetMetaMap =
    await backgroundApiProxy.serviceHyperliquid.getPerpsAssetMetaMap();
  const resolvedAssetMeta = resolvePerpAssetMeta({
    assetMetaMap,
    lookupKeys,
  });

  if (!resolvedAssetMeta) {
    return undefined;
  }

  const localizedMessage =
    resolvedAssetMeta.meta.localizedMessage || resolvedAssetMeta.meta.message;
  // Legacy cached configs only have assetId, so only explicit non-CoinGecko skips fetching.
  const shouldFetchMarketDetail =
    resolvedAssetMeta.meta.assetType !== 'non_coingecko';
  let detail: IMarketTokenDetail | undefined;

  if (shouldFetchMarketDetail) {
    try {
      detail = await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
        resolvedAssetMeta.meta.assetId,
      );
    } catch (error) {
      if (!localizedMessage) {
        throw error;
      }
    }
  }

  return {
    assetMetaKey: resolvedAssetMeta.key,
    assetId: resolvedAssetMeta.meta.assetId,
    assetType: resolvedAssetMeta.meta.assetType,
    localizedMessage,
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
      pollingInterval: coin ? 60 * 1000 : undefined,
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
      pollingInterval: coin ? 3 * 1000 : undefined,
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
      pollingInterval: coin ? 60 * 1000 : undefined,
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
