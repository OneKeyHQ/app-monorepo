/** @jest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react-native/pure';

import { buildDeferredPromise } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketHighlightAsset } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketTokenListBatchForPlatform } from '../MarketHomeV2/components/MarketTokenList/hooks/marketTokenBatchPlatformApi';

import { useMarketHighlightQuotes } from './useMarketHighlightQuotes';
import { useMarketHighlights } from './useMarketHighlights';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketHighlights: jest.fn(),
      fetchMarketStockBatch: jest.fn(),
      fetchMarketPerpsTokenList: jest.fn(),
      fetchMarketListingWatchlistQuote: jest.fn(),
    },
  },
}));

jest.mock(
  '../MarketHomeV2/components/MarketTokenList/hooks/marketTokenBatchPlatformApi',
  () => ({ fetchMarketTokenListBatchForPlatform: jest.fn() }),
);

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise'),
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

const service = jest.mocked(backgroundApiProxy.serviceMarketV2);
const fetchTokens = jest.mocked(fetchMarketTokenListBatchForPlatform);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

it('loads immediately and replaces the headline while the page remains open', async () => {
  service.fetchMarketHighlights
    .mockResolvedValueOnce([
      {
        highlightId: 'first',
        title: 'First headline',
        description: '',
        publishedAt: '2026-11-04T00:00:00Z',
        assets: [],
        links: [],
      },
    ])
    .mockResolvedValueOnce([
      {
        highlightId: 'second',
        title: 'New headline',
        description: '',
        publishedAt: '2026-11-04T01:00:00Z',
        assets: [],
        links: [],
      },
    ]);
  const { result } = renderHook(() => useMarketHighlights());

  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current.items?.[0].title).toBe('First headline');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.items?.[0].title).toBe('New headline');
});

it.each(['en-US', 'zh-CN'])(
  'reuses the homepage list only for the current locale when preview locale=%s',
  async (previewLocale) => {
    const pending =
      buildDeferredPromise<
        Awaited<ReturnType<typeof service.fetchMarketHighlights>>
      >();
    const preview = {
      locale: previewLocale,
      items: [
        {
          highlightId: 'preview',
          title: 'Homepage headline',
          description: '',
          publishedAt: '2026-11-04T00:00:00Z',
          assets: [],
          links: [],
        },
      ],
    };
    service.fetchMarketHighlights.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useMarketHighlights(preview));

    expect(result.current.items?.[0].title).toBe(
      previewLocale === 'en-US' ? 'Homepage headline' : undefined,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.items?.[0].title).toBe(
      previewLocale === 'en-US' ? 'Homepage headline' : undefined,
    );

    pending.resolve([{ ...preview.items[0], title: 'Refreshed headline' }]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.items?.[0].title).toBe('Refreshed headline');
  },
);

it('refreshes stock, spot, perpetual, and token prices with unchanged assets', async () => {
  const assets: IMarketHighlightAsset[] = [
    {
      type: 'stock',
      stockId: 'AAPL',
      symbol: 'AAPL',
      favorite: { chainId: '', contractAddress: '', stockId: 'AAPL' },
    },
    {
      type: 'asset',
      assetId: 'btc',
      symbol: 'BTC',
      favorite: { chainId: '', contractAddress: '', assetId: 'btc' },
    },
    {
      type: 'perp',
      perpsCoin: 'BTC',
      symbol: 'BTC',
      favorite: { chainId: '', contractAddress: '', perpsCoin: 'BTC' },
    },
    {
      type: 'token',
      chainId: 'evm--1',
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      favorite: {
        chainId: 'evm--1',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
    },
  ];
  let price = '100';
  service.fetchMarketStockBatch.mockImplementation(async () => [
    {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      price,
    },
  ]);
  service.fetchMarketListingWatchlistQuote.mockImplementation(async () => ({
    symbol: 'BTC',
    name: 'Bitcoin',
    logoUrl: '',
    price,
  }));
  service.fetchMarketPerpsTokenList.mockImplementation(async () => ({
    tokens: [
      {
        name: 'BTC',
        displayName: 'BTC',
        maxLeverage: 40,
        tokenImageUrl: '',
        markPrice: price,
        prevDayPrice: '100',
        change24hPercent: 0,
        volume24h: '0',
        openInterest: '0',
        fundingRate: '0',
      },
    ],
    updatedAt: 0,
  }));
  fetchTokens.mockImplementation(async () => ({
    list: [
      {
        networkId: 'evm--1',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        isNative: false,
        name: 'Tether',
        symbol: 'USDT',
        decimals: 6,
        price,
      },
    ],
  }));
  const { result } = renderHook(() => useMarketHighlightQuotes(assets));

  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect([...result.current!.values()].map((quote) => quote.price)).toEqual([
    '100',
    '100',
    '100',
    '100',
  ]);

  price = '101';
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect([...result.current!.values()].map((quote) => quote.price)).toEqual([
    '101',
    '101',
    '101',
    '101',
  ]);
});

it.each(['', 'btc'])(
  'matches a native quote without isNative using the original favorite key %p',
  async (contractAddress) => {
    const assets: IMarketHighlightAsset[] = [
      {
        type: 'token',
        symbol: 'BTC',
        chainId: 'btc--0',
        contractAddress,
        favorite: { chainId: 'btc--0', contractAddress },
      },
    ];
    fetchTokens.mockResolvedValue({
      list: [
        {
          networkId: 'btc--0',
          address: 'native-address-returned-by-server',
          isNative: true,
          name: 'Bitcoin',
          symbol: 'BTC',
          decimals: 8,
          price: '78000',
        },
      ],
    });
    const { result } = renderHook(() => useMarketHighlightQuotes(assets));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(fetchTokens).toHaveBeenCalledWith({
      tokenAddressList: [
        { chainId: 'btc--0', contractAddress, isNative: true },
      ],
    });
    expect(result.current?.get(`btc--0:${contractAddress}`)?.price).toBe(
      '78000',
    );
  },
);

it('keeps quotes when all active sources fail and accepts partial recovery', async () => {
  const spot: IMarketHighlightAsset = {
    type: 'asset',
    assetId: 'btc',
    symbol: 'BTC',
    favorite: { chainId: '', contractAddress: '', assetId: 'btc' },
  };
  const perp: IMarketHighlightAsset = {
    type: 'perp',
    perpsCoin: 'BTC',
    symbol: 'BTC',
    favorite: { chainId: '', contractAddress: '', perpsCoin: 'BTC' },
  };
  service.fetchMarketListingWatchlistQuote.mockResolvedValue({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '78000',
  });
  const { result, rerender } = renderHook(
    ({ assets }: { assets: IMarketHighlightAsset[] }) =>
      useMarketHighlightQuotes(assets),
    { initialProps: { assets: [spot] } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.get('asset:btc')?.price).toBe('78000');

  service.fetchMarketListingWatchlistQuote.mockRejectedValue(
    new Error('Quote source unavailable'),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current?.get('asset:btc')?.price).toBe('78000');

  service.fetchMarketPerpsTokenList.mockRejectedValue(
    new Error('Perpetual source unavailable'),
  );
  rerender({ assets: [spot, perp] });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.get('asset:btc')?.price).toBe('78000');

  service.fetchMarketListingWatchlistQuote.mockResolvedValue({
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: '',
    price: '79000',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current?.get('asset:btc')?.price).toBe('79000');
  expect(result.current?.has('perps:BTC')).toBe(false);

  rerender({ assets: [] });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.size).toBe(0);
});

it.each([false, true])(
  'shows completed quotes before slower requests finish with a warm preview=%s',
  async (hasPreview) => {
    const pending =
      buildDeferredPromise<
        Awaited<ReturnType<typeof service.fetchMarketListingWatchlistQuote>>
      >();
    const assets = ['btc', 'eth'].map<IMarketHighlightAsset>((assetId) => ({
      type: 'asset',
      assetId,
      symbol: assetId.toUpperCase(),
      favorite: { chainId: '', contractAddress: '', assetId },
    }));
    const preview = new Map(
      hasPreview ? [['asset:eth', { price: '2400', logoUrl: 'eth-logo' }]] : [],
    );
    service.fetchMarketListingWatchlistQuote.mockImplementation(
      async ({ assetId }) =>
        assetId === 'eth'
          ? pending.promise
          : {
              name: 'Bitcoin',
              symbol: 'BTC',
              price: '78000',
              logoUrl: 'btc-logo',
            },
    );
    const { result, rerender } = renderHook(
      ({
        visibleAssets,
      }: {
        visibleAssets: IMarketHighlightAsset[] | undefined;
      }) => useMarketHighlightQuotes(visibleAssets, preview),
      {
        initialProps: {
          visibleAssets: undefined as IMarketHighlightAsset[] | undefined,
        },
      },
    );
    expect(result.current?.get('asset:eth')?.price).toBe(
      hasPreview ? '2400' : undefined,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current?.get('asset:eth')?.price).toBe(
      hasPreview ? '2400' : undefined,
    );
    rerender({ visibleAssets: assets });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current?.get('asset:btc')).toMatchObject({
      price: '78000',
      logoUrl: 'btc-logo',
    });
    expect(result.current?.get('asset:eth')?.price).toBe(
      hasPreview ? '2400' : undefined,
    );

    pending.resolve({
      name: 'Ethereum',
      symbol: 'ETH',
      price: '2500',
      logoUrl: 'eth-logo',
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current?.get('asset:btc')?.price).toBe('78000');
    expect(result.current?.get('asset:eth')?.price).toBe('2500');
  },
);

it('ignores a late partial result after switching visible assets', async () => {
  const pending =
    buildDeferredPromise<
      Awaited<ReturnType<typeof service.fetchMarketListingWatchlistQuote>>
    >();
  const assets = ['btc', 'eth'].map<IMarketHighlightAsset>((assetId) => ({
    type: 'asset',
    assetId,
    symbol: assetId.toUpperCase(),
    favorite: { chainId: '', contractAddress: '', assetId },
  }));
  service.fetchMarketListingWatchlistQuote.mockImplementation(
    async ({ assetId }) =>
      assetId === 'btc'
        ? pending.promise
        : {
            name: 'Ethereum',
            symbol: 'ETH',
            price: '2500',
            logoUrl: 'eth-logo',
          },
  );
  const { result, rerender } = renderHook(
    ({ visibleAssets }: { visibleAssets: IMarketHighlightAsset[] }) =>
      useMarketHighlightQuotes(visibleAssets),
    { initialProps: { visibleAssets: assets.slice(0, 1) } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  rerender({ visibleAssets: assets.slice(1) });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.get('asset:eth')?.price).toBe('2500');

  pending.resolve({
    name: 'Bitcoin',
    symbol: 'BTC',
    price: '78000',
    logoUrl: 'btc-logo',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.get('asset:eth')?.price).toBe('2500');
  expect(result.current?.has('asset:btc')).toBe(false);
});
