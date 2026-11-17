/** @jest-environment jsdom */

import {
  act,
  cleanupAsync,
  renderHook,
} from '@testing-library/react-native/pure';

import { buildDeferredPromise } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
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

globalThis.requestIdleCallback ??= (callback) =>
  Number(
    setTimeout(
      () => callback({ didTimeout: false, timeRemaining: () => 0 }),
      0,
    ),
  );
globalThis.cancelIdleCallback ??= (handle) => clearTimeout(handle);

const service = jest.mocked(backgroundApiProxy.serviceMarketV2);
const fetchTokens = jest.mocked(fetchMarketTokenListBatchForPlatform);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  swrCacheUtils.removeByPrefix('marketHighlightQuotes:');
});

afterEach(async () => {
  await cleanupAsync();
  jest.useRealTimers();
  jest.restoreAllMocks();
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

it('shows the previous native headline before a fresh response arrives', async () => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  const key = swrKeys.marketHomeHighlights('en-US');
  swrCacheUtils.remove(key);
  const headline = {
    highlightId: 'cached',
    title: 'Cached headline',
    description: '',
    publishedAt: '2026-11-04T00:00:00Z',
    assets: [],
    links: [],
  };
  try {
    service.fetchMarketHighlights.mockResolvedValue([headline]);
    renderHook(() => useMarketHighlights());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await cleanupAsync();

    const refresh =
      buildDeferredPromise<
        Awaited<ReturnType<typeof service.fetchMarketHighlights>>
      >();
    service.fetchMarketHighlights.mockReturnValue(refresh.promise);
    const { result } = renderHook(() => useMarketHighlights());
    expect(result.current.items?.[0].title).toBe('Cached headline');

    await act(async () => {
      refresh.resolve([{ ...headline, title: 'Fresh headline' }]);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.items?.[0].title).toBe('Fresh headline');
  } finally {
    service.fetchMarketHighlights.mockReset();
    swrCacheUtils.remove(key);
  }
});

it.each(['response', 'preview'])(
  'provides consistent native flags to detail and favorites from the %s',
  async (source) => {
    const token: IMarketHighlightAsset = {
      type: 'token',
      chainId: 'btc--0',
      contractAddress: '',
      symbol: 'BTC',
      favorite: { chainId: 'btc--0', contractAddress: '' },
    };
    const items = [
      {
        highlightId: 'bitcoin',
        title: 'Bitcoin',
        description: '',
        publishedAt: '2026-11-04T00:00:00Z',
        assets: [token, { ...token, isNative: false }],
        links: [],
      },
    ];
    service.fetchMarketHighlights.mockResolvedValue(items);
    const { result } = renderHook(() =>
      useMarketHighlights(
        source === 'preview' ? { locale: 'en-US', items } : undefined,
      ),
    );
    if (source === 'response') {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
    }
    expect(result.current.items?.[0].assets).toMatchObject([
      { isNative: true, favorite: { isNative: true } },
      { isNative: false, favorite: { isNative: false } },
    ]);
  },
);

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
  expect(
    [...result.current!.values()]
      .map((quote) => quote.maxLeverage)
      .filter((value) => value !== undefined),
  ).toEqual([40]);

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

it('keeps failed asset quotes during a partial refresh and removes deleted assets', async () => {
  const assets = ['btc', 'eth'].map<IMarketHighlightAsset>((assetId) => ({
    type: 'asset',
    assetId,
    symbol: assetId.toUpperCase(),
    favorite: { chainId: '', contractAddress: '', assetId },
  }));
  let price = '100';
  let failBitcoin = false;
  service.fetchMarketListingWatchlistQuote.mockImplementation(
    async ({ assetId }) => {
      if (failBitcoin && assetId === 'btc') {
        throw new OneKeyLocalError('Bitcoin quote source unavailable');
      }
      return {
        name: 'Asset',
        symbol: 'ASSET',
        logoUrl: `${assetId}-logo`,
        price,
      };
    },
  );
  const { result, rerender } = renderHook(
    ({ currentAssets }: { currentAssets: IMarketHighlightAsset[] }) =>
      useMarketHighlightQuotes(currentAssets),
    { initialProps: { currentAssets: assets } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.get('asset:btc')?.price).toBe('100');
  expect(result.current?.get('asset:eth')?.price).toBe('100');

  price = '101';
  failBitcoin = true;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current?.get('asset:btc')).toMatchObject({
    price: '100',
    logoUrl: 'btc-logo',
  });
  expect(result.current?.get('asset:eth')?.price).toBe('101');

  rerender({ currentAssets: assets.slice(1) });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current?.has('asset:btc')).toBe(false);
});

it.each([false, true])(
  'clears a cached quote before a second source settles (second quote cached: %s)',
  async (hasSecondQuote) => {
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
    const bitcoin = {
      name: 'Bitcoin',
      symbol: 'BTC',
      logoUrl: 'btc-logo',
      price: '100',
    };
    const ethereum = {
      name: 'Ethereum',
      symbol: 'ETH',
      logoUrl: 'eth-logo',
      price: '200',
    };
    service.fetchMarketListingWatchlistQuote.mockImplementation(
      async ({ assetId }) => {
        if (assetId === 'btc') return bitcoin;
        return hasSecondQuote ? ethereum : undefined;
      },
    );
    const { result } = renderHook(() => useMarketHighlightQuotes(assets));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current?.get('asset:btc')?.price).toBe('100');

    service.fetchMarketListingWatchlistQuote.mockImplementation(
      async ({ assetId }) => (assetId === 'btc' ? undefined : pending.promise),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current?.has('asset:btc')).toBe(false);
    expect(result.current?.get('asset:eth')?.price).toBe(
      hasSecondQuote ? '200' : undefined,
    );

    pending.resolve({ ...ethereum, price: '201' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current?.get('asset:eth')?.price).toBe('201');
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

it('limits concurrent quote sources while preloading a full highlight list', async () => {
  const pending = buildDeferredPromise<void>();
  let active = 0;
  let maximum = 0;
  const waitForResponse = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await pending.promise;
    active -= 1;
  };
  fetchTokens.mockImplementation(async () => {
    await waitForResponse();
    return { list: [] };
  });
  service.fetchMarketStockBatch.mockImplementation(async () => {
    await waitForResponse();
    return [];
  });
  service.fetchMarketPerpsTokenList.mockImplementation(async () => {
    await waitForResponse();
    return { tokens: [], updatedAt: 0 };
  });
  service.fetchMarketListingWatchlistQuote.mockImplementation(async () => {
    await waitForResponse();
    return { symbol: 'BTC', name: 'Bitcoin', logoUrl: '', price: '78000' };
  });
  const assets: IMarketHighlightAsset[] = [
    {
      type: 'token',
      symbol: 'SOL',
      chainId: 'sol--101',
      contractAddress: '',
      isNative: true,
      favorite: { chainId: 'sol--101', contractAddress: '', isNative: true },
    },
    {
      type: 'stock',
      symbol: 'AAPL',
      stockId: 'AAPL',
      favorite: { chainId: '', contractAddress: '', stockId: 'AAPL' },
    },
    {
      type: 'perp',
      symbol: 'BTC',
      perpsCoin: 'BTC',
      favorite: { chainId: '', contractAddress: '', perpsCoin: 'BTC' },
    },
    ...Array.from(
      { length: 8 },
      (_, index): IMarketHighlightAsset => ({
        type: 'asset',
        symbol: `ASSET${index}`,
        assetId: `asset-${index}`,
        favorite: {
          chainId: '',
          contractAddress: '',
          assetId: `asset-${index}`,
        },
      }),
    ),
  ];
  const { result } = renderHook(() => useMarketHighlightQuotes(assets));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(active).toBe(4);

  pending.resolve();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(maximum).toBe(4);
  expect(result.current?.size).toBe(8);
});

const btcHighlightAsset: IMarketHighlightAsset = {
  type: 'asset',
  assetId: 'btc',
  symbol: 'BTC',
  favorite: { chainId: '', contractAddress: '', assetId: 'btc' },
};
const btcPerpHighlightAsset: IMarketHighlightAsset = {
  type: 'perp',
  perpsCoin: 'BTC',
  symbol: 'BTC',
  favorite: { chainId: '', contractAddress: '', perpsCoin: 'BTC' },
};
const btcHighlightQuote = {
  name: 'Bitcoin',
  symbol: 'BTC',
  logoUrl: 'btc-logo',
  price: '65000',
  priceChange24hPercent: '1.5',
};

it('does not refetch unchanged asset identities after the headline is revalidated', async () => {
  service.fetchMarketListingWatchlistQuote.mockResolvedValue(btcHighlightQuote);
  const view = renderHook(
    ({ assets }: { assets: IMarketHighlightAsset[] }) =>
      useMarketHighlightQuotes(assets),
    {
      initialProps: { assets: [btcHighlightAsset] },
    },
  );
  await act(async () => jest.advanceTimersByTimeAsync(0));
  expect(service.fetchMarketListingWatchlistQuote.mock.calls).toHaveLength(1);
  view.rerender({
    assets: [
      { ...btcHighlightAsset, name: 'Updated headline asset' },
      { ...btcHighlightAsset },
    ],
  });
  await act(async () => jest.advanceTimersByTimeAsync(0));
  expect(service.fetchMarketListingWatchlistQuote.mock.calls).toHaveLength(1);
  await act(async () => jest.advanceTimersByTimeAsync(30_000));
  expect(service.fetchMarketListingWatchlistQuote.mock.calls).toHaveLength(2);
});

it('shares the pending perpetual request between the strip and detail', async () => {
  const pending =
    buildDeferredPromise<
      Awaited<ReturnType<typeof service.fetchMarketPerpsTokenList>>
    >();
  service.fetchMarketPerpsTokenList.mockReturnValue(pending.promise);
  const stripAssets = [btcPerpHighlightAsset];
  const detailAssets = [{ ...btcPerpHighlightAsset }];
  const strip = renderHook(() => useMarketHighlightQuotes(stripAssets));
  await act(async () => jest.advanceTimersByTimeAsync(0));
  const detail = renderHook(() => useMarketHighlightQuotes(detailAssets));
  await act(async () => jest.advanceTimersByTimeAsync(0));
  const callsWhilePending = service.fetchMarketPerpsTokenList.mock.calls.length;
  pending.resolve({
    tokens: [
      {
        name: 'BTC',
        displayName: 'BTC',
        maxLeverage: 40,
        tokenImageUrl: 'perp-logo',
        markPrice: '65100',
        prevDayPrice: '65000',
        change24hPercent: 0.15,
        volume24h: '1',
        openInterest: '1',
        fundingRate: '0',
      },
    ],
    updatedAt: 0,
  });
  await act(async () => jest.advanceTimersByTimeAsync(0));
  expect(callsWhilePending).toBe(1);
  expect(strip.result.current?.get('perps:BTC')?.price).toBe('65100');
  expect(detail.result.current?.get('perps:BTC')?.price).toBe('65100');
});

it('shows a compact native quote preview on remount while refreshing it', async () => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  const fullQuote = {
    ...btcHighlightQuote,
    sparkline: Array.from({ length: 300 }, () => 1),
  };
  service.fetchMarketListingWatchlistQuote.mockResolvedValue(fullQuote);
  const first = renderHook(() => useMarketHighlightQuotes([btcHighlightAsset]));
  await act(async () => jest.advanceTimersByTimeAsync(0));
  first.unmount();
  const pending = buildDeferredPromise<typeof btcHighlightQuote>();
  service.fetchMarketListingWatchlistQuote.mockReturnValue(pending.promise);
  const next = renderHook(() =>
    useMarketHighlightQuotes([{ ...btcHighlightAsset }]),
  );
  const preview = next.result.current?.get('asset:btc');
  const stored = swrCacheUtils.get<Array<[string, unknown]>>(
    swrKeys.marketHighlightQuotes('en-US', ['asset:btc']),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
    pending.resolve({ ...btcHighlightQuote, price: '65200' });
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(preview).toMatchObject({ logoUrl: 'btc-logo', price: '65000' });
  expect(stored?.[0][1]).not.toHaveProperty('sparkline');
  expect(stored?.[0][1]).not.toHaveProperty('name');
  expect(next.result.current?.get('asset:btc')?.price).toBe('65200');
});

it('merges a partial native cache with the quotes passed by the strip', async () => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  const assets = [btcHighlightAsset, btcPerpHighlightAsset];
  swrCacheUtils.set(
    swrKeys.marketHighlightQuotes('en-US', ['asset:btc', 'perps:BTC']),
    [['asset:btc', { price: '65000', logoUrl: 'btc-logo' }]],
  );
  const pending =
    buildDeferredPromise<
      Awaited<ReturnType<typeof service.fetchMarketPerpsTokenList>>
    >();
  service.fetchMarketPerpsTokenList.mockReturnValue(pending.promise);
  service.fetchMarketListingWatchlistQuote.mockResolvedValue(btcHighlightQuote);
  const initial = new Map([
    ['perps:BTC', { price: '65100', logoUrl: 'perp-logo' }],
  ]);
  const view = renderHook(() => useMarketHighlightQuotes(assets, initial));
  const preview = view.result.current;
  pending.resolve({ tokens: [], updatedAt: 0 });
  await act(async () => jest.advanceTimersByTimeAsync(0));
  expect(preview?.get('asset:btc')?.price).toBe('65000');
  expect(preview?.get('perps:BTC')?.price).toBe('65100');
  expect(view.result.current?.has('perps:BTC')).toBe(false);
});

it('does not display a native quote preview older than five minutes', () => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  const key = swrKeys.marketHighlightQuotes('en-US', ['asset:btc']);
  swrCacheUtils.set(key, [['asset:btc', { price: '65000' }]]);
  jest.setSystemTime(Date.now() + 5 * 60_000 + 1);
  const view = renderHook(() => useMarketHighlightQuotes([btcHighlightAsset]));
  expect(view.result.current).toBeUndefined();
});
