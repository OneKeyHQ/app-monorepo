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
const MARKET_STOCK_SELECTOR_CACHE_FRESH_MS = 5 * 60 * 1000;
const UNINITIALIZED_STOCK_SELECTOR_QUERY_KEY = '__uninitialized__';

type IMarketStockSelectorListResult = {
  queryKey: string;
  response?: IMarketStockPublicListResponse;
  failed?: boolean;
};

type ICachedMarketStockListResult = IMarketStockSelectorListResult & {
  firstPage?: IMarketStockPublicListResponse;
};

type IMarketStockSelectorListState = {
  queryKey: string;
  items: IMarketStockPublicItem[];
  nextCursor?: string;
  total: number;
  firstPage?: IMarketStockPublicListResponse;
};

const EMPTY_STOCK_SELECTOR_RESULT: IMarketStockSelectorListResult = {
  queryKey: '',
  response: undefined,
};

function dropStaleStockListCache(swrKey: string) {
  if (
    swrCacheUtils.getWithTimestamp(swrKey) &&
    !swrCacheUtils.isFresh(swrKey, MARKET_STOCK_SELECTOR_CACHE_FRESH_MS)
  ) {
    swrCacheUtils.remove(swrKey);
  }
}

function readCachedStockListResponse(swrKey: string) {
  dropStaleStockListCache(swrKey);
  const cached =
    swrCacheUtils.getWithTimestamp<ICachedMarketStockListResult>(swrKey);
  if (!cached?.data || cached.data.failed) {
    return undefined;
  }
  return cached.data.firstPage ?? cached.data.response;
}

