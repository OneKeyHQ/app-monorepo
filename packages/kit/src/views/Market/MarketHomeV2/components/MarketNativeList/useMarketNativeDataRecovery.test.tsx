/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketAssetListData } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketPerpsTokenListData,
} from '@onekeyhq/shared/types/marketV2';

import { useMarketPerpsTokenList } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import {
  type IMarketWatchlistDataCache,
  useMarketWatchlistTokenList,
} from '../MarketTokenList/hooks/useMarketWatchlistTokenList';
import { useMarketTopCoins } from '../MarketTopCoinsList/hooks/useMarketTopCoins';

const mockNetworks: IMarketBasicConfigNetwork[] = [];
let mockFocused = true;
let mockReachable = true;
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  useCarouselIndex: () => 0,
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(null),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: mockReachable }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworks }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('../MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: { fetchMarketAssetList: jest.fn() },
    serviceMarketV2: {
      fetchMarketPerpsTokenList: jest.fn(),
      fetchMarketTokenListBatch: jest.fn(),
    },
    serviceHyperliquid: { getTokenSearchAliases: jest.fn(async () => ({})) },
  },
}));

// The background methods are replaced with jest.fn above.
const fetchTopCoins = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarket.fetchMarketAssetList,
);
const fetchPerps = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList,
);
const fetchWatchlist = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch,
);
const topCoins: IMarketAssetListData = {
  list: [
    {
      assetId: 'btc',
      symbol: 'BTC',
      logoUrl: '',
      price: '100',
      priceChange24hPercent: '1',
      priceChange7dPercent: '2',
      marketCap: '1000',
      volume24h: '100',
      sparkline24h: [],
    },
  ],
  total: 1,
};
function perps(name: string): IMarketPerpsTokenListData {
  return {
    updatedAt: 1,
    tokens: [
      {
        name,
        displayName: name,
        maxLeverage: 10,
        tokenImageUrl: '',
        markPrice: '100',
        prevDayPrice: '99',
        change24hPercent: 1,
        volume24h: '1000',
        openInterest: '100',
        fundingRate: '0.001',
      },
    ],
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  jest.useFakeTimers();
  fetchTopCoins.mockReset();
  fetchPerps.mockReset();
  fetchWatchlist.mockReset();
  mockFocused = true;
  mockReachable = true;
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    value: (callback: () => void) => setTimeout(callback, 0),
  });
  Object.defineProperty(globalThis, 'cancelIdleCallback', {
    configurable: true,
    value: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('keeps Top Coins rows during a failed refresh, then recovers through Retry', async () => {
  fetchTopCoins.mockResolvedValue(topCoins);
  const { result } = renderHook(() => useMarketTopCoins());
  await waitFor(() => expect(result.current.data).toEqual(topCoins.list));
  fetchTopCoins.mockRejectedValue(new Error('offline'));
  await act(async () => result.current.refresh());
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.data).toEqual(topCoins.list);
  fetchTopCoins.mockResolvedValue({ list: [], total: 0 });
  await act(async () => result.current.refresh());
  expect(result.current.isError).toBe(false);
  expect(result.current.data).toEqual([]);
});

it('distinguishes an initial Top Coins request failure from a real empty result', async () => {
  fetchTopCoins.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useMarketTopCoins());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.isLoading).toBe(false);
  fetchTopCoins.mockResolvedValue({ list: [], total: 0 });
  await act(async () => result.current.refresh());
  expect(result.current.isError).toBe(false);
  expect(result.current.data).toEqual([]);
});

it('keeps Perps rows on refresh failure and revalidates on network recovery', async () => {
  fetchPerps.mockResolvedValue(perps('xyz:AAPL'));
  const { result, rerender } = renderHook(() =>
    useMarketPerpsTokenList({ selectedCategoryId: 'stocks' }),
  );
  await waitFor(() => expect(result.current.tokens[0]?.name).toBe('xyz:AAPL'));
  mockReachable = false;
  rerender();
  fetchPerps.mockRejectedValue(new Error('offline'));
  await act(async () => result.current.refresh());
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.tokens[0]?.name).toBe('xyz:AAPL');
  fetchPerps.mockResolvedValue(perps('xyz:MSFT'));
  mockReachable = true;
  rerender();
  await waitFor(() => expect(result.current.tokens[0]?.name).toBe('xyz:MSFT'));
  expect(result.current.isError).toBe(false);
});

