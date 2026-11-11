/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EMarketBannerType,
  type IMarketBannerItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
} from './marketBannerListPlatformApi';
import {
  hydrateMarketBannerQuotes,
  useMarketBannerList,
} from './useMarketBannerList';

let mockResult: IMarketBannerItem[] | undefined;
let mockLoading: boolean | undefined;
let mockLocale = 'en-US';
let mockResultScope = 'en-US:false';
let mockRequest: () => Promise<unknown>;
let mockHydrate: () => Promise<unknown>;
let mockEnabled = false;
let mockLiveResult: unknown;
jest.mock('@onekeyhq/components/src/primitives/Image/preload', () => ({
  preloadImages: jest.fn().mockResolvedValue(true),
}));
jest.mock('@onekeyhq/kit/src/components/Token/tokenSize', () => ({
  getTokenImageResizeWidth: () => 20,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true, isDesktop: false },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    request: () => Promise<unknown>,
    _deps: unknown[],
    options: { watchLoading?: boolean },
  ) => {
    if (!options.watchLoading) {
      mockHydrate = request;
      return { result: mockLiveResult };
    }
    mockRequest = request;
    return {
      result:
        mockResult === undefined
          ? undefined
          : {
              scope: mockResultScope,
              banners: mockResult,
            },
      isLoading: mockLoading,
    };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    { enabled: mockEnabled, settings: { enableMockMarketBanner: mockEnabled } },
  ],
}));
jest.mock('./marketBannerListPlatformApi', () => ({
  fetchMarketBannerListForPlatform: jest.fn(),
  fetchMarketBannerStockTokenListForPlatform: jest.fn(),
  fetchMarketBannerTokenListForPlatform: jest.fn(),
}));

const makeBanner = (
  overrides: Partial<IMarketBannerItem> = {},
): IMarketBannerItem => ({
  _id: 'banner',
  title: 'Banner',
  rank: 1,
  mode: 4,
  payload: '',
  miniBundlerVersion: '',
  backgroundColor: 'bg/subdued',
  tokenListId: 'banner-list',
  ...overrides,
});

beforeEach(() => {
  (platformEnv as { isDesktop: boolean }).isDesktop = false;
  mockEnabled = false;
  mockLiveResult = undefined;
  mockResult = undefined;
  mockLoading = undefined;
  mockLocale = 'en-US';
  mockResultScope = 'en-US:false';
  jest.mocked(fetchMarketBannerListForPlatform).mockReset();
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockReset();
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockReset();
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockRejectedValue(new Error('offline'));
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([]);
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([]);
});
it('treats the pre-request frame as pending', () => {
  const { result } = renderHook(() => useMarketBannerList());
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isFetched).toBe(false);
});
it('accepts an empty cached result without showing a skeleton', () => {
  mockResult = [];
  const { result } = renderHook(() => useMarketBannerList());
  expect(result.current.isLoading).toBe(false);
  expect(result.current.isFetched).toBe(true);
});
it('does not blank the page again when retrying a settled initial request', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).resolves.toBeUndefined();
  });
  mockLoading = false;
  rerender();
  expect(result.current.isLoading).toBe(false);
  mockLoading = true;
  rerender();
  expect(result.current.isLoading).toBe(false);
});

it('does not inherit the previous locale completion before the new request starts', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).resolves.toBeUndefined();
  });
  mockLoading = false;
  mockLocale = 'zh-CN';
  rerender();
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    await expect(mockRequest()).resolves.toBeUndefined();
  });
  expect(result.current.isLoading).toBe(false);
});
it('ignores a request callback from the previous locale', async () => {
  const { result, rerender } = renderHook(() => useMarketBannerList());
  const oldRequest = mockRequest;
  mockLocale = 'zh-CN';
  rerender();
  await act(async () => {
    await expect(oldRequest()).resolves.toBeUndefined();
  });
  expect(result.current.isLoading).toBe(true);
});

it('waits for successful banner data to commit before releasing the native layout gate', async () => {
  jest.mocked(fetchMarketBannerListForPlatform).mockResolvedValue([]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await mockRequest();
  });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isFetched).toBe(false);
  mockResult = [];
  rerender();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.isFetched).toBe(true);
});

