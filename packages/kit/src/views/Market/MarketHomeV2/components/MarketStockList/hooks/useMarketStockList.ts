import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IMarketStockPublicItem,
  IMarketStockPublicListResponse,
  IMarketStockPublicListSortBy,
} from '@onekeyhq/shared/types/marketV2';

import { appendUniqueMarketStocks } from '../utils';

const MARKET_STOCK_LIST_PAGE_SIZE = 20;
const MARKET_STOCK_LIST_MAX_AUTO_REFRESH_PAGES = 3;

type IMarketStockListState = {
  queryKey: string;
  items: IMarketStockPublicItem[];
  nextCursor?: string;
  total: number;
  firstPage?: IMarketStockPublicListResponse;
  loadedPageCount: number;
};

type IMarketStockListResult = {
  queryKey: string;
  response?: IMarketStockPublicListResponse;
  firstPage?: IMarketStockPublicListResponse;
  loadedPageCount?: number;
  failed?: boolean;
};

export function useMarketStockList({ category }: { category?: string }) {
  const locale = useLocaleVariant();
  const [sortBy, setSortBy] = useState<IMarketStockPublicListSortBy>('default');
  const [sortType, setSortType] = useState<'asc' | 'desc'>('asc');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadMoreError, setIsLoadMoreError] = useState(false);
  const loadMoreRequestRef = useRef<object | undefined>(undefined);
  const refreshRequestRef = useRef<object | undefined>(undefined);
  const queuedLoadMoreRef = useRef<string | undefined>(undefined);
  const queryKey = useMemo(
    () => JSON.stringify({ category, sortBy, sortType, locale }),
    [category, sortBy, sortType, locale],
  );
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const [listState, setListState] = useState<IMarketStockListState>({
    queryKey: '',
    items: [],
    total: 0,
    loadedPageCount: 0,
  });
  const listStateRef = useRef(listState);
  listStateRef.current = listState;

  const remoteQueryKeyRef = useRef<string | undefined>(undefined);
  const previousQueryKeyRef = useRef(queryKey);
  if (previousQueryKeyRef.current !== queryKey) {
    previousQueryKeyRef.current = queryKey;
    remoteQueryKeyRef.current = undefined;
  }
  const swrKey = useMemo(() => {
    if (!platformEnv.isNative) return undefined;
    const key = swrKeys.marketHomeStocks(queryKey);
    if (
      swrCacheUtils.getWithTimestamp(key) &&
      !swrCacheUtils.isFresh(key, 5 * 60 * 1000)
    )
      swrCacheUtils.remove(key);
    return key;
  }, [queryKey]);
  const {
    result: firstPageResult,
    isLoading,
    run: refresh,
  } = usePromiseResult<IMarketStockListResult>(
    async () => {
      const refreshRequest = {};
      refreshRequestRef.current = refreshRequest;
      if (
        loadMoreRequestRef.current &&
        listStateRef.current.queryKey === queryKey
      ) {
        queuedLoadMoreRef.current = queryKey;
      }
      loadMoreRequestRef.current = undefined;
      setIsLoadingMore(false);
      try {
        const firstPage =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
            limit: MARKET_STOCK_LIST_PAGE_SIZE,
            category,
            sortBy,
            sortType,
          });
        const current = listStateRef.current;
        const pagesToRefresh =
          current.queryKey === queryKey &&
          remoteQueryKeyRef.current === queryKey
            ? Math.max(1, current.loadedPageCount)
            : 1;
        let response = firstPage;
        let loadedPageCount = 1;

        while (
          queryKeyRef.current === queryKey &&
          refreshRequestRef.current === refreshRequest &&
          response.nextCursor &&
          loadedPageCount < pagesToRefresh
        ) {
          const nextPage =
            await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
              cursor: response.nextCursor,
              limit: MARKET_STOCK_LIST_PAGE_SIZE,
              category,
              sortBy,
              sortType,
            });
          response = {
            items: appendUniqueMarketStocks(response.items, nextPage.items),
            nextCursor: nextPage.nextCursor,
            total: nextPage.total,
          };
          loadedPageCount += 1;
        }

        if (
          queryKeyRef.current === queryKey &&
          refreshRequestRef.current === refreshRequest
        ) {
          remoteQueryKeyRef.current = queryKey;
        }
        return {
          queryKey,
          response,
          firstPage,
          loadedPageCount,
        };
      } catch {
        return { queryKey, failed: true };
      } finally {
        if (refreshRequestRef.current === refreshRequest) {
          refreshRequestRef.current = undefined;
        }
      }
    },
    [category, queryKey, sortBy, sortType],
    {
      swrKey,
      swrShouldPersist: (data) =>
        Boolean(
          data.response &&
          !data.failed &&
          (data.loadedPageCount ?? 1) <=
            MARKET_STOCK_LIST_MAX_AUTO_REFRESH_PAGES,
        ),
      watchLoading: true,
      // Keep deep lists intact without replaying every page on route focus.
      revalidateOnFocus:
        listState.loadedPageCount <= MARKET_STOCK_LIST_MAX_AUTO_REFRESH_PAGES,
      revalidateOnReconnect:
        listState.loadedPageCount <= MARKET_STOCK_LIST_MAX_AUTO_REFRESH_PAGES,
    },
  );

  useEffect(() => {
    if (firstPageResult?.queryKey !== queryKey || !firstPageResult.response) {
      return;
    }
    const response = firstPageResult.response;
    setListState({
      queryKey,
      items: response.items,
      nextCursor: response.nextCursor,
      total: response.total,
      firstPage: firstPageResult.firstPage ?? response,
      loadedPageCount: firstPageResult.loadedPageCount ?? 1,
    });
    setIsLoadMoreError(false);
  }, [firstPageResult, queryKey]);

  const currentResponse =
    firstPageResult?.queryKey === queryKey
      ? firstPageResult.response
      : undefined;
  const currentFirstPage =
    firstPageResult?.queryKey === queryKey
      ? (firstPageResult.firstPage ?? currentResponse)
      : undefined;
  const hasListState = listState.queryKey === queryKey;
  const hasCurrentData = hasListState || Boolean(currentResponse);
  const items = hasListState ? listState.items : (currentResponse?.items ?? []);
  const nextCursor = hasListState
    ? listState.nextCursor
    : currentResponse?.nextCursor;
  const isFirstPageError =
    firstPageResult?.queryKey === queryKey && Boolean(firstPageResult.failed);
  const isAwaitingRemoteFirstPage =
    remoteQueryKeyRef.current !== queryKey ||
    Boolean(currentFirstPage && listState.firstPage !== currentFirstPage);

  const loadMore = useCallback(async () => {
    if (isLoading || refreshRequestRef.current) {
      queuedLoadMoreRef.current = queryKey;
      return;
    }
    if (
      !nextCursor ||
      isLoadingMore ||
      isAwaitingRemoteFirstPage ||
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
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
          cursor: nextCursor,
          limit: MARKET_STOCK_LIST_PAGE_SIZE,
          category,
          sortBy,
          sortType,
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
          queryKey: requestQueryKey,
          items: appendUniqueMarketStocks(current.items, response.items),
          nextCursor: response.nextCursor,
          total: response.total,
          loadedPageCount: current.loadedPageCount + 1,
        };
      });
    } catch (_error) {
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
    category,
    isLoading,
    isLoadingMore,
    isAwaitingRemoteFirstPage,
    nextCursor,
    queryKey,
    sortBy,
    sortType,
  ]);

  useEffect(() => {
    if (isLoading || isAwaitingRemoteFirstPage) return;
    const queuedQueryKey = queuedLoadMoreRef.current;
    queuedLoadMoreRef.current = undefined;
    if (queuedQueryKey === queryKey && !isFirstPageError) {
      void loadMore();
    }
  }, [
    isLoading,
    isAwaitingRemoteFirstPage,
    isFirstPageError,
    loadMore,
    queryKey,
  ]);

  const setSorting = useCallback(
    (
      nextSortBy: Exclude<IMarketStockPublicListSortBy, 'default'>,
      nextSortType: 'asc' | 'desc' | undefined,
    ) => {
      if (!nextSortType) {
        setSortBy('default');
        setSortType('asc');
        return;
      }
      setSortBy(nextSortBy);
      setSortType(nextSortType);
    },
    [],
  );

  return {
    items,
    total: hasListState ? listState.total : (currentResponse?.total ?? 0),
    isLoading: !hasCurrentData && (!isFirstPageError || Boolean(isLoading)),
    isLoadingMore,
    isLoadMoreError,
    isRefreshing: Boolean(isLoading) && hasCurrentData,
    isRefreshError: isFirstPageError && items.length > 0,
    isError:
      isFirstPageError &&
      (!hasCurrentData || (platformEnv.isNative && items.length === 0)),
    canLoadMore: Boolean(nextCursor) && !isAwaitingRemoteFirstPage,
    sortBy,
    sortType,
    setSorting,
    loadMore,
    refresh,
  };
}
