/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IMarketStockPublicListResponse } from '@onekeyhq/shared/types/marketV2';

import { useMarketStockList } from './useMarketStockList';

let mockIsInternetReachable = true;
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(null),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: mockIsInternetReachable }),
}));
let mockIsFocused = true;
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
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
    sortBy: 'default',
    sortType: 'asc',
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
  mockIsInternetReachable = true;
  mockIsFocused = true;
  platformEnv.isNative = true;
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
  expect(result.current.isRevalidatingFirstPage).toBe(true);
  await act(async () => result.current.loadMore());
  expect(fetchList.mock.calls.every(([params]) => !params?.cursor)).toBe(true);
  await waitFor(() => expect(fetchList).toHaveBeenCalled());
  await act(async () => pending.resolve(response));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  expect(result.current.isRevalidatingFirstPage).toBe(false);
});

it('does not declare cached categories complete until their remote page arrives', async () => {
  seed('tech');
  seed('energy');
  const pending = deferred<IMarketStockPublicListResponse>();
  fetchList.mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(
    ({ category }) => useMarketStockList({ category }),
    { initialProps: { category: 'tech' } },
  );
  rerender({ category: 'energy' });
  expect(result.current.items).toEqual(response.items);
  expect(result.current.isRevalidatingFirstPage).toBe(true);
  expect(result.current.canLoadMore).toBe(false);
  await waitFor(() =>
    expect(fetchList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'energy' }),
    ),
  );
  await act(async () =>
    pending.resolve({ ...response, nextCursor: undefined }),
  );
  await waitFor(() =>
    expect(result.current.isRevalidatingFirstPage).toBe(false),
  );
  expect(result.current.canLoadMore).toBe(false);
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
    sortBy: 'default',
    sortType: 'asc',
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

it('preserves loaded pages when refreshing the first page', async () => {
  let isRefreshing = false;
  const secondPageItem = {
    ...response.items[0],
    stockId: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
  };
  fetchList.mockImplementation(async (params) => {
    if (params?.cursor) {
      return {
        items: [secondPageItem],
        total: 2,
      };
    }
    return isRefreshing
      ? {
          ...response,
          items: [{ ...response.items[0], price: '201' }],
        }
      : response;
  });
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());
  expect(result.current.items.map((item) => item.stockId)).toEqual([
    'AAPL',
    'MSFT',
  ]);

  isRefreshing = true;
  await act(async () => result.current.refresh());

  expect(result.current.items.map((item) => item.stockId)).toEqual([
    'AAPL',
    'MSFT',
  ]);
  expect(result.current.items[0]?.price).toBe('201');
  expect(result.current.canLoadMore).toBe(false);
});

it('makes new stocks reachable when a fully loaded list grows', async () => {
  let isRefreshing = false;
  const secondPageItem = {
    ...response.items[0],
    stockId: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
  };
  fetchList.mockImplementation(async (params) => {
    if (params?.cursor === 'next') {
      return {
        items: [secondPageItem],
        total: isRefreshing ? 3 : 2,
        nextCursor: isRefreshing ? 'third' : undefined,
      };
    }
    if (params?.cursor === 'third') {
      return {
        items: [
          {
            ...response.items[0],
            stockId: 'NVDA',
            symbol: 'NVDA',
            name: 'NVIDIA',
          },
        ],
        total: 3,
      };
    }
    return { ...response, total: isRefreshing ? 3 : 2 };
  });
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());
  expect(result.current.canLoadMore).toBe(false);

  isRefreshing = true;
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());

  expect(
    fetchList.mock.calls.some(([params]) => params?.cursor === 'third'),
  ).toBe(true);
  expect(result.current.items.map((item) => item.stockId)).toEqual([
    'AAPL',
    'MSFT',
    'NVDA',
  ]);
});

it('keeps stocks that move from the first page to a refreshed later page', async () => {
  let isRefreshing = false;
  const secondPageItem = {
    ...response.items[0],
    stockId: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
  };
  fetchList.mockImplementation(async (params) => {
    if (params?.cursor) {
      return {
        items: [isRefreshing ? response.items[0] : secondPageItem],
        total: 2,
      };
    }
    return {
      ...response,
      items: isRefreshing ? [secondPageItem] : response.items,
    };
  });
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());

  isRefreshing = true;
  await act(async () => result.current.refresh());

  expect(result.current.items.map((item) => item.stockId)).toEqual([
    'MSFT',
    'AAPL',
  ]);
});

it('drops obsolete loaded rows when a refresh has no next page', async () => {
  const secondPageItem = {
    ...response.items[0],
    stockId: 'MSFT',
    symbol: 'MSFT',
    name: 'Microsoft',
  };
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? { items: [secondPageItem], total: 2 } : response,
  );
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());

  fetchList.mockResolvedValue({
    items: [{ ...response.items[0], price: '202' }],
    total: 1,
  });
  await act(async () => result.current.refresh());

  expect(result.current.items.map((item) => item.stockId)).toEqual(['AAPL']);
  expect(result.current.items[0]?.price).toBe('202');
  expect(result.current.canLoadMore).toBe(false);
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

it.each([true, false])(
  'discards a superseded cursor response (native=%s)',
  async (isNative) => {
    platformEnv.isNative = isNative;
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
  },
);

