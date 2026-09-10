/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';

import type { IMarketListingWatchlistQuote } from '@onekeyhq/shared/types/market';

import { useMarketWatchlistTokenList } from './useMarketWatchlistTokenList';

const mockQuote = jest.fn<
  Promise<IMarketListingWatchlistQuote | undefined>,
  unknown[]
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
beforeEach(() => {
  jest.clearAllMocks();
});
it('loads asset and stock quotes by ID without sending empty chain identities to the batch API', async () => {
  mockQuote.mockImplementation(async (identity) => {
    const id = identity as { assetId?: string; stockId?: string };
    return {
      name: id.assetId ? 'Bitcoin' : 'Apple',
      symbol: id.assetId ? 'BTC' : 'AAPL',
      logoUrl: '',
      price: '123',
      priceChange24hPercent: '2',
    };
  });
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
  expect(mockBatch).not.toHaveBeenCalled();
});
it('retains an unavailable listing so it can still be removed', async () => {
  mockQuote.mockRejectedValue(new Error('delisted'));
  const watchlist = [{ stockId: 'DELISTED', chainId: '', contractAddress: '' }];
  const { result } = renderHook(() =>
    useMarketWatchlistTokenList({ watchlist, pollingInterval: 0 }),
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([
    expect.objectContaining({
      id: 'stock:DELISTED',
      stockId: 'DELISTED',
      priceChangeRaw: '-',
    }),
  ]);
});
