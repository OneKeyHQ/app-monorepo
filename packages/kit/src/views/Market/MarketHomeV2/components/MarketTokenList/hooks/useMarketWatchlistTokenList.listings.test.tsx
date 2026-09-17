/** @jest-environment jsdom */
import type { RefObject } from 'react';

import { renderHook, waitFor } from '@testing-library/react';

import type { IMarketListingWatchlistQuote } from '@onekeyhq/shared/types/market';
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
const mockBatch = jest.fn<Promise<{ list: [] }>, unknown[]>(async () => ({
  list: [],
}));
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
      React.useEffect(() => {
        let active = true;
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
it('drops the cached quote batch once a new listing is favorited', async () => {
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

  // TSLA has no cached quote, so reusing the batch would render it with NaN.
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
  expect(second.result.current.data).toEqual([]);
});
