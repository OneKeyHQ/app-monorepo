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
      // For polling updates, request all loaded pages to keep data fresh
      // For initial load, only request the first page
      const pageNumbers = Array.from({ length: currentPage }, (_, i) => i + 1);

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
    if (isLoadingMore || currentPage >= maxPages || isLoading) {
      return;
    }

    const nextPage = currentPage + 1;
    const maxPossiblePages = Math.ceil(totalCount / pageSize);

    // Check if there are more pages available from server
    if (maxPossiblePages > 0 && nextPage > maxPossiblePages) {
      return;
    }

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
    totalCount,
    pageSize,
    networkId,
    sortBy,
    sortType,
    minLiquidity,
    networkLogoUri,
    transformedData.length,
  ]);

  const canLoadMore = currentPage < maxPages && !isLoading && !isLoadingMore;

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
