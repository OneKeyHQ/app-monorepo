import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { useNetworkLoadingAnalytics } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/hooks/useNetworkLoadingAnalytics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IMarketTokenListItem,
  IMarketTokenListResponse,
} from '@onekeyhq/shared/types/marketV2';

import { TIME_RANGE_TO_API_MAP } from '../../../types';
import {
  getNativeTokenInfo,
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
  timeRange?: IMarketTimeRangeValue;
  pollingInterval?: number;
}

const MARKET_HOME_STABLE_REMOTE_MERGE_ROW_COUNT = 12;

const MARKET_HOME_STABLE_REMOTE_PATCH_FIELDS: readonly (keyof IMarketTokenListItem)[] =
  [
    'price',
    'marketCap',
    'fdv',
    'tvl',
    'holders',
    'priceChange1mPercent',
    'priceChange5mPercent',
    'priceChange30mPercent',
    'priceChange1hPercent',
    'priceChange2hPercent',
    'priceChange4hPercent',
    'priceChange8hPercent',
    'priceChange24hPercent',
    'trade1mCount',
    'trade5mCount',
    'trade30mCount',
    'trade1hCount',
    'trade2hCount',
    'trade4hCount',
    'trade8hCount',
    'trade24hCount',
    'buy1mCount',
    'buy5mCount',
    'buy30mCount',
    'buy1hCount',
    'buy2hCount',
    'buy4hCount',
    'buy8hCount',
    'buy24hCount',
    'sell1mCount',
    'sell5mCount',
    'sell30mCount',
    'sell1hCount',
    'sell2hCount',
    'sell4hCount',
    'sell8hCount',
    'sell24hCount',
    'uniqueWallet1m',
    'uniqueWallet5m',
    'uniqueWallet30m',
    'uniqueWallet1h',
    'uniqueWallet2h',
    'uniqueWallet4h',
    'uniqueWallet8h',
    'uniqueWallet24h',
    'volume1m',
    'volume5m',
    'volume30m',
    'volume1h',
    'volume2h',
    'volume4h',
    'volume8h',
    'volume24h',
    'volume1hChangePercent',
    'volume2hChangePercent',
    'volume4hChangePercent',
    'volume8hChangePercent',
    'volume24hChangePercent',
    'liquidity',
    'communityRecognized',
  ];

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

function getMarketTokenListItemStableKey(item: IMarketTokenListItem) {
  const { isNative, normalizedAddress } = getNativeTokenInfo(
    item.isNative,
    item.address,
  );
  const tokenNetworkId = item.networkId || item.chainId || '';
  return `${tokenNetworkId}:${isNative ? 'native' : normalizedAddress}`;
}

function patchMarketTokenListItemVolatileFields(
  seedItem: IMarketTokenListItem,
  remoteItem: IMarketTokenListItem,
): IMarketTokenListItem {
  const volatilePatch = Object.fromEntries(
    MARKET_HOME_STABLE_REMOTE_PATCH_FIELDS.map((field) => [
      field,
      remoteItem[field],
    ]),
  ) as Partial<IMarketTokenListItem>;
  return {
    ...seedItem,
    ...volatilePatch,
  };
}