it.each([EMarketBannerType.Index, EMarketBannerType.StockIndex])(
  'hydrates %s quotes from the inline indices payload',
  async (type) => {
    const indices = [
      {
        logo: '',
        name: 'S&P 500',
        symbol: '^GSPC',
        price: '7656.98',
        priceChange24hPercent: '0.86',
      },
    ];
    jest
      .mocked(fetchMarketBannerListForPlatform)
      .mockResolvedValue([makeBanner({ type, indices })]);
    renderHook(() => useMarketBannerList());

    let hydrated: unknown;
    await act(async () => {
      hydrated = await hydrateMarketBannerQuotes(
        await fetchMarketBannerListForPlatform(),
      );
    });

    expect(hydrated).toEqual([makeBanner({ type, indices, tokens: indices })]);
    expect(fetchMarketBannerStockTokenListForPlatform).not.toHaveBeenCalled();
  },
);

it('keeps stock-backed index assets on the stock list endpoint', async () => {
  const stock = {
    stockId: 'stock-index',
    name: 'Index Asset',
    symbol: 'INDEX',
    logoUrl: '',
    price: '100',
    priceChange24hPercent: '1',
    assetType: 'index' as const,
    currency: 'USD' as const,
  };
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockResolvedValue([
      makeBanner({ type: EMarketBannerType.Stock, assetType: 'index' }),
    ]);
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockResolvedValue([stock]);
  renderHook(() => useMarketBannerList());

  let hydrated: unknown;
  await act(async () => {
    hydrated = await hydrateMarketBannerQuotes(
      await fetchMarketBannerListForPlatform(),
    );
  });

  expect(fetchMarketBannerStockTokenListForPlatform).toHaveBeenCalledWith(
    'banner-list',
  );
  expect(hydrated).toEqual([
    makeBanner({
      type: EMarketBannerType.Stock,
      assetType: 'index',
      tokens: [
        {
          logo: '',
          name: 'Index Asset',
          symbol: 'INDEX',
          stockId: 'stock-index',
          price: '100',
          priceChange24hPercent: '1',
        },
      ],
    }),
  ]);
});

it('releases the page with base data while optional quotes are still pending', async () => {
  const banners = [makeBanner({ type: EMarketBannerType.Stock })];
  jest.mocked(fetchMarketBannerListForPlatform).mockResolvedValue(banners);
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockReturnValue(new Promise(() => {}));
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await act(async () => {
    mockResult = ((await mockRequest()) as { banners: IMarketBannerItem[] })
      .banners;
  });
  rerender();
  void mockHydrate();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.bannerList).toEqual(banners);
});
it('skips remote quotes in mock mode', async () => {
  mockEnabled = true;
  mockResultScope = 'en-US:true';
  mockResult = [makeBanner({ type: EMarketBannerType.Stock })];
  renderHook(() => useMarketBannerList());
  await mockHydrate();
  expect(fetchMarketBannerStockTokenListForPlatform).not.toHaveBeenCalled();
  expect(fetchMarketBannerTokenListForPlatform).not.toHaveBeenCalled();
});

it('ignores quotes completed for a previous base response', async () => {
  mockResult = [makeBanner({ title: 'Old' })];
  const { result, rerender } = renderHook(() => useMarketBannerList());
  const pending = mockHydrate();
  mockResult = [makeBanner({ title: 'New' })];
  rerender();
  mockLiveResult = await pending;
  rerender();
  expect(result.current.bannerList[0].title).toBe('New');
});
it('ignores quotes completed for a previous language', async () => {
  mockResult = [makeBanner()];
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLiveResult = await mockHydrate();
  mockLocale = 'zh-CN';
  mockResultScope = 'zh-CN:false';
  mockResult = [makeBanner({ title: '中文' })];
  rerender();
  expect(result.current.bannerList[0].title).toBe('中文');
});

