import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
  minLiquidity?: number;
  maxLiquidity?: number;
}

export function useMarketWatchlistTokenList({
  watchlist,
  initialSortBy,
  initialSortType,
  pageSize = 100,
  minLiquidity,
  maxLiquidity,
}: IUseMarketWatchlistTokenListParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType,
  );
  const [isLoadingMore] = useState(false);
  const [hasMore] = useState(false);

  const {
    result: apiResult,
    isLoading,
    run: refetchData,
  } = usePromiseResult(
    async () => {
      if (!watchlist || watchlist.length === 0) return { list: [] } as const;
      const tokenAddressList = watchlist.map((item) => ({
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        isNative: false,
      }));
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
          tokenAddressList,
        });
      return response;
    },
    [watchlist],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      checkIsFocused: true,
    },
  );

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
      const key = item.address.toLowerCase();
      const chainId = chainIdMap[key] || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      const sortIndex = sortIndexMap[key];
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex,
      });
    });

    // Filter transformed data based on current watchlist to ensure immediate UI updates
    const filteredTransformed = transformed.filter((token) => {
      const key = token.address.toLowerCase();
      return watchlist.some(
        (w) =>
          w.contractAddress.toLowerCase() === key &&
          w.chainId === token.chainId,
      );
    });

    setTransformedData(filteredTransformed);
  }, [apiResult, watchlist]);

  // Apply liquidity filter
  const filteredData = useMemo(() => {
    let res = transformedData;
    if (typeof minLiquidity === 'number') {
      res = res.filter((d) => d.liquidity >= minLiquidity);
    }
    if (typeof maxLiquidity === 'number') {
      res = res.filter((d) => d.liquidity <= maxLiquidity);
    }
    return res;
  }, [transformedData, minLiquidity, maxLiquidity]);

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

  return {
    data: paginatedData,
    isLoading,
    isLoadingMore,
    hasMore,
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
