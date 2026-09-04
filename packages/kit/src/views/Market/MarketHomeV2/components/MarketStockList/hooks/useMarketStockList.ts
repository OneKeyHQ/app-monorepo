import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  DEFAULT_MARKET_STOCK_SORT_BY,
  DEFAULT_MARKET_STOCK_SORT_TYPE,
} from '@onekeyhq/shared/src/consts/marketConsts';
import type {
  IMarketStockPublicItem,
  IMarketStockPublicListResponse,
  IMarketStockPublicListSortBy,
} from '@onekeyhq/shared/types/marketV2';

import { appendUniqueMarketStocks } from '../utils';

const MARKET_STOCK_LIST_PAGE_SIZE = 20;

type IMarketStockListState = {
  queryKey: string;
  items: IMarketStockPublicItem[];
  nextCursor?: string;
  total: number;
};

type IMarketStockListResult = {
  queryKey: string;
  response?: IMarketStockPublicListResponse;
  failed?: boolean;
};

export function useMarketStockList({ category }: { category?: string }) {
  const [sortBy, setSortBy] = useState<IMarketStockPublicListSortBy>(
    DEFAULT_MARKET_STOCK_SORT_BY,
  );
  const [sortType, setSortType] = useState<'asc' | 'desc'>(
    DEFAULT_MARKET_STOCK_SORT_TYPE,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadMoreError, setIsLoadMoreError] = useState(false);
  const queryKey = useMemo(
    () => JSON.stringify({ category, sortBy, sortType }),
    [category, sortBy, sortType],
  );
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const [listState, setListState] = useState<IMarketStockListState>({
    queryKey: '',
    items: [],
    total: 0,
  });

  const {
    result: firstPageResult,
    isLoading,
    run: refresh,
  } = usePromiseResult<IMarketStockListResult>(
    async () => {
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
            limit: MARKET_STOCK_LIST_PAGE_SIZE,
            category,
            sortBy,
            sortType,
          });
        return { queryKey, response };
      } catch {
        return { queryKey, failed: true };
      }
    },
    [category, queryKey, sortBy, sortType],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  useEffect(() => {
    if (firstPageResult?.queryKey !== queryKey || !firstPageResult.response) {
      return;
    }
    setListState({
      queryKey,
      items: firstPageResult.response.items,
      nextCursor: firstPageResult.response.nextCursor,
      total: firstPageResult.response.total,
    });
    setIsLoadMoreError(false);
  }, [firstPageResult, queryKey]);

  const hasCurrentData = listState.queryKey === queryKey;
  const items = hasCurrentData ? listState.items : [];
  const nextCursor = hasCurrentData ? listState.nextCursor : undefined;

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    const requestQueryKey = queryKey;
    setIsLoadingMore(true);
    setIsLoadMoreError(false);
    try {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
          cursor: nextCursor,
          limit: MARKET_STOCK_LIST_PAGE_SIZE,
          category,
          sortBy,
          sortType,
        });
      if (queryKeyRef.current !== requestQueryKey) {
        return;
      }
      setListState((current) => {
        if (current.queryKey !== requestQueryKey) {
          return current;
        }
        return {
          queryKey: requestQueryKey,
          items: appendUniqueMarketStocks(current.items, response.items),
          nextCursor: response.nextCursor,
          total: response.total,
        };
      });
    } catch (_error) {
      if (queryKeyRef.current === requestQueryKey) {
        setIsLoadMoreError(true);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [category, isLoadingMore, nextCursor, queryKey, sortBy, sortType]);

  const setSorting = useCallback(
    (
      nextSortBy: Exclude<IMarketStockPublicListSortBy, 'default'>,
      nextSortType: 'asc' | 'desc' | undefined,
    ) => {
      if (!nextSortType) {
        setSortBy(DEFAULT_MARKET_STOCK_SORT_BY);
        setSortType(DEFAULT_MARKET_STOCK_SORT_TYPE);
        return;
      }
      setSortBy(nextSortBy);
      setSortType(nextSortType);
    },
    [],
  );

  return {
    items,
    total: hasCurrentData ? listState.total : 0,
    isLoading: Boolean(isLoading) && !hasCurrentData,
    isLoadingMore,
    isLoadMoreError,
    isError: Boolean(firstPageResult?.failed) && !hasCurrentData,
    canLoadMore: Boolean(nextCursor),
    sortBy,
    sortType,
    setSorting,
    loadMore,
    refresh,
  };
}