it('does not reuse previous-category Perps rows after the new category fails', async () => {
  fetchPerps.mockResolvedValue(perps('xyz:AAPL'));
  const { result, rerender } = renderHook(
    ({ category }) => useMarketPerpsTokenList({ selectedCategoryId: category }),
    { initialProps: { category: 'stocks' } },
  );
  await waitFor(() => expect(result.current.tokens).toHaveLength(1));
  fetchPerps.mockRejectedValue(new Error('offline'));
  rerender({ category: 'metals' });
  expect(result.current.tokens).toEqual([]);
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.tokens).toEqual([]);
});

it('accepts current-category data completed on blur and rejects a late old category', async () => {
  const oldRequest = deferred<IMarketPerpsTokenListData>();
  const currentRequest = deferred<IMarketPerpsTokenListData>();
  fetchPerps.mockImplementation((params) =>
    params?.category === 'stocks' ? oldRequest.promise : currentRequest.promise,
  );
  const { result, rerender } = renderHook(
    ({ category }) => useMarketPerpsTokenList({ selectedCategoryId: category }),
    { initialProps: { category: 'stocks' } },
  );
  await waitFor(() =>
    expect(fetchPerps).toHaveBeenCalledWith({ category: 'stocks' }),
  );
  rerender({ category: 'metals' });
  await waitFor(() =>
    expect(fetchPerps).toHaveBeenCalledWith({ category: 'metals' }),
  );
  mockFocused = false;
  rerender({ category: 'metals' });
  await act(async () => currentRequest.resolve(perps('xyz:GOLD')));
  expect(result.current.tokens[0]?.name).toBe('xyz:GOLD');
  await act(async () => oldRequest.resolve(perps('xyz:AAPL')));
  expect(result.current.tokens[0]?.name).toBe('xyz:GOLD');
  mockFocused = true;
  rerender({ category: 'metals' });
  expect(result.current.tokens[0]?.name).toBe('xyz:GOLD');
});

it('shows a Watchlist request error without leaving initial loading active', async () => {
  const watchlist = [
    { chainId: 'evm--1', contractAddress: '0x123', sortIndex: 0 },
  ];
  fetchWatchlist.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist }),
  );
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.data).toEqual([]);
  fetchWatchlist.mockResolvedValue({ list: [] });
  await act(async () => result.current.refetch());
  expect(result.current.isError).toBe(false);
});

it('refreshes both Watchlist sources and keeps existing Perps rows when offline', async () => {
  const watchlist = [
    { chainId: 'evm--1', contractAddress: '0x123', sortIndex: 0 },
    { chainId: '', contractAddress: '', sortIndex: 1, perpsCoin: 'xyz:AAPL' },
  ];
  fetchWatchlist.mockResolvedValue({ list: [] });
  fetchPerps.mockResolvedValue(perps('xyz:AAPL'));
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist }),
  );
  await waitFor(() =>
    expect(result.current.data[0]?.perpsCoin).toBe('xyz:AAPL'),
  );
  const previousSpotRequests = fetchWatchlist.mock.calls.length;
  const previousPerpsRequests = fetchPerps.mock.calls.length;
  fetchWatchlist.mockRejectedValue(new Error('offline'));
  fetchPerps.mockRejectedValue(new Error('offline'));
  await act(async () => result.current.refetch());
  expect(fetchWatchlist.mock.calls.length).toBeGreaterThan(
    previousSpotRequests,
  );
  expect(fetchPerps.mock.calls.length).toBeGreaterThan(previousPerpsRequests);
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.data[0]?.perpsCoin).toBe('xyz:AAPL');
});