it('preserves a committed cache replay when revalidation fails', async () => {
  mockResult = [];
  const { result } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).resolves.toEqual({
      scope: 'en-US:false',
      banners: mockResult,
    });
  });
  expect(result.current.isFetched).toBe(true);
  expect(result.current.isLoading).toBe(false);
});

const quote = {
  logo: '',
  name: 'Apple',
  symbol: 'AAPL',
  price: '100',
  priceChange24hPercent: '1',
};

it('keeps banner artwork throughout successive quote refreshes', async () => {
  const preview = { ...quote, logo: 'https://example.com/banner-apple.png' };
  mockResult = [
    makeBanner({ type: EMarketBannerType.Stock, tokens: [preview] }),
  ];
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      ...quote,
      stockId: 'apple',
      logoUrl: 'https://example.com/stock-apple.png',
      assetType: 'stock',
      currency: 'USD',
      price: '110',
    },
  ]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  for (let refresh = 0; refresh < 2; refresh += 1) {
    mockResult = [
      makeBanner({ type: EMarketBannerType.Stock, tokens: [{ ...preview }] }),
    ];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].logo).toBe(preview.logo);
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
      logo: preview.logo,
      price: '110',
    });
  }
});

it('keeps ticker artwork throughout successive quote refreshes', async () => {
  const preview = { ...quote, logo: 'https://example.com/banner-apple.png' };
  mockResult = [
    makeBanner({ type: EMarketBannerType.Ticker, tokens: [preview] }),
  ];
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([
    {
      address: '0x1',
      decimals: 18,
      name: 'Apple',
      symbol: 'AAPL',
      logoUrl: 'https://example.com/token-apple.png',
      price: '110',
      priceChange24hPercent: '1',
    },
  ]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  for (let refresh = 0; refresh < 2; refresh += 1) {
    mockResult = [
      makeBanner({
        type: EMarketBannerType.Ticker,
        tokens: [{ ...preview }],
      }),
    ];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].logo).toBe(preview.logo);
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
      logo: preview.logo,
      price: '110',
    });
  }
});

it('does not replace hydrated ticker rows with a refreshed preview set', async () => {
  const preview = {
    ...quote,
    symbol: 'MSFT',
    name: 'Microsoft',
    logo: 'https://example.com/banner-msft.png',
  };
  mockResult = [
    makeBanner({ type: EMarketBannerType.Ticker, tokens: [preview] }),
  ];
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([
    {
      address: '0x1',
      decimals: 18,
      name: 'Apple',
      symbol: 'AAPL',
      logoUrl: 'https://example.com/token-apple.png',
      price: '110',
      priceChange24hPercent: '1',
    },
  ]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].symbol).toBe('AAPL');
  mockResult = [
    makeBanner({ type: EMarketBannerType.Ticker, tokens: [preview] }),
  ];
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].symbol).toBe('AAPL');
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
    symbol: 'AAPL',
    price: '110',
  });
});

it.each([EMarketBannerType.Stock, EMarketBannerType.Ticker])(
  'applies updated %s preview artwork on the same banner identity',
  async (type) => {
    const preview = { ...quote, logo: 'https://example.com/banner-apple.png' };
    const updated = {
      ...preview,
      logo: 'https://example.com/banner-apple-v2.png',
    };
    mockResult = [makeBanner({ type, tokens: [preview] })];
    if (type === EMarketBannerType.Stock) {
      jest
        .mocked(fetchMarketBannerStockTokenListForPlatform)
        .mockResolvedValue([
          {
            ...quote,
            stockId: 'apple',
            logoUrl: 'https://example.com/stock-apple.png',
            assetType: 'stock',
            currency: 'USD',
            price: '110',
          },
        ]);
    } else {
      jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([
        {
          address: '0x1',
          decimals: 18,
          name: 'Apple',
          symbol: 'AAPL',
          logoUrl: 'https://example.com/token-apple.png',
          price: '110',
          priceChange24hPercent: '1',
        },
      ]);
    }
    const { result, rerender } = renderHook(() => useMarketBannerList());
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].logo).toBe(preview.logo);
    mockResult = [makeBanner({ type, tokens: [updated] })];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
      symbol: 'AAPL',
      logo: updated.logo,
      price: '110',
    });
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
      symbol: 'AAPL',
      logo: updated.logo,
      price: '110',
    });
  },
);

