import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { useNetworkLoadingAnalytics } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/hooks/useNetworkLoadingAnalytics';
import {
  discardMarketHomeTokenListSeedForInit,
  getMarketHomeTokenListSeedForInit,
} from '@onekeyhq/kit/src/views/Market/utils/marketHomeTokenListSeed';
import { markMarketReactPerf } from '@onekeyhq/kit/src/views/Market/utils/marketReactPerf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { TIME_RANGE_TO_API_MAP } from '../../../types';
import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import { fetchMarketTokenListForPlatform } from './marketTokenListPlatformApi';

import type { IMarketTokenListResponseWithSource } from './marketTokenListPlatformApiTypes';
import type { IMarketTimeRangeValue } from '../../../types';
import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
  type?: string;
  category?: string;
  timeRange?: IMarketTimeRangeValue;
  pollingInterval?: number;
}

const MARKET_TOKEN_LIST_COLD_CACHE_FALLBACK_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ minute: 5 });

type IMarketTokenListCacheEntry = {
  data: IMarketTokenListResponseWithSource;
  updatedAt: number;
};

function isUsableMarketTokenListCacheData(
  data: IMarketTokenListResponseWithSource | undefined,
) {
  return Boolean(
    data &&
    Array.isArray(data.list) &&
    !data.__fromSeed &&
    !data.__fromColdCacheFallback,
  );
}

function isFreshMarketTokenListCacheEntry(
  entry: IMarketTokenListCacheEntry | undefined,
): entry is IMarketTokenListCacheEntry {
  return (
    entry !== undefined &&
    Date.now() - entry.updatedAt <=
      MARKET_TOKEN_LIST_COLD_CACHE_FALLBACK_MAX_AGE_MS
  );
}

function getTrustedMarketTokenListCacheEntry(swrKey: string | undefined) {
  if (!swrKey) {
    return undefined;
  }

  const entry =
    swrCacheUtils.getWithTimestamp<IMarketTokenListResponseWithSource>(swrKey);
  const shouldRemoveEntry =
    entry !== undefined &&
    (!isUsableMarketTokenListCacheData(entry.data) ||
      !isFreshMarketTokenListCacheEntry(entry));

  if (shouldRemoveEntry) {
    swrCacheUtils.remove(swrKey);
    return undefined;
  }

  return entry;
}

const MARKET_TOKEN_PRIMITIVE_REUSE_FIELDS = [
  'id',
  'name',
  'symbol',
  'address',
  'decimals',
  'price',
  'change24h',
  'marketCap',
  'liquidity',
  'transactions',
  'uniqueTraders',
  'holders',
  'turnover',
  'tokenImageUri',
  'networkLogoUri',
  'networkId',
  'firstTradeTime',
  'chainId',
  'sortIndex',
  'isNative',
  'communityRecognized',
  'perpsCoin',
  'maxLeverage',
  'perpsSubtitle',
] satisfies readonly (keyof Omit<
  IMarketToken,
  'tokenImageUris' | 'walletInfo' | 'stock'
>)[];

function isSameStringArray(a?: string[], b?: string[]) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function canReuseMarketToken(prev: IMarketToken, next: IMarketToken) {
  for (const field of MARKET_TOKEN_PRIMITIVE_REUSE_FIELDS) {
    if (prev[field] !== next[field]) {
      return false;
    }
  }

  if (!isSameStringArray(prev.tokenImageUris, next.tokenImageUris)) {
    return false;
  }

  if (
    prev.walletInfo?.buy !== next.walletInfo?.buy ||
    prev.walletInfo?.sell !== next.walletInfo?.sell
  ) {
    return false;
  }

  return prev.stock === next.stock;
}

function reuseStableMarketTokenRows({
  prev,
  next,
}: {
  prev: IMarketToken[];
  next: IMarketToken[];
}) {
  if (prev.length === 0 || next.length === 0) {
    return next;
  }

  const prevById = new Map(prev.map((item) => [item.id, item]));
  let changed = prev.length !== next.length;
  const reused = next.map((item, index) => {
    const prevItem = prevById.get(item.id);
    const nextItem =
      prevItem && canReuseMarketToken(prevItem, item) ? prevItem : item;
    if (prev[index] !== nextItem) {
      changed = true;
    }
    return nextItem;
  });

  return changed ? reused : prev;
}

