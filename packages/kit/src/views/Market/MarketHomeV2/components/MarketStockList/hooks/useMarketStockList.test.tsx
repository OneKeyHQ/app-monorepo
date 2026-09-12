/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IMarketStockPublicListResponse } from '@onekeyhq/shared/types/marketV2';

import { useMarketStockList } from './useMarketStockList';

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(null),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarketV2: { fetchMarketStockList: jest.fn() } },
}));

// The background proxy method is replaced by jest.fn above.
const fetchList = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketStockList,
);
const response: IMarketStockPublicListResponse = {
  items: [
    {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      price: '200',
    },
  ],
  total: 2,
  nextCursor: 'next',
};
function seed(category?: string) {
  const queryKey = JSON.stringify({
    category,
    sortBy: 'volume24h',
    sortType: 'desc',
    locale: 'en-US',
  });
  swrCacheUtils.set(swrKeys.marketHomeStocks(queryKey), { queryKey, response });
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  fetchList.mockReset();
  swrCacheUtils.clearAll();
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    value: (callback: () => void) => setTimeout(callback, 0),
  });
  Object.defineProperty(globalThis, 'cancelIdleCallback', {
    configurable: true,
    value: jest.fn(),
  });
});

it('shows loading before the initial request, then accepts a real empty result', async () => {
  const pending = deferred<IMarketStockPublicListResponse>();
  fetchList.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useMarketStockList({}));
  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(fetchList).toHaveBeenCalled());
  await act(async () => pending.resolve({ items: [], total: 0 }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.isError).toBe(false);
});

it('replays cached rows immediately but waits for remote page one before pagination', async () => {
  seed();
  const pending = deferred<IMarketStockPublicListResponse>();
  fetchList.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useMarketStockList({}));
  expect(result.current.items).toEqual(response.items);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.canLoadMore).toBe(false);
  await act(async () => result.current.loadMore());
  expect(fetchList.mock.calls.every(([params]) => !params?.cursor)).toBe(true);
  await waitFor(() => expect(fetchList).toHaveBeenCalled());
  await act(async () => pending.resolve(response));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
});

it('does not show previous-category rows while a new category is pending', async () => {
  seed('tech');
  fetchList.mockReturnValue(new Promise(() => undefined));
  const { result, rerender } = renderHook(
    ({ category }) => useMarketStockList({ category }),
    { initialProps: { category: 'tech' } },
  );
  expect(result.current.items).toHaveLength(1);
  rerender({ category: 'energy' });
  expect(result.current.items).toEqual([]);
  expect(result.current.isLoading).toBe(true);
});

it('ends loading on failure and does not persist a failed page', async () => {
  fetchList.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.isLoading).toBe(false);
  const queryKey = JSON.stringify({
    sortBy: 'volume24h',
    sortType: 'desc',
    locale: 'en-US',
  });
  expect(swrCacheUtils.get(swrKeys.marketHomeStocks(queryKey))).toBeUndefined();
});

it('shows a retryable error when refreshing a previously empty native list fails', async () => {
  fetchList.mockResolvedValue({ items: [], total: 0 });
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.items).toEqual([]);
  expect(result.current.isError).toBe(false);

  fetchList.mockRejectedValue(new Error('offline'));
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.isLoading).toBe(false);

  fetchList.mockResolvedValue(response);
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.items).toEqual(response.items));
  expect(result.current.isError).toBe(false);
});

it('rejects an expired stock snapshot on entry', () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now - 6 * 60 * 1000);
  seed();
  clock.mockRestore();
  fetchList.mockReturnValue(new Promise(() => undefined));
  const { result } = renderHook(() => useMarketStockList({}));
  expect(result.current.items).toEqual([]);
  expect(result.current.isLoading).toBe(true);
});

it('keeps cached rows when remote revalidation fails', async () => {
  seed();
  fetchList.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(fetchList).toHaveBeenCalled());
  expect(result.current.items).toEqual(response.items);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.canLoadMore).toBe(false);
});