function mergeSeedFirstRowsWithRemote({
  seedResponse,
  remoteResponse,
}: {
  seedResponse: IMarketTokenListResponse;
  remoteResponse: IMarketTokenListResponse;
}): IMarketTokenListResponse {
  const remoteByKey = new Map(
    remoteResponse.list.map((item) => [
      getMarketTokenListItemStableKey(item),
      item,
    ]),
  );
  const stableKeys = new Set<string>();
  const stableSeedRows = seedResponse.list
    .slice(0, MARKET_HOME_STABLE_REMOTE_MERGE_ROW_COUNT)
    .map((seedItem) => {
      const key = getMarketTokenListItemStableKey(seedItem);
      stableKeys.add(key);
      const remoteItem = remoteByKey.get(key);
      return remoteItem
        ? patchMarketTokenListItemVolatileFields(seedItem, remoteItem)
        : seedItem;
    });
  const remoteRows = remoteResponse.list.filter(
    (item) => !stableKeys.has(getMarketTokenListItemStableKey(item)),
  );
  return {
    list: [...stableSeedRows, ...remoteRows],
    total: remoteResponse.total,
  };
}

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
      timeFrame,
      networkId,
    ],
  );
  const currentQueryKeyRef = useRef(currentQueryKey);
  currentQueryKeyRef.current = currentQueryKey;
  const forceRemoteOnceRef = useRef(false);
  const seedApiResultRef = useRef<
    | {
        queryKey: string;
        response: IMarketTokenListResponse;
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
      const forceRemote = forceRemoteOnceRef.current;
      forceRemoteOnceRef.current = false;
      const response = await fetchMarketTokenListForPlatform(
        {
          networkId: apiNetworkId,
          sortBy,
          sortType,
          page: 1,
          limit: pageSize,
          minLiquidity,
          type,
          timeFrame,
        },
        { forceRemote },
      );
      const responseWithSource = response as IMarketTokenListResponseWithSource;
      const seedApiResult = seedApiResultRef.current;
      const shouldStableMergeRemote =
        platformEnv.isWeb &&
        forceRemote &&
        !responseWithSource.__fromSeed &&
        seedApiResult?.queryKey === currentQueryKeyRef.current;
      const displayResponse = shouldStableMergeRemote
        ? mergeSeedFirstRowsWithRemote({
            seedResponse: seedApiResult.response,
            remoteResponse: response,
          })
        : response;
      if (responseWithSource.__fromSeed) {
        seedApiResultRef.current = {
          queryKey: currentQueryKeyRef.current,
          response,
        };
      } else if (shouldStableMergeRemote) {
        seedApiResultRef.current = undefined;
      }
      return {
        list: displayResponse.list,
        total: displayResponse.total,
        __fromSeed: responseWithSource.__fromSeed,
      };
    },
    [
      hasNetworkId,
      apiNetworkId,
      sortBy,
      sortType,
      pageSize,
      minLiquidity,
      type,
      timeFrame,
    ],
    {
      checkIsFocused: !platformEnv.isWeb,
      watchLoading: hasNetworkId,
      pollingInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const effectiveIsLoading = hasNetworkId ? isLoading : false;
  const isSeedResult = Boolean(apiResult?.__fromSeed);

  useEffect(() => {
    if (!platformEnv.isWeb || !isSeedResult || !hasNetworkId) {
      return undefined;
    }

    const requestQueryKey = currentQueryKeyRef.current;
    const timer = setTimeout(() => {
      if (currentQueryKeyRef.current !== requestQueryKey) {
        return;
      }
      forceRemoteOnceRef.current = true;
      void fetchMarketTokenList();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchMarketTokenList, hasNetworkId, isSeedResult]);

  useEffect(() => {
    if (!hasNetworkId || !apiResult || !apiResult.list) {
      return;
    }

    const transformed = apiResult.list.map((item) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
        timeRange: timeRangeRef.current,
      }),
    );

    // Update only rows whose visible fields changed so Table row memoization can
    // survive seed -> remote refresh and polling updates.
    setTransformedData((prev) =>
      reuseStableMarketTokenRows({ prev, next: transformed }),
    );

    // Track network loading analytics
    trackNetworkLoading(networkId, apiResult.list.length);

    // Reset network switching state when new data arrives
    setIsNetworkSwitching(false);
  }, [apiResult, hasNetworkId, networkId, networkLogoUri, trackNetworkLoading]);

  // Reset pagination when networkId, sortBy, or sortType changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingMore(false);
    setHasReachedEnd(false);
    // Don't clear data immediately to avoid UI flicker
    // The data will be replaced when new API result arrives
  }, [networkId, sortBy, sortType, type, timeFrame]);

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
    if (platformEnv.isWeb && isSeedResult) {
      forceRemoteOnceRef.current = true;
    }
    void fetchMarketTokenList();
  }, [fetchMarketTokenList, isSeedResult]);

  const loadMore = useCallback(async () => {
    // Check if we can load more pages
    if (
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
        timeFrame,
      });

      if (currentQueryKeyRef.current !== requestQueryKey) {
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
