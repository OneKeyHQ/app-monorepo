/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
} from './marketBannerListPlatformApi';
import { useMarketBannerList } from './useMarketBannerList';

let mockOnline = true;
let mockLocale = 'en-US';
let mockEnabled = false;
const mockCache = new Map<string, { data: unknown; updatedAt: number }>();

beforeEach(() => {
  mockOnline = true;
  mockLocale = 'en-US';
  mockEnabled = false;
  platformEnv.isNative = false;
  mockCache.clear();
  jest.mocked(fetchMarketBannerListForPlatform).mockReset();
});

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../../components/src/hooks/useDeferredPromise'),
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isRawInternetReachable: mockOnline }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    { enabled: mockEnabled, settings: { enableMockMarketBanner: mockEnabled } },
  ],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {
    getWithTimestamp: (key: string) => mockCache.get(key),
    set: jest.fn((key: string, data: unknown) => {
      mockCache.set(key, {
        data: JSON.parse(JSON.stringify(data)) as unknown,
        updatedAt: Date.now(),
      });
    }),
  },
  swrKeys: {
    marketHomeBanners: (locale: string, mock: boolean) => `${locale}:${mock}`,
  },
}));
jest.mock('./marketBannerListPlatformApi', () => ({
  fetchMarketBannerListForPlatform: jest.fn(),
  fetchMarketBannerStockTokenListForPlatform: jest.fn().mockResolvedValue([]),
  fetchMarketBannerTokenListForPlatform: jest.fn().mockResolvedValue([]),
}));

it('settles a failed banner request and retries successfully on reconnect', async () => {
  mockOnline = true;
  const fetchBanners = jest.mocked(fetchMarketBannerListForPlatform);
  fetchBanners.mockRejectedValueOnce(new Error('Banner API unavailable'));
  fetchBanners.mockResolvedValueOnce([]);

  const { result, rerender } = renderHook(() => useMarketBannerList());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.bannerList).toEqual([]);
  expect(result.current.isFetched).toBe(false);

  act(() => {
    mockOnline = false;
    rerender();
  });
  act(() => {
    mockOnline = true;
    rerender();
  });
  await waitFor(() => expect(result.current.isFetched).toBe(true));
  expect(fetchBanners).toHaveBeenCalledTimes(2);
  expect(result.current.isLoading).toBe(false);
});

it('preserves successful banners on a failed reconnect and accepts a later empty response', async () => {
  const banners = [
    {
      _id: 'banner-1',
      title: 'Market',
      rank: 1,
      mode: 1,
      payload: '',
      miniBundlerVersion: '',
      backgroundColor: '',
      tokenListId: 'market',
    },
  ];
  const fetchBanners = jest.mocked(fetchMarketBannerListForPlatform);
  fetchBanners.mockResolvedValueOnce(banners);
  const { result, rerender } = renderHook(() => useMarketBannerList());
  await waitFor(() =>
    expect(result.current.bannerList).toEqual(
      banners.map((banner) => ({ ...banner, tokens: [] })),
    ),
  );

  fetchBanners.mockRejectedValueOnce(new Error('offline'));
  act(() => {
    mockOnline = false;
    rerender();
  });
  act(() => {
    mockOnline = true;
    rerender();
  });
  await waitFor(() => expect(fetchBanners).toHaveBeenCalledTimes(2));
  expect(result.current.bannerList).toEqual(
    banners.map((banner) => ({ ...banner, tokens: [] })),
  );
  expect(result.current.isFetched).toBe(true);
  expect(result.current.isLoading).toBe(false);

  fetchBanners.mockResolvedValueOnce([]);
  act(() => {
    mockOnline = false;
    rerender();
  });
  act(() => {
    mockOnline = true;
    rerender();
  });
  await waitFor(() => expect(result.current.bannerList).toEqual([]));
  expect(result.current.isFetched).toBe(true);
});

