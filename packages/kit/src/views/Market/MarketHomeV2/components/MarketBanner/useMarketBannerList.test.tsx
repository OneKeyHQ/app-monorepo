/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

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
let mockRequest: () => Promise<unknown>;
let mockHydrate: () => Promise<unknown>;
let mockEnabled = false;
let mockLiveResult: unknown;
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
    return { result: mockResult, isLoading: mockLoading };
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
  mockEnabled = false;
  mockLiveResult = undefined;
  mockResult = undefined;
  mockLoading = undefined;
  mockLocale = 'en-US';
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
    mockResult = (await mockRequest()) as IMarketBannerItem[];
  });
  rerender();
  void mockHydrate();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.bannerList).toEqual(banners);
});
it('skips remote quotes in mock mode', async () => {
  mockEnabled = true;
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
  mockResult = [makeBanner({ title: '中文' })];
  rerender();
  expect(result.current.bannerList[0].title).toBe('中文');
});

it('preserves a committed cache replay when revalidation fails', async () => {
  mockResult = [];
  const { result } = renderHook(() => useMarketBannerList());
  await act(async () => {
    await expect(mockRequest()).resolves.toBe(mockResult);
  });
  expect(result.current.isFetched).toBe(true);
  expect(result.current.isLoading).toBe(false);
});