it('hydrates quotes with the latest preview artwork instead of cached rows', async () => {
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      ...quote,
      stockId: 'apple',
      logoUrl: 'https://example.com/stock-apple.png',
      assetType: 'stock',
      currency: 'USD',
      price: '110',
    },
  ]);
  const banners = await hydrateMarketBannerQuotes(
    [
      makeBanner({
        type: EMarketBannerType.Stock,
        tokens: [{ ...quote, logo: 'https://example.com/banner-apple-v2.png' }],
      }),
    ],
    [
      makeBanner({
        type: EMarketBannerType.Stock,
        tokens: [{ ...quote, logo: 'https://example.com/banner-apple.png' }],
      }),
    ],
  );
  expect(banners[0].tokens?.[0]).toMatchObject({
    logo: 'https://example.com/banner-apple-v2.png',
    price: '110',
  });
});

it('overlays latest preview artwork when quote hydration fails', async () => {
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockRejectedValue(new Error('network'));
  const banners = await hydrateMarketBannerQuotes(
    [
      makeBanner({
        type: EMarketBannerType.Stock,
        tokens: [{ ...quote, logo: 'https://example.com/banner-apple-v2.png' }],
      }),
    ],
    [
      makeBanner({
        type: EMarketBannerType.Stock,
        tokens: [
          {
            ...quote,
            logo: 'https://example.com/banner-apple.png',
            price: '110',
          },
        ],
      }),
    ],
  );
  expect(banners[0].tokens?.[0]).toMatchObject({
    logo: 'https://example.com/banner-apple-v2.png',
    price: '110',
  });
});

it('uses stock artwork for newly added assets without a banner preview', async () => {
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      ...quote,
      stockId: 'apple',
      logoUrl: 'https://example.com/new-apple.png',
      assetType: 'stock',
      currency: 'USD',
    },
  ]);
  const banners = await hydrateMarketBannerQuotes([
    makeBanner({ type: EMarketBannerType.Stock, tokens: [] }),
  ]);
  expect(banners[0].tokens?.[0].logo).toBe('https://example.com/new-apple.png');
});

it('displays hydrated quotes and retains them across a fresh base response', async () => {
  mockResult = [makeBanner({ type: EMarketBannerType.Stock })];
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      ...quote,
      stockId: 'apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
    },
  ]);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
  mockResult = [
    makeBanner({ type: EMarketBannerType.Stock, title: 'Updated title' }),
  ];
  rerender();
  expect(result.current.bannerList[0].title).toBe('Updated title');
  expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockRejectedValue(new Error('offline'));
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      ...quote,
      price: '105',
      stockId: 'apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
    },
  ]);
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].price).toBe('105');
});

it.each([
  { tokenListId: 'replacement' },
  { _id: 'replacement' },
  { type: EMarketBannerType.Perps },
  { assetType: 'index' as const },
])('does not reuse quotes for changed identity %j', async (changes) => {
  mockResult = [makeBanner({ tokens: [quote] })];
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLiveResult = await mockHydrate();
  rerender();
  mockResult = [makeBanner(changes)];
  rerender();
  expect(result.current.bannerList[0].tokens).toBeUndefined();
  mockResult = [];
  rerender();
  expect(result.current.bannerList).toEqual([]);
});

it.each([true, false])(
  'uses fresh base quotes when optional hydration is skipped (mock=%s)',
  (mock) => {
    mockEnabled = mock;
    mockResultScope = `en-US:${mock}`;
    const type = mock ? EMarketBannerType.Stock : EMarketBannerType.Perps;
    mockResult = [makeBanner({ type, tokens: [quote] })];
    const { result, rerender } = renderHook(() => useMarketBannerList());
    mockResult = [makeBanner({ type, tokens: [{ ...quote, price: '110' }] })];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].price).toBe('110');
  },
);

