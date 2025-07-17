import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
  minLiquidity?: number;
  maxLiquidity?: number;
}

export function useMarketTokenList({
  networkId,
  initialSortBy,
  initialSortType,
  pageSize = 50,
  minLiquidity,
  maxLiquidity,
}: IUseMarketTokenListParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<string | undefined>(
    initialSortBy || 'v24hUSD',
  );
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType || 'desc',
  );

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId,
          sortBy,
          sortType,
          page: currentPage,
          limit: pageSize,
          minLiquidity,
          maxLiquidity,
        });
      return response;
    },
    [
      networkId,
      sortBy,
      sortType,
      currentPage,
      pageSize,
      minLiquidity,
      maxLiquidity,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 60 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  useEffect(() => {
    if (!apiResult || !apiResult.list) {
      setIsLoadingMore(false);
      return;
    }

    const networkLogoUri = getNetworkLogoUri(networkId);
    const transformed = apiResult.list.map((item, idx) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
        index: (currentPage - 1) * pageSize + idx,
      }),
    );

    setTransformedData((prevData) => {
      // If it's the first page, replace the data
      if (currentPage === 1) {
        return transformed;
      }
      // Otherwise, append to existing data
      return [...prevData, ...transformed];
    });

    // Check if we have more data based on the actual response
    // If the returned data is less than pageSize, we've reached the end
    const hasMoreData = apiResult.list.length === pageSize;
    console.log('Setting hasMore:', {
      currentPage,
      responseLength: apiResult.list.length,
      pageSize,
      hasMoreData,
    });
    setHasMore(hasMoreData);

    setIsLoadingMore(false);
  }, [apiResult, networkId, currentPage, pageSize]);

  // Reset data when dependencies change
  useEffect(() => {
    setTransformedData([]);
    setCurrentPage(1);
    setIsLoadingMore(false);
    setHasMore(true); // Reset to true when starting fresh
  }, [networkId, sortBy, sortType, minLiquidity, maxLiquidity]);

  const totalCount = apiResult?.total || 0;

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);

  const loadMore = useCallback(() => {
    console.log('loadMore called', { hasMore, isLoadingMore, isLoading });
    if (hasMore && !isLoadingMore && !isLoading) {
      console.log(
        'Loading more data - incrementing page from',
        currentPage,
        'to',
        currentPage + 1,
      );
      setIsLoadingMore(true);

      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMore, isLoadingMore, isLoading, currentPage]);

  const refresh = useCallback(() => {
    setTransformedData([]);
    setCurrentPage(1);
    setIsLoadingMore(false);
    setHasMore(true); // Reset to true when refreshing
    void fetchMarketTokenList();
  }, [fetchMarketTokenList]);

  return {
    data: transformedData,
    isLoading,
    isLoadingMore,
    hasMore,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    loadMore,
    refresh,
    refetch: fetchMarketTokenList,
    sortBy,
    sortType,
    setSortBy,
    setSortType,
  } as const;
}