export function useMarketTokenList({
  networkId,
  initialSortBy = 'v24hUSD',
  initialSortType = 'desc',
  pageSize = 20,
  type,
  category,
  timeRange,
  pollingInterval = timerUtils.getTimeDurationMs({ seconds: 60 }),
}: IUseMarketTokenListParams) {
  const timeFrame = timeRange ? TIME_RANGE_TO_API_MAP[timeRange] : undefined;
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;
  // Get minLiquidity from market config
  const { minLiquidity } = useMarketBasicConfig();
  const { trackNetworkLoading } = useNetworkLoadingAnalytics();
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType,
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const maxPages = 5;

  // Optimize network logo URI calculation
  const networkLogoUri = useMemo(
    () => getNetworkLogoUri(networkId),
    [networkId],
  );
  const hasNetworkId = Boolean(networkId);

  // Check if "All Networks" is selected
  const isAllNetworks = useMemo(
    () => networkUtils.isAllNetwork({ networkId }),
    [networkId],
  );

  // For API calls, use empty string when "All Networks" is selected
  const apiNetworkId = isAllNetworks ? '' : networkId;
  const currentQueryKey = useMemo(
    () =>
      JSON.stringify({
        apiNetworkId,
        sortBy,
        sortType,
        pageSize,
        minLiquidity,
        type,
        category,
        timeFrame,
        networkId,
      }),
    [
      apiNetworkId,
      sortBy,
      sortType,
      pageSize,
      minLiquidity,
      type,
      category,
      timeFrame,
      networkId,
    ],
  );
  const currentQueryKeyRef = useRef(currentQueryKey);
  currentQueryKeyRef.current = currentQueryKey;
  const bypassWebSeedOnceRef = useRef(false);
  const forcedRemoteProvisionalQueryKeysRef = useRef<Set<string>>(new Set());
  const marketTokenListSwrKey = useMemo(() => {
    if (!platformEnv.isWeb || !hasNetworkId) {
      return undefined;
    }
    return swrKeys.marketHomeTokenList({
      networkId: apiNetworkId,
      sortBy,
      sortType,
      pageSize,
      minLiquidity,
      type,
      category,
      timeFrame,
    });
  }, [
    apiNetworkId,
    hasNetworkId,
    minLiquidity,
    pageSize,
    sortBy,
    sortType,
    category,
    timeFrame,
    type,
  ]);
  const cachedMarketTokenListEntry = useMemo(() => {
    // `usePromiseResult` synchronously replays any value under swrKey during
    // render. Market owns the token-list freshness policy, so stale or
    // provisional entries must be removed before that hook sees the key.
    return getTrustedMarketTokenListCacheEntry(marketTokenListSwrKey);
  }, [marketTokenListSwrKey]);
  const shouldUseMarketHomeTokenListSeedForCurrentQuery =
    platformEnv.isWeb &&
    hasNetworkId &&
    apiNetworkId === '' &&
    sortBy === 'v24hUSD' &&
    sortType === 'desc' &&
    pageSize === 20 &&
    minLiquidity === 5000 &&
    type === 'trending' &&
    category === undefined &&
    timeFrame === '2';
  const marketTokenListSeedInitResult = useMemo(() => {
    // The HTML bootstrap seed is only a first-page fallback for a brand-new
    // web load. A valid local SWR cache is usually fresher, so seed is used
    // only when there is no trusted cache for the current default query.
    if (!shouldUseMarketHomeTokenListSeedForCurrentQuery) {
      return undefined;
    }
    if (cachedMarketTokenListEntry) {
      // If cache wins the first frame, drop the one-shot HTML seed so it
      // cannot be reused later after that cache ages out.
      discardMarketHomeTokenListSeedForInit();
      return undefined;
    }

    return getMarketHomeTokenListSeedForInit();
  }, [
    cachedMarketTokenListEntry,
    shouldUseMarketHomeTokenListSeedForCurrentQuery,
  ]);
  const trustedMarketTokenListFallbackRef = useRef(cachedMarketTokenListEntry);
  const trustedMarketTokenListSwrKeyRef = useRef(marketTokenListSwrKey);
  const hasTrustedMarketTokenListCacheRef = useRef(
    Boolean(cachedMarketTokenListEntry),
  );
  hasTrustedMarketTokenListCacheRef.current = Boolean(
    cachedMarketTokenListEntry,
  );
  if (trustedMarketTokenListSwrKeyRef.current !== marketTokenListSwrKey) {
    trustedMarketTokenListSwrKeyRef.current = marketTokenListSwrKey;
    trustedMarketTokenListFallbackRef.current = cachedMarketTokenListEntry;
  }
  const [remoteFirstPageLoadedQueryKey, setRemoteFirstPageLoadedQueryKey] =
    useState<string>();
  const remoteFirstPageLoadedQueryKeyRef = useRef(
    remoteFirstPageLoadedQueryKey,
  );
  remoteFirstPageLoadedQueryKeyRef.current = remoteFirstPageLoadedQueryKey;
  const pendingRemoteFirstPageLoadedQueryKeyRef = useRef<string | undefined>(
    undefined,
  );
  const latestAuthoritativeFirstPageResultRef = useRef<
    | {
        queryKey: string;
        result: IMarketTokenListResponseWithSource;
      }
    | undefined
  >(undefined);

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult<IMarketTokenListResponseWithSource | undefined>(
    async () => {
      if (!hasNetworkId) {
        return undefined;
      }
      const requestQueryKey = currentQueryKeyRef.current;
      const shouldAllowColdCacheFallback =
        remoteFirstPageLoadedQueryKeyRef.current !== requestQueryKey;
      pendingRemoteFirstPageLoadedQueryKeyRef.current = undefined;
      const shouldBypassWebSeed =
        platformEnv.isWeb &&
        (bypassWebSeedOnceRef.current ||
          hasTrustedMarketTokenListCacheRef.current);
      bypassWebSeedOnceRef.current = false;
      let response: IMarketTokenListResponseWithSource;
      try {
        response = await fetchMarketTokenListForPlatform(
          {
            networkId: apiNetworkId,
            sortBy,
            sortType,
            page: 1,
            limit: pageSize,
            minLiquidity,
            type,
            category,
            timeFrame,
          },
          shouldBypassWebSeed ? { forceRemote: true } : undefined,
        );
      } catch (error) {
        const latestAuthoritativeResult =
          latestAuthoritativeFirstPageResultRef.current;
        if (
          latestAuthoritativeResult?.queryKey === requestQueryKey &&
          remoteFirstPageLoadedQueryKeyRef.current === requestQueryKey &&
          currentQueryKeyRef.current === requestQueryKey
        ) {
          return latestAuthoritativeResult.result;
        }

        const cachedEntry = trustedMarketTokenListFallbackRef.current;
        if (
          shouldAllowColdCacheFallback &&
          isFreshMarketTokenListCacheEntry(cachedEntry) &&
          currentQueryKeyRef.current === requestQueryKey
        ) {
          return {
            ...cachedEntry.data,
            __fromColdCacheFallback: true,
          };
        }
        throw error;
      }
      const responseWithSource = response;
      if (currentQueryKeyRef.current !== requestQueryKey) {
        return undefined;
      }
      const nextResult = {
        list: response.list,
        total: response.total,
        __fromSeed: responseWithSource.__fromSeed,
        __fromColdCacheFallback: responseWithSource.__fromColdCacheFallback,
      };
      if (
        !responseWithSource.__fromSeed &&
        !responseWithSource.__fromColdCacheFallback &&
        Array.isArray(responseWithSource.list)
      ) {
        pendingRemoteFirstPageLoadedQueryKeyRef.current = requestQueryKey;
        trustedMarketTokenListFallbackRef.current = {
          data: nextResult,
          updatedAt: Date.now(),
        };
        latestAuthoritativeFirstPageResultRef.current = {
          queryKey: requestQueryKey,
          result: nextResult,
        };
      }
      return nextResult;
    },
    [
      hasNetworkId,
      apiNetworkId,
      sortBy,
      sortType,
      pageSize,
      minLiquidity,
      type,
      category,
      timeFrame,
    ],
    {
      checkIsFocused: !platformEnv.isWeb,
      watchLoading: hasNetworkId,
      pollingInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      initResult: marketTokenListSeedInitResult,
      swrKey: marketTokenListSwrKey,
      swrShouldPersist: (result) =>
        Boolean(
          result &&
          Array.isArray(result.list) &&
          !result.__fromSeed &&
          !result.__fromColdCacheFallback,
        ),
    },
  );

  const effectiveIsLoading = hasNetworkId ? isLoading : false;
  const isSeedResult = Boolean(apiResult?.__fromSeed);
  const isColdCacheFallbackResult = Boolean(apiResult?.__fromColdCacheFallback);
  const isAwaitingRemoteFirstPageResult =
    hasNetworkId && remoteFirstPageLoadedQueryKey !== currentQueryKey;
  // A normal SWR hit is still a cached page 1. Keep pagination locked until a
  // remote page 1 lands, otherwise page 2 can be appended before page 1 gets
  // revalidated and then replaced.
  const isProvisionalFirstPageResult =
    isSeedResult ||
    isColdCacheFallbackResult ||
    isAwaitingRemoteFirstPageResult;
  const isProvisionalFirstPageResultRef = useRef(isProvisionalFirstPageResult);
  isProvisionalFirstPageResultRef.current = isProvisionalFirstPageResult;
  const shouldForceRemoteForProvisionalFirstPageResult =
    isSeedResult || isColdCacheFallbackResult;
  let provisionalFirstPageSource: 'seed' | 'cold-cache' | undefined;
  if (isSeedResult) {
    provisionalFirstPageSource = 'seed';
  } else if (isColdCacheFallbackResult) {
    provisionalFirstPageSource = 'cold-cache';
  }

  useEffect(() => {
    if (
      !platformEnv.isWeb ||
      !shouldForceRemoteForProvisionalFirstPageResult ||
      !hasNetworkId ||
      !provisionalFirstPageSource
    ) {
      return undefined;
    }

    const requestQueryKey = currentQueryKeyRef.current;
    const forcedRemoteKey = `${provisionalFirstPageSource}:${requestQueryKey}`;
    if (forcedRemoteProvisionalQueryKeysRef.current.has(forcedRemoteKey)) {
      return undefined;
    }
    forcedRemoteProvisionalQueryKeysRef.current.add(forcedRemoteKey);

    const timer = setTimeout(() => {
      if (currentQueryKeyRef.current !== requestQueryKey) {
        return;
      }
      bypassWebSeedOnceRef.current = true;
      void fetchMarketTokenList().catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [
    fetchMarketTokenList,
    hasNetworkId,
    provisionalFirstPageSource,
    shouldForceRemoteForProvisionalFirstPageResult,
  ]);

  useEffect(() => {
    if (
      !apiResult ||
      apiResult.__fromSeed ||
      apiResult.__fromColdCacheFallback
    ) {
      return;
    }

    const pendingQueryKey = pendingRemoteFirstPageLoadedQueryKeyRef.current;
    if (!pendingQueryKey) {
      return;
    }
    if (pendingQueryKey !== currentQueryKey) {
      pendingRemoteFirstPageLoadedQueryKeyRef.current = undefined;
      return;
    }

    // Unlock pagination only after the remote page 1 result is the rendered
    // apiResult, not merely after the request promise resolves.
    pendingRemoteFirstPageLoadedQueryKeyRef.current = undefined;
    remoteFirstPageLoadedQueryKeyRef.current = pendingQueryKey;
    setRemoteFirstPageLoadedQueryKey(pendingQueryKey);
  }, [apiResult, currentQueryKey]);

  useEffect(() => {
    if (!hasNetworkId || !apiResult || !apiResult.list) {
      return;
    }

    const transformStart =
      platformEnv.isWeb && typeof performance !== 'undefined'
        ? performance.now()
        : 0;
    const transformed = apiResult.list.map((item) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
        timeRange: timeRangeRef.current,
      }),
    );
    const transformDuration =
      transformStart > 0 ? performance.now() - transformStart : undefined;
    markMarketReactPerf({
      name: 'useMarketTokenList.transform',
      phase: 'measure',
      duration: transformDuration,
      detail: {
        count: apiResult.list.length,
        source: apiResult.__fromSeed ? 'seed' : 'remote',
        networkId,
        type,
        category,
        timeFrame,
      },
    });

    // Update only rows whose visible fields changed so Table row memoization can
    // survive seed -> remote refresh and polling updates.
    setTransformedData((prev) =>
      reuseStableMarketTokenRows({ prev, next: transformed }),
    );
    setCurrentPage(1);
    setHasReachedEnd(false);

    // Track network loading analytics
    trackNetworkLoading(networkId, apiResult.list.length);

    // Reset network switching state when new data arrives
    setIsNetworkSwitching(false);
  }, [
    apiResult,
    hasNetworkId,
    networkId,
    networkLogoUri,
    timeFrame,
    trackNetworkLoading,
    type,
    category,
  ]);

  // Reset pagination when networkId, sortBy, or sortType changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingMore(false);
    setHasReachedEnd(false);
    // Don't clear data immediately to avoid UI flicker
    // The data will be replaced when new API result arrives
  }, [networkId, sortBy, sortType, type, category, timeFrame]);

  // Handle network switching - separate effect to track networkId changes specifically
  useEffect(() => {
    if (!hasNetworkId) {
      setIsNetworkSwitching(false);
      return;
    }
    setIsNetworkSwitching(true);
  }, [hasNetworkId, networkId]);

  const totalCount = apiResult?.total || 0;

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);
  const loadedPageCount = useMemo(
    () =>
      Math.max(currentPage, Math.ceil(transformedData.length / pageSize) || 1),
    [currentPage, pageSize, transformedData.length],
  );

  const refresh = useCallback(() => {
    // Don't clear data immediately - let new data load first
    if (platformEnv.isWeb && isProvisionalFirstPageResult) {
      bypassWebSeedOnceRef.current = true;
    }
    void fetchMarketTokenList().catch(() => undefined);
  }, [fetchMarketTokenList, isProvisionalFirstPageResult]);

  const loadMore = useCallback(async () => {
    // Check if we can load more pages
    if (
      isProvisionalFirstPageResult ||
      isLoadingMore ||
      loadedPageCount >= maxPages ||
      loadedPageCount >= totalPages ||
      (totalCount > 0 && transformedData.length >= totalCount) ||
      !hasNetworkId ||
      effectiveIsLoading ||
      hasReachedEnd
    ) {
      return;
    }

    const nextPage = loadedPageCount + 1;
    const requestQueryKey = currentQueryKeyRef.current;

    setIsLoadingMore(true);

    try {
      // Load the next page
      const response = await fetchMarketTokenListForPlatform({
        networkId: apiNetworkId,
        sortBy,
        sortType,
        page: nextPage,
        limit: pageSize,
        minLiquidity,
        type,
        category,
        timeFrame,
      });

      if (
        currentQueryKeyRef.current !== requestQueryKey ||
        isProvisionalFirstPageResultRef.current
      ) {
        return;
      }

      if (response?.list?.length > 0) {
        // Transform new data
        const newTransformed = response.list.map((item) =>
          transformApiItemToToken(item, {
            chainId: networkId,
            networkLogoUri,
            timeRange: timeRangeRef.current,
          }),
        );

        if (currentQueryKeyRef.current !== requestQueryKey) {
          return;
        }

        // Track network loading analytics for load more
        trackNetworkLoading(networkId, response.list.length);

        // Append new data to existing data
        setTransformedData((prev) => [...prev, ...newTransformed]);
        setCurrentPage(nextPage);
      } else {
        // Empty response - stop loading immediately
        setHasReachedEnd(true);
      }
    } catch (error) {
      console.error('Failed to load more market tokens:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isProvisionalFirstPageResult,
    isLoadingMore,
    loadedPageCount,
    totalCount,
    totalPages,
    transformedData.length,
    effectiveIsLoading,
    hasReachedEnd,
    hasNetworkId,
    apiNetworkId,
    networkId,
    sortBy,
    sortType,
    pageSize,
    minLiquidity,
    type,
    category,
    timeFrame,
    trackNetworkLoading,
    networkLogoUri,
  ]);

  const canLoadMore =
    hasNetworkId &&
    loadedPageCount < maxPages &&
    loadedPageCount < totalPages &&
    (totalCount === 0 || transformedData.length < totalCount) &&
    !effectiveIsLoading &&
    !isLoadingMore &&
    !hasReachedEnd;

  return {
    data: transformedData,
    isLoading: effectiveIsLoading,
    isLoadingMore,
    isNetworkSwitching,
    isProvisionalFirstPageResult,
    initialSortBy,
    initialSortType,
    totalPages,
    totalCount,
    currentPage,
    maxPages,
    canLoadMore,
    loadMore,
    refresh,
    refetch: fetchMarketTokenList,
    sortBy,
    sortType,
    setSortBy,
    setSortType,
  } as const;
}
