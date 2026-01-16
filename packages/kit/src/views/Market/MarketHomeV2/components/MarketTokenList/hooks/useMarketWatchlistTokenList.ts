import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCarouselIndex } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

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
      const tokenAddressList = watchlist
        .filter((item) => item.chainId)
        .map((item) => ({
          chainId: item.chainId,
          contractAddress: item.contractAddress,
          isNative: item.isNative ?? false, // Use stored isNative field from watchlist
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

    // Use chainId + contractAddress combination for unique mapping
    const tokenMap: Record<
      string,
      { chainId: string; sortIndex: number; isNative: boolean }
    > = {};
    watchlist.forEach((w) => {
      const key = `${w.chainId}:${w.contractAddress.toLowerCase()}`;
      tokenMap[key] = {
        chainId: w.chainId,
        sortIndex: w.sortIndex ?? 0,
        isNative: w.isNative ?? false,
      };
    });

    const transformed: IMarketToken[] = apiResult.list.map((item) => {
      // Get isNative from watchlist data since API doesn't return it
      let address = item.address;
      const networkId = item.networkId || '';
      const key = `${networkId}:${address.toLowerCase()}`;

      const tokenInfo = tokenMap[key];
      const chainId = tokenInfo?.chainId || networkId;
      const networkLogoUri = getNetworkLogoUri(chainId);
      const sortIndex = tokenInfo?.sortIndex;
      let isNative = tokenInfo?.isNative ?? false; // Get isNative from watchlist

      // TODO: Remove this after we have a better way to handle native tokens
      // Special handling for native tokens (short addresses)
      if (address.length < 30) {
        if (item.symbol === 'SUI' && networkId === 'sui--mainnet') {
          address = '0x2::sui::SUI';
        } else {
          address = '';
        }
        isNative = true;
      }

      // Add isNative to the API item
      const itemWithNative = {
        ...item,
        address,
        isNative,
      } as IMarketTokenListItem & { isNative: boolean };

      return transformApiItemToToken(itemWithNative, {
        chainId,
        networkLogoUri,
        sortIndex,
      });
    });

    // Build result array in watchlist order to maintain correct sorting
    const filteredTransformed = watchlist
      .map((watchlistItem) => {
        // Find corresponding token in transformed data
        const found = transformed.find((token) => {
          const tokenKey = token.address.toLowerCase();
          const watchlistKey = watchlistItem.contractAddress.toLowerCase();
          const chainMatches = watchlistItem.chainId === token.chainId;
          return tokenKey === watchlistKey && chainMatches;
        });

        return found;
      })
      .filter(Boolean); // Remove undefined items

    setTransformedData(filteredTransformed);

    // Reset initial load state after first data arrives
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [apiResult, watchlist, isInitialLoad]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortBy || !sortType) {
      // Default: use sortIndex for natural watchlist ordering (ascending)
      return [...transformedData].sort((a, b) => {
        const av = a.sortIndex ?? 0;
        const bv = b.sortIndex ?? 0;
        return av - bv;
      });
    }

    // Custom sorting
    const key = SORT_MAP[sortBy] || sortBy;
    return [...transformedData].sort((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      if (av === bv) return 0;
      return sortType === 'asc' ? av - bv : bv - av;
    });
  }, [transformedData, sortBy, sortType]);

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
