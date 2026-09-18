import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  DEFAULT_MARKET_STOCK_SORT_BY,
  DEFAULT_MARKET_STOCK_SORT_TYPE,
} from '@onekeyhq/shared/src/consts/marketConsts';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IMarketStockPublicItem,
  IMarketStockPublicListResponse,
} from '@onekeyhq/shared/types/marketV2';

import {
  appendUniqueMarketStocks,
  buildMarketStockListQueryKey,
} from '../../../MarketHomeV2/components/MarketStockList/utils';

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

const EMPTY_STOCK_SELECTOR_RESULT: IMarketStockSelectorListResult = {
  queryKey: '',
  response: undefined,
};

function readCachedStockListResponse(swrKey: string) {
  const cached = swrCacheUtils.getWithTimestamp<{
    failed?: boolean;
    response?: IMarketStockPublicListResponse;
  }>(swrKey);
  if (!cached?.data.response || cached.data.failed) {
    return undefined;
  }
  return cached.data.response;
}

export function useMarketStockSelectorList({ query }: { query?: string }) {
  const locale = useLocaleVariant();
  const normalizedQuery = query?.trim() ?? '';
  const queryKey = normalizedQuery;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const defaultListQueryKey = useMemo(
    () =>
      buildMarketStockListQueryKey({
        locale,
        sortBy: DEFAULT_MARKET_STOCK_SORT_BY,
        sortType: DEFAULT_MARKET_STOCK_SORT_TYPE,
      }),
    [locale],
  );
  const emptyListSwrKey = useMemo(
    () =>
      normalizedQuery
        ? undefined
        : swrKeys.marketHomeStocks(`selector:${defaultListQueryKey}`),
    [defaultListQueryKey, normalizedQuery],
  );
  const cachedEmptyListInitResult = useMemo(() => {
    if (normalizedQuery) {
      return EMPTY_STOCK_SELECTOR_RESULT;
    }
    const response =
      (emptyListSwrKey
        ? readCachedStockListResponse(emptyListSwrKey)
        : undefined) ??
      readCachedStockListResponse(
        swrKeys.marketHomeStocks(defaultListQueryKey),
      );
    if (!response) {
      return EMPTY_STOCK_SELECTOR_RESULT;
    }
    return { queryKey: '', response };
  }, [defaultListQueryKey, emptyListSwrKey, normalizedQuery]);

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
      initResult: cachedEmptyListInitResult,
      watchLoading: true,
      swrKey: emptyListSwrKey,
      swrShouldPersist: (result) => Boolean(result.response && !result.failed),
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

  const currentResponse =
    firstPageResult?.queryKey === queryKey
      ? firstPageResult.response
      : undefined;
  const hasListState = listState.queryKey === queryKey;
  const items = hasListState ? listState.items : (currentResponse?.items ?? []);
  const nextCursor = hasListState
    ? listState.nextCursor
    : currentResponse?.nextCursor;
  const hasCurrentData = hasListState || Boolean(currentResponse);
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
    total: hasListState ? listState.total : (currentResponse?.total ?? 0),
    isLoading:
      items.length === 0 &&
      !isFirstPageError &&
      (Boolean(isLoading) || isFirstPagePending),
    isError: isFirstPageError,
    isLoadingMore,
    isLoadMoreError,
    canLoadMore: Boolean(nextCursor) && hasCurrentData && !isLoading,
    loadMore,
    refresh,
  };
}