it('restores Watchlist data after unmounting offline without reviving removed favorites or cleared results', async () => {
  const watchlist = [
    {
      chainId: 'evm--1',
      contractAddress: '0x1111111111111111111111111111111111111111',
      sortIndex: 0,
    },
    {
      chainId: 'evm--1',
      contractAddress: '0x2222222222222222222222222222222222222222',
      sortIndex: 1,
    },
    { chainId: '', contractAddress: '', sortIndex: 2, perpsCoin: 'xyz:AAPL' },
  ];
  const dataCacheRef = {
    current: undefined as IMarketWatchlistDataCache | undefined,
  };
  fetchWatchlist.mockResolvedValue({
    list: [
      {
        address: '0x1111111111111111111111111111111111111111',
        name: 'First',
        symbol: 'AAA',
        decimals: 18,
        networkId: 'evm--1',
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        name: 'Second',
        symbol: 'BBB',
        decimals: 18,
        networkId: 'evm--1',
      },
    ],
  });
  fetchPerps.mockResolvedValue(perps('xyz:AAPL'));
  const first = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, dataCacheRef }),
  );
  await waitFor(() =>
    expect(first.result.current.data.map((token) => token.symbol)).toEqual([
      'AAA',
      'BBB',
      'xyz:AAPL',
    ]),
  );
  first.unmount();
  fetchWatchlist.mockRejectedValue(new Error('offline'));
  fetchPerps.mockRejectedValue(new Error('offline'));
  const second = renderHook(
    ({ items }) =>
      useMarketWatchlistTokenList({ watchlist: items, dataCacheRef }),
    { initialProps: { items: watchlist } },
  );
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  expect(second.result.current.data.map((token) => token.symbol)).toEqual([
    'AAA',
    'BBB',
    'xyz:AAPL',
  ]);
  const remainingWatchlist = [watchlist[1]];
  second.rerender({ items: remainingWatchlist });
  await waitFor(() =>
    expect(second.result.current.data.map((token) => token.symbol)).toEqual([
      'BBB',
    ]),
  );
  fetchWatchlist.mockResolvedValue({ list: [] });
  await act(async () => second.result.current.refetch());
  expect(second.result.current.data).toEqual([]);
  second.unmount();
  fetchWatchlist.mockRejectedValue(new Error('offline'));
  const third = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist: remainingWatchlist,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(third.result.current.isError).toBe(true));
  expect(third.result.current.data).toEqual([]);
});

it('restores Top Coins from its page owner after unmounting offline, including an empty replacement', async () => {
  const dataCacheRef = {
    current: undefined as IMarketAssetListData['list'] | undefined,
  };
  fetchTopCoins.mockResolvedValue(topCoins);
  const first = renderHook(() => useMarketTopCoins({ dataCacheRef }));
  await waitFor(() => expect(first.result.current.data).toEqual(topCoins.list));
  first.unmount();
  fetchTopCoins.mockRejectedValue(new Error('offline'));
  const second = renderHook(() => useMarketTopCoins({ dataCacheRef }));
  expect(second.result.current.data).toEqual(topCoins.list);
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  expect(second.result.current.data).toEqual(topCoins.list);
  fetchTopCoins.mockResolvedValue({ list: [], total: 0 });
  await act(async () => second.result.current.refresh());
  second.unmount();
  fetchTopCoins.mockRejectedValue(new Error('offline'));
  const third = renderHook(() => useMarketTopCoins({ dataCacheRef }));
  await waitFor(() => expect(third.result.current.isError).toBe(true));
  expect(third.result.current.data).toEqual([]);
});

it('restores Perps from its page owner without leaking another category or reviving cleared rows', async () => {
  const dataCacheRef = {
    current: undefined as
      | {
          categoryId: string;
          tokens: ReturnType<typeof useMarketPerpsTokenList>['tokens'];
        }
      | undefined,
  };
  fetchPerps.mockResolvedValue(perps('xyz:AAPL'));
  const first = renderHook(() =>
    useMarketPerpsTokenList({ selectedCategoryId: 'stocks', dataCacheRef }),
  );
  await waitFor(() =>
    expect(first.result.current.tokens[0]?.name).toBe('xyz:AAPL'),
  );
  first.unmount();
  fetchPerps.mockRejectedValue(new Error('offline'));
  const second = renderHook(
    ({ category }) =>
      useMarketPerpsTokenList({ selectedCategoryId: category, dataCacheRef }),
    { initialProps: { category: 'stocks' } },
  );
  expect(second.result.current.tokens[0]?.name).toBe('xyz:AAPL');
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  expect(second.result.current.tokens[0]?.name).toBe('xyz:AAPL');
  second.rerender({ category: 'metals' });
  expect(second.result.current.tokens).toEqual([]);
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  fetchPerps.mockResolvedValue({ updatedAt: 2, tokens: [] });
  await act(async () => second.result.current.refresh());
  second.unmount();
  fetchPerps.mockRejectedValue(new Error('offline'));
  const third = renderHook(() =>
    useMarketPerpsTokenList({ selectedCategoryId: 'metals', dataCacheRef }),
  );
  await waitFor(() => expect(third.result.current.isError).toBe(true));
  expect(third.result.current.tokens).toEqual([]);
});
