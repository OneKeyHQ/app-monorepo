/** @jest-environment jsdom */
import type { RefObject } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketListingWatchlistQuote,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  type IMarketWatchlistDataCache,
  useMarketWatchlistTokenList,
} from './useMarketWatchlistTokenList';

const mockQuote = jest.fn<
  Promise<IMarketListingWatchlistQuote | undefined>,
  unknown[]
>();
const mockStockBatch = jest.fn<
  Promise<IMarketStockPublicItem[]>,
  [{ stockIds: string[] }]
>();
const mockBatch = jest.fn<Promise<{ list: unknown[] }>, unknown[]>(
  async () => ({
    list: [],
  }),
);
const mockNetworks: [] = [];
jest.mock('@onekeyhq/components', () => ({ useCarouselIndex: () => 0 }));
jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworks }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketListingWatchlistQuote: (...args: unknown[]) =>
        mockQuote(...args),
      fetchMarketStockBatch: (params: { stockIds: string[] }) =>
        mockStockBatch(params),
      fetchMarketTokenListBatch: (...args: unknown[]) => mockBatch(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>();
      const [isLoading, setLoading] = React.useState(true);
      const methodRef = React.useRef(method);
      methodRef.current = method;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- dynamic deps, same contract as usePromiseResult
      React.useEffect(() => {
        let active = true;
        // Match usePromiseResult: a new dependency generation marks loading
        // before the request resolves. The flag stays false on the render
        // that changed the deps.
        setLoading(true);
        void methodRef.current().then((value) => {
          if (active) {
            setResult(value);
            setLoading(false);
          }
        });
        return () => {
          active = false;
        };
        // The mock follows the dynamic dependency contract of usePromiseResult.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return { result, isLoading, run: () => methodRef.current() };
    },
  };
});
const stockItem = (
  stockId: string,
  overrides: Partial<IMarketStockPublicItem> = {},
): IMarketStockPublicItem => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
  ...overrides,
});
beforeEach(() => {
  jest.clearAllMocks();
  mockStockBatch.mockResolvedValue([]);
});
it('holds the first paint until spot and listing quotes have both settled', async () => {
  let resolveSpot: (value: { list: unknown[] }) => void = () => {};
  let resolveQuote: (value: IMarketListingWatchlistQuote) => void = () => {};
  mockBatch.mockReturnValue(
    new Promise((resolve) => {
      resolveSpot = resolve;
    }),
  );
  mockQuote.mockReturnValue(
    new Promise((resolve) => {
      resolveQuote = resolve;
    }),
  );
  const watchlist = [
    { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 0 },
    { chainId: 'evm--1', contractAddress: '0xaave', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(mockBatch).toHaveBeenCalled());
  await waitFor(() => expect(mockQuote).toHaveBeenCalled());

  resolveSpot({
    list: [
      {
        address: '0xaave',
        name: 'Aave',
        symbol: 'AAVE',
        decimals: 18,
        networkId: 'evm--1',
      },
    ],
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.data).toEqual([]);
  expect(result.current.isLoading).toBe(true);

  resolveQuote({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '1',
    priceChange24hPercent: '1',
  });
  await waitFor(() =>
    expect(result.current.data.map((item) => item.symbol)).toEqual([
      'BTC',
      'AAVE',
    ]),
  );
});
it('keeps holding after an empty watchlist hydrates', async () => {
  let resolveSpot: (value: { list: unknown[] }) => void = () => {};
  let resolveQuote: (value: IMarketListingWatchlistQuote) => void = () => {};
  const { result, rerender } = renderHook(
    ({ watchlist }: { watchlist: IMarketWatchListItemV2[] }) =>
      useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
    { initialProps: { watchlist: [] as IMarketWatchListItemV2[] } },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([]);

  mockBatch.mockReturnValue(
    new Promise((resolve) => {
      resolveSpot = resolve;
    }),
  );
  mockQuote.mockReturnValue(
    new Promise((resolve) => {
      resolveQuote = resolve;
    }),
  );
  rerender({
    watchlist: [
      { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 0 },
      { chainId: 'evm--1', contractAddress: '0xaave', sortIndex: 1 },
    ],
  });
  expect(result.current.data).toEqual([]);
  expect(result.current.isLoading).toBe(true);

  await waitFor(() => expect(mockBatch).toHaveBeenCalled());
  resolveSpot({
    list: [
      {
        address: '0xaave',
        name: 'Aave',
        symbol: 'AAVE',
        decimals: 18,
        networkId: 'evm--1',
      },
    ],
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.data).toEqual([]);

  resolveQuote({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '1',
    priceChange24hPercent: '1',
  });
  await waitFor(() =>
    expect(result.current.data.map((item) => item.symbol)).toEqual([
      'BTC',
      'AAVE',
    ]),
  );
});
it('ignores cache written during the first load', async () => {
  let resolveSpot: (value: { list: unknown[] }) => void = () => {};
  let resolveQuote: (value: IMarketListingWatchlistQuote) => void = () => {};
  mockBatch.mockReturnValue(
    new Promise((resolve) => {
      resolveSpot = resolve;
    }),
  );
  mockQuote.mockReturnValue(
    new Promise((resolve) => {
      resolveQuote = resolve;
    }),
  );
  const dataCacheRef: RefObject<IMarketWatchlistDataCache | undefined> = {
    current: undefined,
  };
  const watchlist = [
    { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 0 },
    { chainId: 'evm--1', contractAddress: '0xaave', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(mockBatch).toHaveBeenCalled());

  resolveSpot({
    list: [
      {
        address: '0xaave',
        name: 'Aave',
        symbol: 'AAVE',
        decimals: 18,
        networkId: 'evm--1',
      },
    ],
  });
  await waitFor(() =>
    expect(dataCacheRef.current?.spot?.list?.length).toBeGreaterThan(0),
  );
  expect(result.current.data).toEqual([]);

  resolveQuote({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '1',
    priceChange24hPercent: '1',
  });
  await waitFor(() =>
    expect(result.current.data.map((item) => item.symbol)).toEqual([
      'BTC',
      'AAVE',
    ]),
  );
});
it('loads assets by ID and stocks through the batch API without touching the chain token batch', async () => {
  mockQuote.mockResolvedValue({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '123',
    priceChange24hPercent: '2',
  });
  mockStockBatch.mockResolvedValue([
    stockItem('AAPL', { name: 'Apple', price: '321', volume24h: '9' }),
  ]);
  const watchlist = [
    { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 2 },
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() =>
    expect(result.current.data.map((item) => item.symbol)).toEqual([
      'AAPL',
      'BTC',
    ]),
  );
  expect(result.current.data.map((item) => item.id)).toEqual([
    'stock:AAPL',
    'asset:bitcoin',
  ]);
  expect(result.current.data[0]).toMatchObject({
    name: 'Apple',
    price: 321,
    turnover: 9,
  });
  expect(mockQuote).toHaveBeenCalledTimes(1);
  expect(mockQuote).toHaveBeenCalledWith(
    expect.objectContaining({ assetId: 'bitcoin' }),
  );
  expect(mockBatch).not.toHaveBeenCalled();
});
it('treats empty stock price changes as missing without hiding zero values', async () => {
  mockStockBatch.mockResolvedValue([
    stockItem('ICBC', {
      name: 'ICBC Quote',
      priceChange24hPercent: '',
    }),
    stockItem('AAPL', {
      name: 'Apple Quote',
      priceChange24hPercent: '0',
    }),
  ]);
  const watchlist = [
    { stockId: 'ICBC', chainId: '', contractAddress: '', sortIndex: 0 },
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() =>
    expect(result.current.data.map((item) => item.name)).toEqual([
      'ICBC Quote',
      'Apple Quote',
    ]),
  );
  expect(result.current.data[0]?.priceChangeRaw).toBe('-');
  expect(result.current.data[0]?.change24h).toBeNaN();
  expect(result.current.data[1]).toMatchObject({
    priceChangeRaw: '0',
    change24h: 0,
  });
});
it('requests every favorited stock in one batch call', async () => {
  const watchlist = [
    { stockId: 'TSLA', chainId: '', contractAddress: '', sortIndex: 0 },
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 1 },
  ];
  renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(mockStockBatch).toHaveBeenCalledTimes(1));
  expect(mockStockBatch).toHaveBeenCalledWith({ stockIds: ['TSLA', 'AAPL'] });
});
it('skips the stock batch call when no stock is favorited', async () => {
  mockQuote.mockResolvedValue({ name: 'Bitcoin', symbol: 'BTC', logoUrl: '' });
  const watchlist = [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(mockStockBatch).not.toHaveBeenCalled();
});
it('retains a stock the batch omits so it can still be removed', async () => {
  mockStockBatch.mockResolvedValue([stockItem('AAPL', { name: 'Apple' })]);
  const watchlist = [
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
    { stockId: 'DELISTED', chainId: '', contractAddress: '', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() =>
    expect(result.current.data.map((item) => item.name)).toEqual([
      'Apple',
      'DELISTED',
    ]),
  );
  expect(result.current.data[1]).toMatchObject({
    id: 'stock:DELISTED',
    stockId: 'DELISTED',
    priceChangeRaw: '-',
  });
});
it('retains stocks when the batch call fails', async () => {
  mockStockBatch.mockRejectedValue(new Error('unavailable'));
  const watchlist = [{ stockId: 'AAPL', chainId: '', contractAddress: '' }];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([
    expect.objectContaining({
      id: 'stock:AAPL',
      stockId: 'AAPL',
      priceChangeRaw: '-',
    }),
  ]);
});
it('retains an unavailable asset so it can still be removed', async () => {
  mockQuote.mockRejectedValue(new Error('delisted'));
  const watchlist = [{ assetId: 'delisted', chainId: '', contractAddress: '' }];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([
    expect.objectContaining({ id: 'asset:delisted', priceChangeRaw: '-' }),
  ]);
});
it('carries stock variants through for the company-name hover reveal', async () => {
  const variants = [
    { tokenId: 'sol-aaplx', issuer: 'xStocks', logoUrl: '' },
    { tokenId: 'eth-aapl', issuer: 'Ondo', logoUrl: '' },
  ];
  mockStockBatch.mockResolvedValue([
    stockItem('AAPL', { name: 'Apple Inc.', variants }),
  ]);
  mockQuote.mockResolvedValue({ name: 'Bitcoin', symbol: 'BTC', logoUrl: '' });
  const watchlist = [
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
    { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() =>
    expect(result.current.data.map((item) => item.name)).toEqual([
      'Apple Inc.',
      'Bitcoin',
    ]),
  );
  expect(result.current.data[0].stockVariants).toEqual(variants);
  expect(result.current.data[1].stockVariants).toBeUndefined();
});
it('withholds listing rows until the first quote batch resolves', async () => {
  let resolveBatch: (items: IMarketStockPublicItem[]) => void = () => {};
  mockStockBatch.mockReturnValue(
    new Promise<IMarketStockPublicItem[]>((resolve) => {
      resolveBatch = resolve;
    }),
  );
  const watchlist = [
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(mockStockBatch).toHaveBeenCalledTimes(1));

  // A row built from the watchlist record alone would show NaN metrics, and it
  // would also hide the list's "loading with no rows" fallback.
  expect(result.current.data).toEqual([]);
  expect(result.current.isLoading).toBe(true);

  resolveBatch([stockItem('AAPL', { name: 'Apple', price: '321' })]);
  await waitFor(() =>
    expect(result.current.data).toEqual([
      expect.objectContaining({ id: 'stock:AAPL', name: 'Apple', price: 321 }),
    ]),
  );
});
it('holds the first paint when only one watchlist source is cached', async () => {
  let resolveQuote: (value: IMarketListingWatchlistQuote) => void = () => {};
  mockQuote.mockReturnValue(
    new Promise((resolve) => {
      resolveQuote = resolve;
    }),
  );
  mockBatch.mockReturnValue(new Promise(() => {}));
  const dataCacheRef: RefObject<IMarketWatchlistDataCache | undefined> = {
    current: {
      spot: {
        list: [
          {
            address: '0xaave',
            name: 'Aave',
            symbol: 'AAVE',
            decimals: 18,
            networkId: 'evm--1',
          },
        ],
      },
    },
  };
  const watchlist = [
    { assetId: 'bitcoin', chainId: '', contractAddress: '', sortIndex: 0 },
    { chainId: 'evm--1', contractAddress: '0xaave', sortIndex: 1 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(mockQuote).toHaveBeenCalled());
  expect(result.current.data).toEqual([]);
  expect(result.current.isLoading).toBe(true);

  resolveQuote({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '1',
    priceChange24hPercent: '1',
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.data).toEqual([]);
  expect(result.current.isLoading).toBe(true);
});
it('reuses the cached quote batch so a remount renders rows immediately', async () => {
  mockStockBatch.mockResolvedValue([
    stockItem('AAPL', { name: 'Apple', price: '321' }),
  ]);
  const dataCacheRef: RefObject<IMarketWatchlistDataCache | undefined> = {
    current: undefined,
  };
  const watchlist = [
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
  ];
  const first = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(first.result.current.data).toHaveLength(1));
  first.unmount();

  // The token selector unmounts this list on every tab switch, so the refetch
  // must not blank the rows that were already on screen.
  mockStockBatch.mockReturnValue(
    new Promise<IMarketStockPublicItem[]>(() => {}),
  );
  const second = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  expect(second.result.current.data).toEqual([
    expect.objectContaining({ id: 'stock:AAPL', name: 'Apple', price: 321 }),
  ]);
});
it('withholds a newly favorited listing while the previous batch is reused', async () => {
  mockStockBatch.mockResolvedValue([
    stockItem('AAPL', { name: 'Apple', price: '321' }),
  ]);
  const { result, rerender } = renderHook(
    ({ watchlist }: { watchlist: IMarketWatchListItemV2[] }) =>
      useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
    {
      initialProps: {
        watchlist: [
          { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
        ],
      },
    },
  );
  await waitFor(() => expect(result.current.data).toHaveLength(1));

  // usePromiseResult keeps the resolved batch while the new request is in
  // flight, and that batch has no entry for TSLA. Rendering TSLA against it
  // would show NaN metrics, but AAPL is covered and must stay on screen.
  mockStockBatch.mockReturnValue(
    new Promise<IMarketStockPublicItem[]>(() => {}),
  );
  rerender({
    watchlist: [
      { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
      { stockId: 'TSLA', chainId: '', contractAddress: '', sortIndex: 1 },
    ],
  });

  expect(result.current.data).toEqual([
    expect.objectContaining({ id: 'stock:AAPL', name: 'Apple', price: 321 }),
  ]);
});
it('keeps cached rows and holds back only the uncovered listing', async () => {
  mockStockBatch.mockResolvedValue([
    stockItem('AAPL', { name: 'Apple', price: '321' }),
  ]);
  const dataCacheRef: RefObject<IMarketWatchlistDataCache | undefined> = {
    current: undefined,
  };
  const first = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist: [
        { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
      ],
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(first.result.current.data).toHaveLength(1));
  first.unmount();

  // TSLA has no cached quote, so rendering it would show NaN metrics, while
  // AAPL is still covered by the cache and renders straight away.
  mockStockBatch.mockReturnValue(
    new Promise<IMarketStockPublicItem[]>(() => {}),
  );
  const second = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist: [
        { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
        { stockId: 'TSLA', chainId: '', contractAddress: '', sortIndex: 1 },
      ],
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  expect(second.result.current.data).toEqual([
    expect.objectContaining({ id: 'stock:AAPL', name: 'Apple', price: 321 }),
  ]);
});
