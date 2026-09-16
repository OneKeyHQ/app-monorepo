/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketListingWatchlistQuote } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { useMarketWatchlistTokenList } from './useMarketWatchlistTokenList';
import {
  clearWatchlistListingPreviews,
  rememberWatchlistListingPreview,
} from './watchlistListingPreview';

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
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
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
      const [resolvedRunId, setResolvedRunId] = React.useState(0);
      const runIdRef = React.useRef(0);
      const methodRef = React.useRef(method);
      methodRef.current = method;
      const runId = React.useMemo(() => {
        runIdRef.current += 1;
        return runIdRef.current;
        // The mock follows the dynamic dependency contract of usePromiseResult.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      React.useEffect(() => {
        let active = true;
        void methodRef.current().then((value) => {
          if (active) {
            setResult(value);
            setResolvedRunId(runId);
          }
        });
        return () => {
          active = false;
        };
      }, [runId]);
      return {
        result,
        isLoading: resolvedRunId !== runId,
        run: () => methodRef.current(),
      };
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
  (platformEnv as { isNative: boolean }).isNative = false;
  mockStockBatch.mockResolvedValue([]);
  clearWatchlistListingPreviews();
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  await waitFor(() => expect(mockStockBatch).toHaveBeenCalledTimes(1));
  expect(mockStockBatch).toHaveBeenCalledWith({ stockIds: ['TSLA', 'AAPL'] });
});
it('skips the stock batch call when no stock is favorited', async () => {
  mockQuote.mockResolvedValue({ name: 'Bitcoin', symbol: 'BTC', logoUrl: '' });
  const watchlist = [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([
    expect.objectContaining({ id: 'asset:delisted', priceChangeRaw: '-' }),
  ]);
});
it('shows spot identity rows before the batch quote arrives', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  let resolveBatch: ((value: { list: [] }) => void) | undefined;
  mockBatch.mockImplementationOnce(
    () =>
      new Promise<{ list: [] }>((resolve) => {
        resolveBatch = resolve;
      }),
  );
  const watchlist = [
    {
      chainId: 'evm--1',
      contractAddress: '0xabc',
      isNative: false,
      sortIndex: 0,
    },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(result.current.data[0]).toMatchObject({
    chainId: 'evm--1',
    address: '0xabc',
    priceChangeRaw: '-',
  });
  resolveBatch?.({ list: [] });
  await waitFor(() => expect(result.current.data).toEqual([]));
});
it('does not emit pending spot rows on desktop or web', async () => {
  mockBatch.mockImplementationOnce(() => new Promise(() => undefined));
  const watchlist = [
    {
      chainId: 'evm--1',
      contractAddress: '0xabc',
      isNative: false,
    },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(true));
  expect(result.current.data).toEqual([]);
});
it('keeps the native first-load bypass until the watchlist atom is mounted', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  const watchlist = [
    {
      chainId: 'evm--1',
      contractAddress: '0xabc',
      isNative: false,
    },
  ];
  const { rerender, result } = renderHook(
    ({ isWatchlistMounted }: { isWatchlistMounted: boolean }) =>
      useMarketWatchlistTokenList({
        watchlist,
        isWatchlistMounted,
        pollingInterval: 0,
      }),
    {
      initialProps: { isWatchlistMounted: false },
    },
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.isLoading).toBe(true);
  rerender({ isWatchlistMounted: true });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
});
it('emits a native pending row for a new favorite missing from cached quotes', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockBatch.mockImplementationOnce(() => new Promise(() => undefined));
  const dataCacheRef = {
    current: {
      spot: {
        list: [
          {
            address: '0xcached',
            name: 'Cached',
            symbol: 'CACHED',
            decimals: 18,
            networkId: 'evm--1',
            isNative: false,
          },
        ],
      },
    },
  };
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist: [
        {
          chainId: 'evm--1',
          contractAddress: '0xcached',
          isNative: false,
        },
        {
          chainId: 'evm--1',
          contractAddress: '0xnew',
          isNative: false,
        },
      ],
      isWatchlistMounted: true,
      pollingInterval: 0,
      dataCacheRef,
    }),
  );
  await waitFor(() => expect(result.current.data).toHaveLength(2));
  expect(result.current.data.map((item) => item.address)).toEqual([
    '0xcached',
    '0xnew',
  ]);
  expect(result.current.data[1]).toMatchObject({
    address: '0xnew',
    isPendingWatchlistRow: true,
  });
});
it('emits a native pending row for a newly starred favorite while quotes stay loaded', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockBatch.mockResolvedValueOnce({
    list: [
      {
        address: '0xcached',
        name: 'Cached',
        symbol: 'CACHED',
        decimals: 18,
        networkId: 'evm--1',
        isNative: false,
      },
    ],
  });
  const cachedItem = {
    chainId: 'evm--1',
    contractAddress: '0xcached',
    isNative: false,
  };
  const { rerender, result } = renderHook(
    ({
      watchlist,
    }: {
      watchlist: Array<{
        chainId: string;
        contractAddress: string;
        isNative: boolean;
      }>;
    }) =>
      useMarketWatchlistTokenList({
        watchlist,
        isWatchlistMounted: true,
        pollingInterval: 0,
      }),
    {
      initialProps: { watchlist: [cachedItem] },
    },
  );
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  mockBatch.mockImplementationOnce(() => new Promise(() => undefined));
  rerender({
    watchlist: [
      cachedItem,
      {
        chainId: 'evm--1',
        contractAddress: '0xnew',
        isNative: false,
      },
    ],
  });
  await waitFor(() => expect(result.current.data).toHaveLength(2));
  expect(result.current.data.map((item) => item.address)).toEqual([
    '0xcached',
    '0xnew',
  ]);
  expect(result.current.data[1]).toMatchObject({
    address: '0xnew',
    isPendingWatchlistRow: true,
  });
});
it('emits a native pending row for the first favorite after an empty quote settle', async () => {
  (platformEnv as { isNative: boolean }).isNative = true;
  mockBatch.mockResolvedValueOnce({ list: [] });
  const { rerender, result } = renderHook(
    ({
      watchlist,
    }: {
      watchlist: Array<{
        chainId: string;
        contractAddress: string;
        isNative: boolean;
      }>;
    }) =>
      useMarketWatchlistTokenList({
        watchlist,
        isWatchlistMounted: true,
        pollingInterval: 0,
      }),
    {
      initialProps: { watchlist: [] },
    },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  mockBatch.mockImplementationOnce(() => new Promise(() => undefined));
  rerender({
    watchlist: [
      {
        chainId: 'evm--1',
        contractAddress: '0xnew',
        isNative: false,
      },
    ],
  });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(result.current.data[0]).toMatchObject({
    address: '0xnew',
    isPendingWatchlistRow: true,
  });
});
it('keeps a starred stock logo before the batch quote arrives', async () => {
  rememberWatchlistListingPreview(
    { stockId: 'AAPL', chainId: '', contractAddress: '' },
    { logoUrl: 'https://example.com/aapl.png', name: 'Apple Inc.' },
  );
  let resolveBatch: ((value: IMarketStockPublicItem[]) => void) | undefined;
  mockStockBatch.mockImplementationOnce(
    () =>
      new Promise<IMarketStockPublicItem[]>((resolve) => {
        resolveBatch = resolve;
      }),
  );
  const watchlist = [
    { stockId: 'AAPL', chainId: '', contractAddress: '', sortIndex: 0 },
  ];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  await waitFor(() =>
    expect(result.current.data[0]).toMatchObject({
      stockId: 'AAPL',
      name: 'Apple Inc.',
      tokenImageUri: 'https://example.com/aapl.png',
    }),
  );
  resolveBatch?.([
    stockItem('AAPL', {
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/quote.png',
    }),
  ]);
  await waitFor(() =>
    expect(result.current.data[0]?.tokenImageUri).toBe(
      'https://example.com/quote.png',
    ),
  );
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
    useMarketWatchlistTokenList({
      watchlist,
      isWatchlistMounted: true,
      pollingInterval: 0,
    }),
  );
  // Rows render from the watchlist before the quotes resolve, so wait on the
  // quote-derived names rather than on the row count.
  await waitFor(() =>
    expect(result.current.data.map((item) => item.name)).toEqual([
      'Apple Inc.',
      'Bitcoin',
    ]),
  );
  expect(result.current.data[0].stockVariants).toEqual(variants);
  expect(result.current.data[1].stockVariants).toBeUndefined();
});
