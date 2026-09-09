/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';
import { useMarketBannerList } from './useMarketBannerList';

let mockOnline = true;

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