it('replays hydrated native quotes on remount while raw refresh and quotes are pending', async () => {
  platformEnv.isNative = true;
  const banners = [
    {
      _id: 'stock',
      title: 'Stocks',
      rank: 1,
      mode: 4,
      payload: '',
      miniBundlerVersion: '',
      backgroundColor: '',
      tokenListId: 'stocks',
      type: EMarketBannerType.Stock,
    },
  ];
  jest.mocked(fetchMarketBannerListForPlatform).mockResolvedValue(banners);
  jest.mocked(fetchMarketBannerStockTokenListForPlatform).mockResolvedValue([
    {
      stockId: 'apple',
      name: 'Apple',
      symbol: 'AAPL',
      logoUrl: '',
      price: '100',
      priceChange24hPercent: '1',
      assetType: 'stock',
      currency: 'USD',
    },
  ]);
  const first = renderHook(() => useMarketBannerList());
  await waitFor(() =>
    expect(first.result.current.bannerList[0]?.tokens?.[0].price).toBe('100'),
  );
  expect(swrCacheUtils.set).toHaveBeenLastCalledWith(
    'en-US:false',
    first.result.current.bannerList,
  );
  first.unmount();
  jest
    .mocked(fetchMarketBannerStockTokenListForPlatform)
    .mockReturnValue(new Promise(() => {}));
  jest
    .mocked(fetchMarketBannerListForPlatform)
    .mockResolvedValue(
      banners.map((banner) => ({ ...banner, title: 'Refreshed' })),
    );
  const second = renderHook(() => useMarketBannerList());
  expect(second.result.current.bannerList[0].tokens?.[0].price).toBe('100');
  expect(second.result.current.isLoading).toBe(false);
  await waitFor(() =>
    expect(second.result.current.bannerList[0].title).toBe('Refreshed'),
  );
  expect(second.result.current.bannerList[0].tokens?.[0].price).toBe('100');
  expect(swrCacheUtils.set).toHaveBeenLastCalledWith(
    'en-US:false',
    second.result.current.bannerList,
  );
});

it.each(['locale', 'mock'])(
  'rejects stale base data when switching %s and the new request fails',
  async (setting) => {
    const oldBanners = [
      {
        _id: 'old',
        title: 'English',
        rank: 1,
        mode: 4,
        payload: '',
        miniBundlerVersion: '',
        backgroundColor: '',
        tokenListId: 'old',
        type: EMarketBannerType.Perps,
      },
    ];
    const fetchBanners = jest.mocked(fetchMarketBannerListForPlatform);
    fetchBanners.mockResolvedValueOnce(oldBanners);
    const { result, rerender } = renderHook(() => useMarketBannerList());
    await waitFor(() => expect(result.current.bannerList).toEqual(oldBanners));
    let rejectNew: (reason: Error) => void = () => {};
    fetchBanners.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectNew = reject;
      }),
    );
    act(() => {
      if (setting === 'locale') mockLocale = 'zh-CN';
      else mockEnabled = true;
      rerender();
    });
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isFetched).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(fetchBanners).toHaveBeenCalledTimes(2));
    await act(async () => {
      rejectNew(new Error('new scope offline'));
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isFetched).toBe(false);
    const newBanners = oldBanners.map((banner) => ({
      ...banner,
      title: 'New scope',
    }));
    fetchBanners.mockResolvedValueOnce(newBanners);
    act(() => {
      mockOnline = false;
      rerender();
    });
    act(() => {
      mockOnline = true;
      rerender();
    });
    await waitFor(() => expect(result.current.bannerList).toEqual(newBanners));
    expect(result.current.isFetched).toBe(true);
  },
);

it.each(['locale', 'mock'])(
  'does not persist a foreign native cache after switching %s during a pending fetch',
  async (setting) => {
    platformEnv.isNative = true;
    const cached = [
      {
        _id: 'cached',
        title: 'English cache',
        rank: 1,
        mode: 4,
        payload: '',
        miniBundlerVersion: '',
        backgroundColor: '',
        tokenListId: 'cached',
        type: EMarketBannerType.Perps,
      },
    ];
    mockCache.set('en-US:false', { data: cached, updatedAt: Date.now() });
    const fetchBanners = jest.mocked(fetchMarketBannerListForPlatform);
    let resolveOld: (value: typeof cached) => void = () => {};
    fetchBanners.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { result, rerender, unmount } = renderHook(() =>
      useMarketBannerList(),
    );
    expect(result.current.bannerList).toEqual(cached);
    await waitFor(() => expect(fetchBanners).toHaveBeenCalledTimes(1));
    fetchBanners.mockRejectedValueOnce(new Error('new scope offline'));
    act(() => {
      if (setting === 'locale') mockLocale = 'zh-CN';
      else mockEnabled = true;
      rerender();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bannerList).toEqual([]);
    expect(result.current.isFetched).toBe(false);
    const newKey = setting === 'locale' ? 'zh-CN:false' : 'en-US:true';
    expect(mockCache.has(newKey)).toBe(false);
    await act(async () => {
      resolveOld(cached);
    });
    expect(result.current.bannerList).toEqual([]);
    expect(mockCache.has(newKey)).toBe(false);
    unmount();
    fetchBanners.mockRejectedValueOnce(new Error('still offline'));
    const next = renderHook(() => useMarketBannerList());
    expect(next.result.current.bannerList).toEqual([]);
    await waitFor(() => expect(next.result.current.isLoading).toBe(false));
    expect(next.result.current.isFetched).toBe(false);
    expect(mockCache.has(newKey)).toBe(false);
  },
);
