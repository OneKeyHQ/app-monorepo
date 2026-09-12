/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';
import { useMarketBannerList } from './useMarketBannerList';

let mockOnline = true;

beforeEach(() => {
  mockOnline = true;
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
  useLocaleVariant: () => 'en-US',
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
  swrKeys: {},
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
  await waitFor(() => expect(result.current.bannerList).toEqual(banners));

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
  expect(result.current.bannerList).toEqual(banners);
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