it('queues end-reached during refresh without reporting the end of the list', async () => {
  fetchList.mockResolvedValue(response);
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  const pending = deferred<IMarketStockPublicListResponse>();
  fetchList.mockReturnValueOnce(pending.promise).mockResolvedValue({
    items: [{ ...response.items[0], stockId: 'MSFT' }],
    total: 2,
  });
  let refreshing: Promise<void> | undefined;
  act(() => {
    refreshing = result.current.refresh();
  });
  await waitFor(() => expect(result.current.isRefreshing).toBe(true));
  expect(result.current.canLoadMore).toBe(true);
  await act(async () => result.current.loadMore());
  await act(async () => {
    pending.resolve(response);
    await refreshing;
  });
  await waitFor(() => expect(result.current.items).toHaveLength(2));
  expect(result.current.items[1].stockId).toBe('MSFT');
});

it('never reports the end of the list while committing refreshed rows', async () => {
  fetchList.mockResolvedValue(response);
  const states: boolean[] = [];
  const { result } = renderHook(() => {
    const value = useMarketStockList({});
    states.push(value.canLoadMore);
    return value;
  });
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  states.length = 0;
  fetchList.mockResolvedValue({
    ...response,
    items: [{ ...response.items[0], price: '201' }],
  });
  await act(async () => result.current.refresh());
  expect(result.current.items[0].price).toBe('201');
  expect(states.length).toBeGreaterThan(0);
  expect(states.every(Boolean)).toBe(true);
});

it('coalesces concurrent refreshes and reuses only fresh successful results', async () => {
  platformEnv.isNative = false;
  fetchList.mockResolvedValue(response);
  const { result, rerender } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  fetchList.mockClear();
  mockIsFocused = false;
  rerender();
  mockIsFocused = true;
  rerender();
  await act(async () => undefined);
  expect(fetchList).not.toHaveBeenCalled();
  const pending = deferred<IMarketStockPublicListResponse>();
  fetchList.mockReturnValue(pending.promise);
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  act(() => {
    first = result.current.refresh();
    second = result.current.refresh();
  });
  await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(1));
  await act(async () => {
    pending.resolve(response);
    await Promise.all([first, second]);
  });
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 31_000);
  try {
    mockIsFocused = false;
    rerender();
    mockIsFocused = true;
    rerender();
    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(2));
  } finally {
    clock.mockRestore();
  }
});

it('preserves all rows and exposes retry after a later refresh page fails', async () => {
  const secondPage = {
    items: [{ ...response.items[0], stockId: 'MSFT' }],
    total: 2,
  };
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? secondPage : response,
  );
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  await act(async () => result.current.loadMore());
  const previousItems = result.current.items;
  fetchList
    .mockResolvedValueOnce({
      ...response,
      items: [{ ...response.items[0], price: '201' }],
    })
    .mockRejectedValueOnce(new Error('offline'));
  await act(async () => result.current.refresh());
  expect(result.current.items).toBe(previousItems);
  expect(result.current.isRefreshError).toBe(true);
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? secondPage : response,
  );
  await act(async () => result.current.refresh());
  expect(result.current.isRefreshError).toBe(false);
  expect(result.current.items).toHaveLength(2);
});

it('does not replay deep persisted pagination on cold start', async () => {
  const queryKey = JSON.stringify({
    sortBy: 'default',
    sortType: 'asc',
    locale: 'en-US',
  });
  swrCacheUtils.set(swrKeys.marketHomeStocks(queryKey), {
    queryKey,
    response,
    firstPage: response,
    loadedPageCount: 15,
  });
  fetchList.mockResolvedValue(response);
  const { result } = renderHook(() => useMarketStockList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));
  expect(fetchList).toHaveBeenCalledTimes(1);
});

it.each([
  { isNative: false, trigger: 'focus' },
  { isNative: true, trigger: 'focus' },
  { isNative: false, trigger: 'reconnect' },
  { isNative: true, trigger: 'reconnect' },
])(
  'refreshes deep lists atomically on $trigger (native=$isNative)',
  async ({ isNative, trigger }) => {
    platformEnv.isNative = isNative;
    let price = '200';
    const lastPage = deferred<IMarketStockPublicListResponse>();
    let holdLastPage = false;
    fetchList.mockImplementation(async (params) => {
      const page = Number(params?.cursor ?? 0);
      if (holdLastPage && page === 3) return lastPage.promise;
      return {
        items: [{ ...response.items[0], stockId: String(page), price }],
        total: 10,
        nextCursor: String(page + 1),
      };
    });
    const { result, rerender } = renderHook(() => useMarketStockList({}));
    await waitFor(() => expect(result.current.canLoadMore).toBe(true));
    for (let index = 0; index < 3; index += 1) {
      await act(async () => result.current.loadMore());
    }
    const items = result.current.items;
    fetchList.mockClear();
    price = '201';
    holdLastPage = true;
    if (trigger === 'focus') mockIsFocused = false;
    else mockIsInternetReachable = false;
    rerender();
    if (trigger === 'focus') mockIsFocused = true;
    else mockIsInternetReachable = true;
    rerender();
    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(4));
    expect(result.current.items).toBe(items);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    await act(async () =>
      lastPage.resolve({
        items: [{ ...response.items[0], stockId: '3', price }],
        total: 10,
        nextCursor: '4',
      }),
    );
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items.every((item) => item.price === '201')).toBe(
      true,
    );
    expect(result.current.canLoadMore).toBe(true);
    await act(async () => result.current.loadMore());
    expect(fetchList).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: '4' }),
    );
    expect(result.current.items).toHaveLength(5);
  },
);

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
