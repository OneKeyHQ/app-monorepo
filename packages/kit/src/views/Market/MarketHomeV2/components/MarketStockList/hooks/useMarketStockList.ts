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
      if (platformEnv.isNative) {
        loadMoreRequestRef.current = undefined;
        setIsLoadingMore(false);
      }
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
          current.queryKey === queryKey
            ? Math.max(1, current.loadedPageCount)
            : 1;
        let response = firstPage;
        let loadedPageCount = 1;

        while (
          queryKeyRef.current === queryKey &&
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

        if (queryKeyRef.current === queryKey) {
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
      }
    },
    [category, queryKey, sortBy, sortType],
    {
      swrKey,
      swrShouldPersist: (data) => Boolean(data.response && !data.failed),
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
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
    if (
      !nextCursor ||
      isLoading ||
      isLoadingMore ||
      isAwaitingRemoteFirstPage ||
      (platformEnv.isNative && loadMoreRequestRef.current !== undefined)
    ) {
      return;
    }
    const requestQueryKey = queryKey;
    const request = {};
    if (platformEnv.isNative) loadMoreRequestRef.current = request;
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
        (platformEnv.isNative && loadMoreRequestRef.current !== request)
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
        (!platformEnv.isNative || loadMoreRequestRef.current === request)
      ) {
        setIsLoadMoreError(true);
      }
    } finally {
      if (!platformEnv.isNative || loadMoreRequestRef.current === request) {
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
    isError:
      isFirstPageError &&
      (!hasCurrentData || (platformEnv.isNative && items.length === 0)),
    canLoadMore:
      Boolean(nextCursor) && !isLoading && !isAwaitingRemoteFirstPage,
    sortBy,
    sortType,
    setSorting,
    loadMore,
    refresh,
  };
}