it('keeps pagination enabled after appending the second page', async () => {
  fetchList.mockImplementation(async (params) => {
    if (params?.cursor === 'next') return { ...response, nextCursor: 'third' };
    if (params?.cursor === 'third')
      return { ...response, nextCursor: undefined };
    return response;
  });
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());
  expect(result.current.canLoadMore).toBe(true);
  await act(async () => result.current.loadMore());
  expect(
    fetchList.mock.calls.some(([params]) => params?.cursor === 'third'),
  ).toBe(true);
  expect(result.current.canLoadMore).toBe(false);
});

it('starts with volume descending and restores it after clearing another column', async () => {
  fetchList.mockResolvedValue(response);
  const { result } = renderHook(() => useMarketStockList({ category: 'tech' }));
  await waitFor(() =>
    expect(fetchList).toHaveBeenCalledWith({
      limit: 20,
      category: 'tech',
      sortBy: 'volume24h',
      sortType: 'desc',
    }),
  );
  act(() => result.current.setSorting('marketCap', 'asc'));
  await waitFor(() =>
    expect(fetchList).toHaveBeenCalledWith({
      limit: 20,
      category: 'tech',
      sortBy: 'marketCap',
      sortType: 'asc',
    }),
  );
  act(() => result.current.setSorting('marketCap', undefined));
  expect(result.current.sortBy).toBe('volume24h');
  expect(result.current.sortType).toBe('desc');
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());
  expect(fetchList).toHaveBeenLastCalledWith({
    cursor: 'next',
    limit: 20,
    category: 'tech',
    sortBy: 'volume24h',
    sortType: 'desc',
  });
});

it('starts one native cursor request for concurrent end-reached events', async () => {
  const nextPage = deferred<IMarketStockPublicListResponse>();
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? nextPage.promise : response,
  );
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  let requests: Promise<void>[] = [];
  act(() => {
    requests = [result.current.loadMore(), result.current.loadMore()];
  });
  const calls = fetchList.mock.calls.filter(
    ([params]) => params?.cursor,
  ).length;
  await act(async () => {
    nextPage.resolve({ ...response, nextCursor: undefined });
    await Promise.all(requests);
  });
  expect(calls).toBe(1);
});

it('discards a native cursor response superseded by first-page refresh', async () => {
  const nextPage = deferred<IMarketStockPublicListResponse>();
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? nextPage.promise : response,
  );
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.loadMore();
  });
  const fresh = {
    ...response,
    items: [{ ...response.items[0], stockId: 'FRESH' }],
  };
  fetchList.mockResolvedValue(fresh);
  await act(async () => result.current.refresh());
  await act(async () => {
    nextPage.resolve({
      ...response,
      items: [{ ...response.items[0], stockId: 'STALE' }],
    });
    await pending;
  });
  expect(result.current.items.map((item) => item.stockId)).toEqual(['FRESH']);
  expect(result.current.isLoadingMore).toBe(false);
});

it('keeps the current native category loading while an old cursor request completes', async () => {
  const oldPage = deferred<IMarketStockPublicListResponse>();
  const currentPage = deferred<IMarketStockPublicListResponse>();
  fetchList.mockImplementation(async (params) => {
    if (params?.cursor)
      return params.category === 'tech' ? oldPage.promise : currentPage.promise;
    return response;
  });
  const { result, rerender } = renderHook(
    ({ category }) => useMarketStockList({ category }),
    { initialProps: { category: 'tech' } },
  );
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  let oldRequest: Promise<void> | undefined;
  act(() => {
    oldRequest = result.current.loadMore();
  });
  rerender({ category: 'energy' });
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  let currentRequest: Promise<void> | undefined;
  act(() => {
    currentRequest = result.current.loadMore();
  });
  await act(async () => {
    oldPage.resolve(response);
    await oldRequest;
  });
  const loadingAfterOldCompletion = result.current.isLoadingMore;
  await act(async () => {
    currentPage.resolve(response);
    await currentRequest;
  });
  expect(loadingAfterOldCompletion).toBe(true);
  expect(result.current.isLoadingMore).toBe(false);
});
