import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
}

export function useMarketTokenList({
  networkId,
  initialSortBy,
  initialSortType,
  pageSize = 20,
}: IUseMarketTokenListParams) {
  // Get minLiquidity from market config
  const { minLiquidity } = useMarketBasicConfig();
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(
    initialSortBy || 'v24hUSD',
  );
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType || 'desc',
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [consecutiveEmptyResponses, setConsecutiveEmptyResponses] = useState(0);
  const maxPages = 5;

  // Optimize network logo URI calculation
  const networkLogoUri = useMemo(
    () => getNetworkLogoUri(networkId),
    [networkId],
  );

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult(
    async () => {
      // Default to fetch first 2 pages, or all loaded pages if user has manually loaded more
      const pagesToFetch = currentPage === 1 ? 2 : currentPage;
      const pageNumbers = Array.from({ length: pagesToFetch }, (_, i) => i + 1);

      const promises = pageNumbers.map((page) =>
        backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId,
          sortBy,
          sortType,
          page,
          limit: pageSize,
          minLiquidity,
        }),
      );

      const responses = await Promise.all(promises);

      // Update currentPage to reflect the pages we actually fetched (avoid triggering another fetch)
      if (currentPage === 1 && pagesToFetch === 2) {
        // Use setTimeout to avoid triggering usePromiseResult again immediately
        setTimeout(() => setCurrentPage(2), 0);
      }

      // Combine all pages into a single response
      const combinedList = responses.flatMap((response) => response.list);
      const totalCount = responses[0]?.total || 0;

      return {
        list: combinedList,
        total: totalCount,
      };
    },
    [networkId, sortBy, sortType, pageSize, minLiquidity, currentPage],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 60 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  useEffect(() => {
    if (!apiResult || !apiResult.list) {
      return;
    }

    const transformed = apiResult.list.map((item, idx) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
        index: idx,
      }),
    );

    // Update data only after successful fetch (preserve existing data during loading)
    setTransformedData(transformed);

    // Reset network switching state when new data arrives
    setIsNetworkSwitching(false);
  }, [apiResult, networkId, networkLogoUri]);

  // Reset pagination when networkId, sortBy, or sortType changes
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingMore(false);
    setHasReachedEnd(false);
    setConsecutiveEmptyResponses(0);
    // Don't clear data immediately to avoid UI flicker
    // The data will be replaced when new API result arrives
  }, [networkId, sortBy, sortType]);

  // Handle network switching - separate effect to track networkId changes specifically
  useEffect(() => {
    setIsNetworkSwitching(true);
  }, [networkId]);

  const totalCount = apiResult?.total || 0;

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);

  const refresh = useCallback(() => {
    // Don't clear data immediately - let new data load first
    void fetchMarketTokenList();
  }, [fetchMarketTokenList]);

  const loadMore = useCallback(async () => {
    // Check if we can load more pages
    if (
      isLoadingMore ||
      currentPage >= maxPages ||
      isLoading ||
      hasReachedEnd
    ) {
      return;
    }

    const nextPage = currentPage + 1;

    setIsLoadingMore(true);

    try {
      // Load the next page
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId,
          sortBy,
          sortType,
          page: nextPage,
          limit: pageSize,
          minLiquidity,
        });

      if (response?.list?.length > 0) {
        // Reset consecutive empty responses counter when we get data
        setConsecutiveEmptyResponses(0);

        // Transform new data
        const newTransformed = response.list.map((item, idx) =>
          transformApiItemToToken(item, {
            chainId: networkId,
            networkLogoUri,
            index: transformedData.length + idx,
          }),
        );

        // Append new data to existing data
        setTransformedData((prev) => [...prev, ...newTransformed]);
        setCurrentPage(nextPage);
      } else {
        // Increment consecutive empty responses counter
        const newConsecutiveEmptyCount = consecutiveEmptyResponses + 1;
        setConsecutiveEmptyResponses(newConsecutiveEmptyCount);

        // Only mark as reached end after 3 consecutive empty responses
        if (newConsecutiveEmptyCount >= 3) {
          setHasReachedEnd(true);
        } else {
          // Still try to load the next page
          setCurrentPage(nextPage);
        }
      }
    } catch (error) {
      console.error('Failed to load more market tokens:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    currentPage,
    maxPages,
    isLoading,
    hasReachedEnd,
    consecutiveEmptyResponses,
    pageSize,
    networkId,
    sortBy,
    sortType,
    minLiquidity,
    networkLogoUri,
    transformedData.length,
  ]);

  const canLoadMore =
    currentPage < maxPages && !isLoading && !isLoadingMore && !hasReachedEnd;

  return {
    data: transformedData,
    isLoading,
    isLoadingMore,
    isNetworkSwitching,
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
