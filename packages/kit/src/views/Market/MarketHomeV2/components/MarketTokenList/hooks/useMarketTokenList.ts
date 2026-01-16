import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { useNetworkLoadingAnalytics } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/hooks/useNetworkLoadingAnalytics';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

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
  initialSortBy = 'v24hUSD',
  initialSortType = 'desc',
  pageSize = 20,
}: IUseMarketTokenListParams) {
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

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult<IMarketTokenListResponse | undefined>(
    async () => {
      if (!hasNetworkId) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId: apiNetworkId,
          sortBy,
          sortType,
          page: 1,
          limit: pageSize,
          minLiquidity,
        });
      return {
        list: response.list,
        total: response.total,
      };
    },
    [hasNetworkId, apiNetworkId, sortBy, sortType, pageSize, minLiquidity],
    {
      watchLoading: hasNetworkId,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 60 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  const effectiveIsLoading = hasNetworkId ? isLoading : false;

  useEffect(() => {
    if (!hasNetworkId || !apiResult || !apiResult.list) {
      return;
    }

    const transformed = apiResult.list.map((item) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
      }),
    );

    // Update data only after successful fetch (preserve existing data during loading)
    setTransformedData(transformed);

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
  }, [networkId, sortBy, sortType]);

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

  const refresh = useCallback(() => {
    // Don't clear data immediately - let new data load first
    void fetchMarketTokenList();
  }, [fetchMarketTokenList]);

  const loadMore = useCallback(async () => {
    // Check if we can load more pages
    if (
      isLoadingMore ||
      currentPage >= maxPages ||
      !hasNetworkId ||
      effectiveIsLoading ||
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
          networkId: apiNetworkId,
          sortBy,
          sortType,
          page: nextPage,
          limit: pageSize,
          minLiquidity,
        });

      if (response?.list?.length > 0) {
        // Transform new data
        const newTransformed = response.list.map((item) =>
          transformApiItemToToken(item, {
            chainId: networkId,
            networkLogoUri,
          }),
        );

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
    currentPage,
    effectiveIsLoading,
    hasReachedEnd,
    hasNetworkId,
    apiNetworkId,
    networkId,
    sortBy,
    sortType,
    pageSize,
    minLiquidity,
    trackNetworkLoading,
    networkLogoUri,
  ]);

  const canLoadMore =
    hasNetworkId &&
    currentPage < maxPages &&
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
