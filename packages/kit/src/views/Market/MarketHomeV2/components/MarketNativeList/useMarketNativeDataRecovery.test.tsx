/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetListData } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketPerpsTokenListData,
  IMarketStockPublicItem,
} from '@onekeyhq/shared/types/marketV2';

import { useMarketPerpsTokenList } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import {
  type IMarketWatchlistDataCache,
  useMarketWatchlistTokenList,
} from '../MarketTokenList/hooks/useMarketWatchlistTokenList';
import {
  type IMarketTopCoinsDataCache,
  useMarketTopCoins,
} from '../MarketTopCoinsList/hooks/useMarketTopCoins';

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
  useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
    !enabled || mockFocused,
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
      fetchMarketStockBatch: jest.fn(),
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
const fetchStocks = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketStockBatch,
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
function appleStock(price: string): IMarketStockPublicItem {
  return {
    stockId: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple',
    logoUrl: '',
    assetType: 'stock',
    currency: 'USD',
    price,
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
  fetchStocks.mockReset();
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
    current: undefined as IMarketTopCoinsDataCache | undefined,
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

it('requests Top Coins sub-categories through type and caches each one separately', async () => {
  const dataCacheRef = {
    current: undefined as IMarketTopCoinsDataCache | undefined,
  };
  const chains: IMarketAssetListData = {
    list: [{ ...topCoins.list[0], assetId: 'eth', symbol: 'ETH' }],
    total: 1,
  };
  fetchTopCoins.mockResolvedValue(topCoins);
  const first = renderHook(
    ({ categoryId }) => useMarketTopCoins({ categoryId, dataCacheRef }),
    { initialProps: { categoryId: 'all' } },
  );
  await waitFor(() => expect(first.result.current.data).toEqual(topCoins.list));
  expect(fetchTopCoins).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'top_coins' }),
  );

  const chainsRequest = deferred<IMarketAssetListData>();
  fetchTopCoins.mockReturnValue(chainsRequest.promise);
  first.rerender({ categoryId: 'market_l1_l2_chains' });
  await waitFor(() =>
    expect(fetchTopCoins).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'market_l1_l2_chains' }),
    ),
  );
  expect(first.result.current.data).toEqual([]);
  await act(async () => chainsRequest.resolve(chains));
  await waitFor(() => expect(first.result.current.data).toEqual(chains.list));

  fetchTopCoins.mockReturnValue(deferred<IMarketAssetListData>().promise);
  first.rerender({ categoryId: 'all' });
  expect(first.result.current.data).toEqual(topCoins.list);
  first.unmount();

  fetchTopCoins.mockRejectedValue(new Error('offline'));
  const second = renderHook(() =>
    useMarketTopCoins({ categoryId: 'market_l1_l2_chains', dataCacheRef }),
  );
  expect(second.result.current.data).toEqual(chains.list);
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  expect(second.result.current.data).toEqual(chains.list);
});

it('reports a switched Top Coins sub-category as loading until its request settles', async () => {
  const renders: { count: number; isLoading: boolean | undefined }[] = [];
  fetchTopCoins.mockResolvedValue(topCoins);
  const { result, rerender } = renderHook(
    ({ categoryId }) => {
      const state = useMarketTopCoins({ categoryId });
      renders.push({ count: state.data.length, isLoading: state.isLoading });
      return state;
    },
    { initialProps: { categoryId: 'all' } },
  );
  expect(renders[0]).toEqual({ count: 0, isLoading: true });
  await waitFor(() => expect(result.current.data).toEqual(topCoins.list));
  expect(result.current.isLoading).toBe(false);

  const chainsRequest = deferred<IMarketAssetListData>();
  fetchTopCoins.mockReturnValue(chainsRequest.promise);
  renders.length = 0;
  rerender({ categoryId: 'market_l1_l2_chains' });
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.filter((render) => render.isLoading !== true)).toEqual([]);

  // A real empty category still settles instead of loading forever.
  await act(async () => chainsRequest.resolve({ list: [], total: 0 }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([]);
});

it('settles a failed Top Coins sub-category on web instead of loading forever', async () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  try {
    fetchTopCoins.mockResolvedValue(topCoins);
    const { result, rerender } = renderHook(
      ({ categoryId }) => useMarketTopCoins({ categoryId }),
      { initialProps: { categoryId: 'all' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(topCoins.list));

    fetchTopCoins.mockRejectedValue(new Error('offline'));
    rerender({ categoryId: 'market_defi_and_infra' });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  } finally {
    jest.restoreAllMocks();
  }
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

it('waits for listing quotes as well as spot and perps during native Watchlist refresh', async () => {
  const watchlist = [{ chainId: '', contractAddress: '', stockId: 'AAPL' }];
  fetchWatchlist.mockResolvedValue({ list: [] });
  fetchPerps.mockResolvedValue({ updatedAt: 1, tokens: [] });
  fetchStocks.mockResolvedValue([appleStock('100')]);
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist }),
  );
  await waitFor(() => expect(result.current.data[0]?.price).toBe(100));
  const request = deferred<Awaited<ReturnType<typeof fetchStocks>>>();
  fetchStocks.mockReturnValue(request.promise);
  let settled = false;
  let refresh: Promise<void> | undefined;
  await act(async () => {
    refresh = result.current.refetch().then(() => {
      settled = true;
    });
  });
  expect(settled).toBe(false);
  await act(async () => {
    request.resolve([appleStock('101')]);
    await refresh;
  });
  expect(settled).toBe(true);
  expect(result.current.data[0]?.price).toBe(101);
});
