import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCarouselIndex } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  SORT_MAP,
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

export interface IUseMarketWatchlistTokenListParams {
  watchlist: IMarketWatchListItemV2[];
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
}

export function useMarketWatchlistTokenList({
  watchlist,
  initialSortBy,
  initialSortType,
  pageSize = 100,
}: IUseMarketWatchlistTokenListParams) {
  // Get minLiquidity from market config
  const { minLiquidity } = useMarketBasicConfig();
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType,
  );
  const [isLoadingMore] = useState(false);
  const [hasMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const pageIndex = useCarouselIndex();

  const {
    result: apiResult,
    isLoading: apiLoading,
    run: refetchData,
  } = usePromiseResult(
    async () => {
      if (!watchlist || watchlist.length === 0) {
        // For empty watchlist, still simulate a brief loading period for better UX
        if (isInitialLoad) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        return { list: [] } as const;
      }
      const tokenAddressList = watchlist.map((item) => ({
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        isNative: !item.contractAddress,
      }));
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
          tokenAddressList,
        });
      return response;
    },
    [watchlist, isInitialLoad],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      overrideIsFocused: (isFocused) => isFocused && pageIndex === 0,
      checkIsFocused: true,
    },
  );

  // Combined loading state: show loading during initial load or when API is loading
  const isLoading = isInitialLoad || apiLoading;

  useEffect(() => {
    if (!apiResult || !apiResult.list) return;

    // Map contractAddress to chainId and sortIndex for quick lookup
    const chainIdMap: Record<string, string> = {};
    const sortIndexMap: Record<string, number> = {};
    watchlist.forEach((w) => {
      const key = w.contractAddress.toLowerCase();
      chainIdMap[key] = w.chainId;
      sortIndexMap[key] = w.sortIndex ?? 0;
    });

    const transformed: IMarketToken[] = apiResult.list.map((item) => {
      // Short addresses are automatically normalized to empty strings in transformApiItemToToken
      const originalKey = item.address.toLowerCase();
      const key = originalKey.length < 15 ? '' : originalKey;

      const chainId = chainIdMap[key] || item.networkId || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      const sortIndex = sortIndexMap[key];

      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex,
      });
    });

    console.log('🔍 Debug transformed data:', {
      transformed,
      watchlist,
    });

    // Filter transformed data based on current watchlist to ensure immediate UI updates
    const filteredTransformed = transformed.filter((token) => {
      const key = token.address.toLowerCase();

      const matchingWatchlistItem = watchlist.find((w) => {
        const watchlistKey = w.contractAddress.toLowerCase();
        const chainMatches = w.chainId === token.chainId;

        return watchlistKey === key && chainMatches;
      });

      return !!matchingWatchlistItem;
    });

    setTransformedData(filteredTransformed);

    // Reset initial load state after first data arrives
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [apiResult, watchlist, isInitialLoad]);

  // Apply minimum liquidity filter (maxLiquidity no longer exists)
  const filteredData = useMemo(() => {
    if (typeof minLiquidity === 'number') {
      return transformedData.filter((d) => d.liquidity >= minLiquidity);
    }
    return transformedData;
  }, [transformedData, minLiquidity]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortBy || !sortType) {
      // Default: use sortIndex for natural watchlist ordering (ascending)
      return [...filteredData].sort((a, b) => {
        const av = a.sortIndex ?? 0;
        const bv = b.sortIndex ?? 0;
        return av - bv;
      });
    }

    // Custom sorting
    const key = SORT_MAP[sortBy] || sortBy;
    return [...filteredData].sort((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      if (av === bv) return 0;
      return sortType === 'asc' ? av - bv : bv - av;
    });
  }, [filteredData, sortBy, sortType]);

  const totalCount = sortedData.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  // Auto-adjust currentPage when totalPages changes (data-driven approach)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const loadMore = useCallback(() => {
    // Watchlist doesn't support load more - all data is loaded at once
  }, []);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    void refetchData();
  }, [refetchData]);

  // Add isNetworkSwitching state for consistency with normal token list
  // Watchlist doesn't switch networks, so always false
  const isNetworkSwitching = false;

  return {
    data: paginatedData,
    isLoading,
    isLoadingMore,
    isNetworkSwitching,
    canLoadMore: hasMore,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    loadMore,
    refresh,
    refetch: refetchData,
    sortBy,
    sortType,
    setSortBy,
    setSortType,
  } as const;
}
