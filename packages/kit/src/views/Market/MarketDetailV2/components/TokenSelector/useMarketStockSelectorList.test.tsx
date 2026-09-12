/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketStockPublicListResponse } from '@onekeyhq/shared/types/marketV2';

import { useMarketStockSelectorList } from './useMarketStockSelectorList';

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
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockList: jest.fn(),
      searchMarketStocks: jest.fn(),
    },
  },
}));

const fetchList = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketStockList,
);
const searchStocks = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.searchMarketStocks,
);

const createStock = (stockId: string) => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock' as const,
  currency: 'USD' as const,
});

const firstPage: IMarketStockPublicListResponse = {
  items: [createStock('AAPL')],
  total: 2,
  nextCursor: 'next',
};
const secondPage: IMarketStockPublicListResponse = {
  items: [createStock('AAPL'), createStock('MSFT')],
  total: 2,
};

beforeEach(() => {
  fetchList.mockReset();
  searchStocks.mockReset();
});

it('loads selector pages and appends unique stocks', async () => {
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? secondPage : firstPage,
  );

  const { result } = renderHook(() =>
    useMarketStockSelectorList({ query: '  ' }),
  );
  await waitFor(() => expect(result.current.items).toEqual(firstPage.items));
  expect(result.current.canLoadMore).toBe(true);

  await act(async () => result.current.loadMore());

  await waitFor(() =>
    expect(result.current.items.map((item) => item.stockId)).toEqual([
      'AAPL',
      'MSFT',
    ]),
  );
  expect(fetchList).toHaveBeenNthCalledWith(1, { limit: 20 });
  expect(fetchList).toHaveBeenNthCalledWith(2, {
    cursor: 'next',
    limit: 20,
  });
  expect(result.current.canLoadMore).toBe(false);
});

it('passes the normalized query and cursor to search pages', async () => {
  searchStocks.mockImplementation(async (params) =>
    params.cursor ? secondPage : firstPage,
  );

  const { result } = renderHook(() =>
    useMarketStockSelectorList({ query: '  aapl  ' }),
  );
  await waitFor(() => expect(result.current.items).toEqual(firstPage.items));

  await act(async () => result.current.loadMore());

  await waitFor(() => expect(result.current.items).toHaveLength(2));
  expect(searchStocks).toHaveBeenNthCalledWith(1, {
    query: 'aapl',
    limit: 20,
  });
  expect(searchStocks).toHaveBeenNthCalledWith(2, {
    query: 'aapl',
    cursor: 'next',
    limit: 20,
  });
});

it('starts only one request for concurrent end-reached events', async () => {
  let resolveNextPage: (
    response: IMarketStockPublicListResponse,
  ) => void = () => undefined;
  const nextPage = new Promise<IMarketStockPublicListResponse>((resolve) => {
    resolveNextPage = resolve;
  });
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? nextPage : firstPage,
  );

  const { result } = renderHook(() => useMarketStockSelectorList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));

  let requests: Promise<void>[] = [];
  act(() => {
    requests = [result.current.loadMore(), result.current.loadMore()];
  });
  expect(
    fetchList.mock.calls.filter(([params]) => params?.cursor),
  ).toHaveLength(1);

  await act(async () => {
    resolveNextPage(secondPage);
    await Promise.all(requests);
  });
});
