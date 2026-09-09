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
    sortBy: 'default',
    sortType: 'asc',
    locale: 'en-US',
  });
  expect(swrCacheUtils.get(swrKeys.marketHomeStocks(queryKey))).toBeUndefined();
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
