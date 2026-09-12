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
const MARKET_STOCK_LIST_MAX_PERSISTED_PAGES = 3;
const MARKET_STOCK_LIST_REFRESH_INTERVAL_MS = 30_000;

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
  const inFlightRefreshRef = useRef<
    | {
        queryKey: string;
        promise: Promise<IMarketStockListResult>;
      }
    | undefined
  >(undefined);
  const lastRefreshRef = useRef<
    | {
        result: IMarketStockListResult;
        completedAt: number;
      }
    | undefined
  >(undefined);
  const forceRefreshRef = useRef(false);
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
    run: runRefresh,
  } = usePromiseResult<IMarketStockListResult>(
    () => {
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      const inFlight = inFlightRefreshRef.current;
      if (inFlight?.queryKey === queryKey) return inFlight.promise;
      const lastRefresh = lastRefreshRef.current;
      if (
        !force &&
        remoteQueryKeyRef.current === queryKey &&
        lastRefresh?.result.queryKey === queryKey &&
        lastRefresh.result.loadedPageCount ===
          listStateRef.current.loadedPageCount &&
        Date.now() - lastRefresh.completedAt <
          MARKET_STOCK_LIST_REFRESH_INTERVAL_MS
      ) {
        return Promise.resolve(lastRefresh.result);
      }
      const promise = (async (): Promise<IMarketStockListResult> => {
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
          const result = {
            queryKey,
            response,
            firstPage,
            loadedPageCount,
          };
          if (
            queryKeyRef.current === queryKey &&
            refreshRequestRef.current === refreshRequest
          ) {
            lastRefreshRef.current = { result, completedAt: Date.now() };
          }
          return result;
        } catch {
          if (refreshRequestRef.current === refreshRequest) {
            lastRefreshRef.current = undefined;
          }
          return { queryKey, failed: true };
        } finally {
          if (refreshRequestRef.current === refreshRequest) {
            refreshRequestRef.current = undefined;
          }
        }
      })();
      inFlightRefreshRef.current = { queryKey, promise };
      void promise.finally(() => {
        if (inFlightRefreshRef.current?.promise === promise) {
          inFlightRefreshRef.current = undefined;
        }
      });
      return promise;
    },
    [category, queryKey, sortBy, sortType],
    {
      swrKey,
      swrShouldPersist: (data) =>
        Boolean(
          data.response &&
          !data.failed &&
          (data.loadedPageCount ?? 1) <= MARKET_STOCK_LIST_MAX_PERSISTED_PAGES,
        ),
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const refresh = useCallback(() => {
    forceRefreshRef.current = true;
    return runRefresh();
  }, [runRefresh]);

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
  // Publish rows and pagination together, before the persistence effect runs.
  const currentListState =
    currentResponse &&
    currentFirstPage &&
    (listState.queryKey !== queryKey ||
      listState.firstPage !== currentFirstPage)
      ? {
          queryKey,
          items: currentResponse.items,
          nextCursor: currentResponse.nextCursor,
          total: currentResponse.total,
          firstPage: currentFirstPage,
          loadedPageCount: firstPageResult?.loadedPageCount ?? 1,
        }
      : listState;
  listStateRef.current = currentListState;
  const hasListState = currentListState.queryKey === queryKey;
  const hasCurrentData = hasListState || Boolean(currentResponse);
  const items = hasListState
    ? currentListState.items
    : (currentResponse?.items ?? []);
  const nextCursor = hasListState
    ? currentListState.nextCursor
    : currentResponse?.nextCursor;
  const isFirstPageError =
    firstPageResult?.queryKey === queryKey && Boolean(firstPageResult.failed);
  const isAwaitingRemoteFirstPage =
    remoteQueryKeyRef.current !== queryKey ||
    Boolean(
      currentFirstPage && currentListState.firstPage !== currentFirstPage,
    );

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
    total: hasListState
      ? currentListState.total
      : (currentResponse?.total ?? 0),
    isLoading: !hasCurrentData && (!isFirstPageError || Boolean(isLoading)),
    isLoadingMore,
    isLoadMoreError,
    isRefreshing: Boolean(isLoading) && hasCurrentData,
    isRefreshError: isFirstPageError && items.length > 0,
    isError:
      isFirstPageError &&
      (!hasCurrentData || (platformEnv.isNative && items.length === 0)),
    canLoadMore: Boolean(nextCursor) && !isAwaitingRemoteFirstPage,
    isRevalidatingFirstPage: isAwaitingRemoteFirstPage && items.length > 0,
    sortBy,
    sortType,
    setSorting,
    loadMore,
    refresh,
  };
}