it('does not carry hydrated prices into a different locale', async () => {
  jest
    .mocked(fetchMarketBannerTokenListForPlatform)
    .mockRejectedValue(new Error('offline'));
  mockResult = [makeBanner({ tokens: [quote] })];
  const { result, rerender } = renderHook(() => useMarketBannerList());
  mockLiveResult = await mockHydrate();
  rerender();
  expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
  mockLocale = 'zh-CN';
  mockResultScope = 'zh-CN:false';
  mockResult = [makeBanner()];
  rerender();
  expect(result.current.bannerList[0].tokens).toBeUndefined();
});

it.each([EMarketBannerType.Stock, EMarketBannerType.Ticker])(
  'clears successful empty %s quotes and does not restore removed rows',
  async (type) => {
    mockResult = [makeBanner({ type, tokens: [quote] })];
    const { result, rerender } = renderHook(() => useMarketBannerList());
    expect(result.current.bannerList[0].tokens).toEqual([quote]);
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens).toEqual([]);
    mockResult = [makeBanner({ type })];
    rerender();
    expect(result.current.bannerList[0].tokens).toEqual([]);
    jest
      .mocked(fetchMarketBannerStockTokenListForPlatform)
      .mockRejectedValue(new Error('offline'));
    jest
      .mocked(fetchMarketBannerTokenListForPlatform)
      .mockRejectedValue(new Error('offline'));
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens).toEqual([]);
  },
);

it.each([{ tokens: [{ ...quote, price: '105' }] }, { tokens: [] }])(
  'keeps hydrated quotes while a refreshed list still has preview rows %j',
  async ({ tokens }) => {
    mockResult = [makeBanner({ type: EMarketBannerType.Stock })];
    jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
      {
        ...quote,
        stockId: 'apple',
        logoUrl: '',
        assetType: 'stock',
        currency: 'USD',
      },
    ]);
    const { result, rerender } = renderHook(() => useMarketBannerList());
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
    mockResult = [makeBanner({ type: EMarketBannerType.Stock, tokens })];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
      symbol: 'AAPL',
      price: '100',
    });
    jest
      .mocked(fetchMarketBannerStockTokenListForPlatform)
      .mockRejectedValue(new Error('offline'));
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
    mockResult = [makeBanner({ type: EMarketBannerType.Stock })];
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].price).toBe('100');
    jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
      {
        ...quote,
        price: '110',
        stockId: 'apple',
        logoUrl: '',
        assetType: 'stock',
        currency: 'USD',
      },
    ]);
    mockLiveResult = await mockHydrate();
    rerender();
    expect(result.current.bannerList[0].tokens?.[0].price).toBe('110');
  },
);

it.each(['locale', 'mock'])(
  'rejects retained result tags after a %s change',
  async (setting) => {
    mockResult = [makeBanner({ title: 'Old response', tokens: [quote] })];
    const { result, rerender } = renderHook(() => useMarketBannerList());
    const oldRequest = mockRequest;
    expect(result.current.bannerList[0].title).toBe('Old response');
    if (setting === 'locale') mockLocale = 'zh-CN';
    else mockEnabled = true;
    rerender();
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isFetched).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await oldRequest();
    });
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await expect(mockRequest()).resolves.toBeUndefined();
    });
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isFetched).toBe(false);
    expect(result.current.isLoading).toBe(false);
  },
);

it.each([EMarketBannerType.Mixed, EMarketBannerType.StockPerps])(
  'hydrates composite %s banners through the stock endpoint',
  async (type) => {
    jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
      {
        ...quote,
        stockId: 'apple',
        logoUrl: '',
        assetType: 'stock',
        currency: 'USD',
      },
    ]);
    const hydrated = await hydrateMarketBannerQuotes([makeBanner({ type })]);
    expect(fetchMarketBannerStockTokenListForPlatform).toHaveBeenCalledWith(
      'banner-list',
    );
    expect(fetchMarketBannerTokenListForPlatform).not.toHaveBeenCalled();
    expect(hydrated[0].tokens?.[0].price).toBe('100');
  },
);