export function useMarketStockSelectorList({
  query,
  searchOnly = false,
}: {
  query?: string;
  searchOnly?: boolean;
}) {
  const locale = useLocaleVariant();
  const normalizedQuery = query?.trim() ?? '';
  const queryKey = normalizedQuery;
  const shouldUseDefaultList = !searchOnly && !normalizedQuery;
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
  const emptyListSwrKey = useMemo(() => {
    if (!shouldUseDefaultList) {
      return undefined;
    }
    const key = swrKeys.marketHomeStocks(`selector:${defaultListQueryKey}`);
    dropStaleStockListCache(key);
    return key;
  }, [defaultListQueryKey, shouldUseDefaultList]);
  const cachedEmptyListInitResult = useMemo(() => {
    if (!shouldUseDefaultList) {
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
  }, [defaultListQueryKey, emptyListSwrKey, shouldUseDefaultList]);

  const [listState, setListState] = useState<IMarketStockSelectorListState>({
    queryKey: UNINITIALIZED_STOCK_SELECTOR_QUERY_KEY,
    items: [],
    total: 0,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadMoreError, setIsLoadMoreError] = useState(false);
  const loadMoreRequestRef = useRef<object | undefined>(undefined);
  const queuedLoadMoreRef = useRef<string | undefined>(undefined);
  const remoteQueryKeyRef = useRef<string | undefined>(undefined);
  const previousQueryKeyRef = useRef(queryKey);
  if (previousQueryKeyRef.current !== queryKey) {
    previousQueryKeyRef.current = queryKey;
    remoteQueryKeyRef.current = undefined;
  }

  const {
    result: firstPageResult,
    isLoading,
    run: refresh,
  } = usePromiseResult<IMarketStockSelectorListResult>(
    async () => {
      const requestQueryKey = queryKey;
      try {
        if (searchOnly && !normalizedQuery) {
          if (queryKeyRef.current === requestQueryKey) {
            remoteQueryKeyRef.current = requestQueryKey;
          }
          return {
            queryKey: requestQueryKey,
            response: { items: [], total: 0 },
          };
        }
        const response = normalizedQuery
          ? await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
              query: normalizedQuery,
              limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
            })
          : await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
              limit: MARKET_STOCK_SELECTOR_PAGE_SIZE,
            });
        if (queryKeyRef.current === requestQueryKey) {
          remoteQueryKeyRef.current = requestQueryKey;
        }
        return { queryKey: requestQueryKey, response };
      } catch {
        if (queryKeyRef.current === requestQueryKey) {
          remoteQueryKeyRef.current = requestQueryKey;
        }
        return { queryKey: requestQueryKey, failed: true };
      }
    },
    [normalizedQuery, queryKey, searchOnly],
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

    if (firstPageResult.failed) {
      return;
    }
    if (!firstPageResult.response) {
      setListState({ queryKey, items: [], total: 0 });
      return;
    }

    setListState({
      queryKey,
      items: firstPageResult.response.items,
      nextCursor: firstPageResult.response.nextCursor,
      total: firstPageResult.response.total,
      firstPage: firstPageResult.response,
    });
  }, [firstPageResult, queryKey]);

  const currentResponse =
    firstPageResult?.queryKey === queryKey
      ? firstPageResult.response
      : undefined;
  const currentFirstPage = currentResponse;
  // Publish the remote first page on this render so a queued loadMore cannot
  // close over the cached cursor while the apply effect is still pending.
  const currentListState =
    currentResponse &&
    (listState.queryKey !== queryKey ||
      listState.firstPage !== currentFirstPage)
      ? {
          queryKey,
          items: currentResponse.items,
          nextCursor: currentResponse.nextCursor,
          total: currentResponse.total,
          firstPage: currentFirstPage,
        }
      : listState;
  const hasListState = currentListState.queryKey === queryKey;
  const items = hasListState
    ? currentListState.items
    : (currentResponse?.items ?? []);
  const nextCursor = hasListState
    ? currentListState.nextCursor
    : currentResponse?.nextCursor;
  const hasCurrentData = hasListState || Boolean(currentResponse);
  const isFirstPageError =
    firstPageResult?.queryKey === queryKey && Boolean(firstPageResult.failed);
  const isFirstPagePending =
    firstPageResult?.queryKey !== queryKey ||
    (!firstPageResult?.response && !firstPageResult?.failed);
  const isAwaitingRemoteFirstPage =
    remoteQueryKeyRef.current !== queryKey ||
    Boolean(
      currentFirstPage && currentListState.firstPage !== currentFirstPage,
    );
  const isRevalidatingFirstPage = isAwaitingRemoteFirstPage && items.length > 0;

  const loadMore = useCallback(async () => {
    if (isLoading || isAwaitingRemoteFirstPage) {
      queuedLoadMoreRef.current = queryKey;
      return;
    }
    if (
      !hasCurrentData ||
      !nextCursor ||
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
      if (searchOnly && !normalizedQuery) {
        return;
      }
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
    isAwaitingRemoteFirstPage,
    isLoading,
    isLoadingMore,
    nextCursor,
    normalizedQuery,
    queryKey,
    searchOnly,
  ]);

  useEffect(() => {
    if (isLoading || isAwaitingRemoteFirstPage) {
      return;
    }
    const queuedQueryKey = queuedLoadMoreRef.current;
    queuedLoadMoreRef.current = undefined;
    if (queuedQueryKey === queryKey && !isFirstPageError) {
      void loadMore();
    }
  }, [
    isAwaitingRemoteFirstPage,
    isFirstPageError,
    isLoading,
    loadMore,
    queryKey,
  ]);

  return {
    items,
    total: hasListState
      ? currentListState.total
      : (currentResponse?.total ?? 0),
    isLoading:
      items.length === 0 &&
      !isFirstPageError &&
      (Boolean(isLoading) || isFirstPagePending),
    isError: isFirstPageError && items.length === 0,
    isLoadingMore,
    isLoadMoreError,
    canLoadMore:
      Boolean(nextCursor) && hasCurrentData && !isAwaitingRemoteFirstPage,
    isRevalidatingFirstPage,
    loadMore,
    refresh,
  };
}
