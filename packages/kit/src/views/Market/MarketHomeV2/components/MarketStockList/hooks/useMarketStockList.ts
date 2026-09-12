import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  DEFAULT_MARKET_STOCK_SORT_BY,
  DEFAULT_MARKET_STOCK_SORT_TYPE,
} from '@onekeyhq/shared/src/consts/marketConsts';
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
};

type IMarketStockListResult = {
  queryKey: string;
  response?: IMarketStockPublicListResponse;
  failed?: boolean;
};

export function useMarketStockList({ category }: { category?: string }) {
  const locale = useLocaleVariant();
  const [sortBy, setSortBy] = useState<IMarketStockPublicListSortBy>(
    DEFAULT_MARKET_STOCK_SORT_BY,
  );
  const [sortType, setSortType] = useState<'asc' | 'desc'>(
    DEFAULT_MARKET_STOCK_SORT_TYPE,
  );
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
  });

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
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
            limit: MARKET_STOCK_LIST_PAGE_SIZE,
            category,
            sortBy,
            sortType,
          });
        if (queryKeyRef.current === queryKey)
          remoteQueryKeyRef.current = queryKey;
        return { queryKey, response };
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
    setListState({
      queryKey,
      items: firstPageResult.response.items,
      nextCursor: firstPageResult.response.nextCursor,
      total: firstPageResult.response.total,
      firstPage: firstPageResult.response,
    });
    setIsLoadMoreError(false);
  }, [firstPageResult, queryKey]);

  const currentResponse =
    firstPageResult?.queryKey === queryKey
      ? firstPageResult.response
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
    Boolean(currentResponse && listState.firstPage !== currentResponse);

  const loadMore = useCallback(async () => {
    if (
      !nextCursor ||
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
    total: hasListState ? listState.total : (currentResponse?.total ?? 0),
    isLoading: !hasCurrentData && (!isFirstPageError || Boolean(isLoading)),
    isLoadingMore,
    isLoadMoreError,
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
