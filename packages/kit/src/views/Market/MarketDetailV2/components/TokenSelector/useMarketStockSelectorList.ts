import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IMarketStockPublicItem,
  IMarketStockPublicListResponse,
} from '@onekeyhq/shared/types/marketV2';

import { appendUniqueMarketStocks } from '../../../MarketHomeV2/components/MarketStockList/utils';

const MARKET_STOCK_SELECTOR_PAGE_SIZE = 20;

type IMarketStockSelectorListResult = {
  queryKey: string;
  response?: IMarketStockPublicListResponse;
  failed?: boolean;
};

type IMarketStockSelectorListState = {
  queryKey: string;
  items: IMarketStockPublicItem[];
  nextCursor?: string;
  total: number;
};

export function useMarketStockSelectorList({ query }: { query?: string }) {
  const normalizedQuery = query?.trim() ?? '';
  const queryKey = normalizedQuery;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  const [listState, setListState] = useState<IMarketStockSelectorListState>({
    queryKey: '',
    items: [],
    total: 0,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadMoreError, setIsLoadMoreError] = useState(false);
  const loadMoreRequestRef = useRef<object | undefined>(undefined);

  const {
    result: firstPageResult,
    isLoading,
    run: refresh,
  } = usePromiseResult<IMarketStockSelectorListResult>(
    async () => {
      try {
        const response = normalizedQuery
          ? await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
              query: normalizedQuery,
              limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
            })
          : await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
              limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
            });
        return { queryKey, response };
      } catch {
        return { queryKey, failed: true };
      }
    },
    [normalizedQuery, queryKey],
    {
      initResult: { queryKey: '', response: undefined },
      undefinedResultIfReRun: true,
      watchLoading: true,
    },
  );

  useEffect(() => {
    if (firstPageResult?.queryKey !== queryKey) {
      return;
    }

    loadMoreRequestRef.current = undefined;
    setIsLoadingMore(false);
    setIsLoadMoreError(false);

    if (firstPageResult.failed || !firstPageResult.response) {
      setListState({ queryKey, items: [], total: 0 });
      return;
    }

    setListState({
      queryKey,
      items: firstPageResult.response.items,
      nextCursor: firstPageResult.response.nextCursor,
      total: firstPageResult.response.total,
    });
  }, [firstPageResult, queryKey]);

  const hasCurrentData = listState.queryKey === queryKey;
  const items = hasCurrentData ? listState.items : [];
  const nextCursor = hasCurrentData ? listState.nextCursor : undefined;
  const isFirstPageError =
    firstPageResult?.queryKey === queryKey && Boolean(firstPageResult.failed);
  const isFirstPagePending =
    firstPageResult?.queryKey !== queryKey ||
    (!firstPageResult?.response && !firstPageResult?.failed);

  const loadMore = useCallback(async () => {
    if (
      !hasCurrentData ||
      !nextCursor ||
      isLoading ||
      isLoadingMore ||
      loadMoreRequestRef.current !== undefined
    ) {
      return;
    }

    const requestQueryKey = queryKey;
    const request = {};
    loadMoreRequestRef.current = request;
    setIsLoadingMore(true);
    setIsLoadMoreError(false);

    try {
      const response = normalizedQuery
        ? await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
            query: normalizedQuery,
            cursor: nextCursor,
            limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
          })
        : await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
            cursor: nextCursor,
            limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
          });

      if (
        queryKeyRef.current !== requestQueryKey ||
        loadMoreRequestRef.current !== request
      ) {
        return;
      }

      setListState((current) => {
        if (current.queryKey !== requestQueryKey) {
          return current;
        }
        return {
          ...current,
          items: appendUniqueMarketStocks(current.items, response.items),
          nextCursor: response.nextCursor,
          total: response.total,
        };
      });
    } catch {
      if (
        queryKeyRef.current === requestQueryKey &&
        loadMoreRequestRef.current === request
      ) {
        setIsLoadMoreError(true);
      }
    } finally {
      if (loadMoreRequestRef.current === request) {
        loadMoreRequestRef.current = undefined;
        setIsLoadingMore(false);
      }
    }
  }, [
    hasCurrentData,
    isLoading,
    isLoadingMore,
    nextCursor,
    normalizedQuery,
    queryKey,
  ]);

  return {
    items,
    total: hasCurrentData ? listState.total : 0,
    isLoading: Boolean(isLoading) || isFirstPagePending,
    isError: isFirstPageError,
    isLoadingMore,
    isLoadMoreError,
    canLoadMore: Boolean(nextCursor) && hasCurrentData && !isLoading,
    loadMore,
    refresh,
  };
}