it('hydrates ticker_perps banners through the token endpoint', async () => {
  jest.mocked(fetchMarketBannerTokenListForPlatform).mockResolvedValue([
    {
      address: '0xtoken',
      name: 'Token',
      symbol: 'TKN',
      decimals: 18,
      logoUrl: '',
      price: '100',
      priceChange24hPercent: '1',
    },
  ]);
  const hydrated = await hydrateMarketBannerQuotes([
    makeBanner({ type: EMarketBannerType.TickerPerps }),
  ]);
  expect(fetchMarketBannerTokenListForPlatform).toHaveBeenCalledWith(
    'banner-list',
  );
  expect(fetchMarketBannerStockTokenListForPlatform).not.toHaveBeenCalled();
  expect(hydrated[0].tokens?.[0].price).toBe('100');
});

describe('desktop banner quote updates', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }
  const preview = (symbol: string, change: string) => ({
    ...quote,
    symbol,
    name: symbol,
    logo: `${symbol}.png`,
    price: '1',
    priceChange24hPercent: change,
  });
  const asset = (symbol: string, change: string, price = '100') => ({
    ...preview(symbol, change),
    stockId: symbol,
    logoUrl: 'remote.png',
    assetType: 'stock' as const,
    currency: 'USD' as const,
    price,
  });
  const stock = (id: string, tokens: IMarketBannerItem['tokens']) =>
    makeBanner({
      _id: id,
      type: EMarketBannerType.Stock,
      tokenListId: id,
      tokens,
    });
  const symbols = (banner: IMarketBannerItem) =>
    banner.tokens?.map((token) => token.symbol);
  beforeEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
  });

  it.each(['stock', 'token', 'evm', 'legacy'])(
    'does not mix quotes for duplicate symbols (%s identity)',
    async (kind) => {
      const isEvm = kind === 'evm';
      const isToken = isEvm || kind === 'token';
      const networkId = isEvm ? 'evm--1' : 'sol--101';
      const addresses = isEvm
        ? [
            '0x52908400098527886E0F7030069857D2E4169EE7',
            '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
          ]
        : [
            'So11111111111111111111111111111111111111112',
            'so11111111111111111111111111111111111111112',
          ];
      const tokens = ['2', '1'].map((change, index) => ({
        ...preview('SAME', change),
        stockId: kind === 'stock' ? String(index) : undefined,
        networkId: isToken ? networkId : undefined,
        address: isToken ? addresses[index] : undefined,
        logo: `preview-${index}.png`,
      }));
      const quotes = tokens.map((token, index) => ({
        ...asset('SAME', token.priceChange24hPercent, String((index + 1) * 10)),
        stockId: String(index),
        networkId,
        address: isEvm ? addresses[index].toLowerCase() : addresses[index],
        decimals: 9,
        logoUrl: `quote-${index}.png`,
      }));
      mockResult = [
        makeBanner({
          type: isToken ? EMarketBannerType.Ticker : EMarketBannerType.Stock,
          tokens,
        }),
      ];
      jest
        .mocked(fetchMarketBannerStockTokenListForPlatform)
        .mockResolvedValue(quotes);
      jest
        .mocked(fetchMarketBannerTokenListForPlatform)
        .mockResolvedValue(quotes);
      const { result, rerender } = renderHook(() => useMarketBannerList());
      await act(async () => {
        await mockHydrate();
      });
      expect(result.current.bannerList[0].tokens).toMatchObject(
        tokens.map((token, index) => ({
          logo: token.logo,
          price: kind === 'legacy' ? '1' : String((index + 1) * 10),
        })),
      );
      mockResult = [{ ...mockResult[0] }];
      rerender();
      await act(async () => {
        await mockHydrate();
      });
      expect(result.current.bannerList[0].tokens).toMatchObject(
        quotes.map((token, index) => ({
          price: token.price,
          logo: kind === 'legacy' ? token.logoUrl : tokens[index].logo,
        })),
      );
    },
  );

  it('updates fast cards independently, preserving first rows until the next refresh', async () => {
    const fast = stock('fast', [
      preview('B', '2'),
      preview('A', '3'),
      preview('C', '1'),
    ]);
    const slow = stock('slow', [preview('S', '1')]);
    mockResult = [fast, slow];
    const pending = deferred<ReturnType<typeof asset>[]>();
    const firstQuotes = [asset('A', '0'), asset('B', '10'), asset('D', '20')];
    jest
      .mocked(fetchMarketBannerStockTokenListForPlatform)
      .mockImplementation((id) =>
        id === 'slow' ? pending.promise : Promise.resolve(firstQuotes),
      );
    const { result, rerender } = renderHook(() => useMarketBannerList());
    expect(result.current.isFetched).toBe(true);
    expect(symbols(result.current.bannerList[0])).toEqual(['A', 'B', 'C']);
    const hydration = mockHydrate();
    await waitFor(() =>
      expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
        price: '100',
        priceChange24hPercent: '0',
        logo: 'A.png',
      }),
    );
    expect(symbols(result.current.bannerList[0])).toEqual(['A', 'B', 'C']);
    expect(result.current.bannerList[1].tokens?.[0].price).toBe('1');
    await act(async () => {
      pending.reject(new Error('offline'));
      await hydration;
    });
    expect(result.current.bannerList[1].tokens?.[0].price).toBe('1');
    mockResult = [{ ...fast }, { ...slow }];
    rerender();
    jest
      .mocked(fetchMarketBannerStockTokenListForPlatform)
      .mockResolvedValue(firstQuotes);
    await act(async () => {
      await mockHydrate();
    });
    expect(symbols(result.current.bannerList[0])).toEqual(['D', 'B', 'A']);
  });

  it.each([false, true])(
    'ignores a slow card result after a new response (locale change=%s)',
    async (changeLocale) => {
      const old = stock('old', [preview('A', '1')]);
      mockResult = [old];
      const pending = deferred<ReturnType<typeof asset>[]>();
      jest
        .mocked(fetchMarketBannerStockTokenListForPlatform)
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue([asset('B', '2', '200')]);
      const { result, rerender } = renderHook(() => useMarketBannerList());
      const oldHydration = mockHydrate();
      if (changeLocale) {
        mockLocale = 'zh-CN';
        mockResultScope = 'zh-CN:false';
      }
      mockResult = [{ ...old, tokens: [preview('B', '2')] }];
      rerender();
      await act(async () => {
        await mockHydrate();
      });
      await act(async () => {
        pending.resolve([asset('A', '1')]);
        await oldHydration;
      });
      expect(result.current.bannerList[0].tokens?.[0]).toMatchObject({
        symbol: 'B',
        price: '200',
      });
    },
  );

  it('keeps legacy cards without token previews on their existing layout', async () => {
    mockResult = [makeBanner({ tokenListId: '' })];
    const { result } = renderHook(() => useMarketBannerList());
    await act(async () => {
      await mockHydrate();
    });
    expect(result.current.bannerList[0].tokens).toBeUndefined();
  });

  it('preserves inline perps ordering before and after hydration', async () => {
    const expected = ['NATGAS', 'BRENT', 'CL'];
    mockResult = [
      makeBanner({
        type: EMarketBannerType.Perps,
        tokens: [
          preview('CL', '1'),
          preview('NATGAS', '3'),
          preview('BRENT', '2'),
        ],
      }),
    ];
    const { result } = renderHook(() => useMarketBannerList());
    expect(symbols(result.current.bannerList[0])).toEqual(expected);
    await act(async () => {
      await mockHydrate();
    });
    expect(symbols(result.current.bannerList[0])).toEqual(expected);
  });

  it('shows hydrated rows when the first preview has no tokens', async () => {
    mockResult = [stock('empty', [])];
    jest
      .mocked(fetchMarketBannerStockTokenListForPlatform)
      .mockResolvedValue([asset('A', '1'), asset('B', '2')]);
    const { result } = renderHook(() => useMarketBannerList());
    await act(async () => {
      await mockHydrate();
    });
    expect(symbols(result.current.bannerList[0])).toEqual(['B', 'A']);
  });
});
