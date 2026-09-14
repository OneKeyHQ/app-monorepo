/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';
import { useMarketBannerList } from './useMarketBannerList';

let mockReachable = true;

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual(
    '../../../../../../../components/src/hooks/useDeferredPromise',
  );
  return {
    useDeferredPromise,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: mockReachable }),
  };
});
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
  default: { isWeb: true, isNative: false },
}));
jest.mock('./marketBannerListPlatformApi', () => ({
  fetchMarketBannerListForPlatform: jest.fn(),
}));

it('handles a cold-start banner failure and retries on reconnect', async () => {
  const fetchBanners = jest.mocked(fetchMarketBannerListForPlatform);
  fetchBanners.mockRejectedValueOnce(new Error('banner service unavailable'));
  fetchBanners.mockResolvedValueOnce([]);

  const { result, rerender } = renderHook(() => useMarketBannerList());
  await waitFor(() => expect(fetchBanners).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.bannerList).toEqual([]);
  expect(result.current.isFetched).toBe(false);

  mockReachable = false;
  rerender();
  mockReachable = true;
  rerender();

  await waitFor(() => expect(fetchBanners).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.isFetched).toBe(true));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.bannerList).toEqual([]);
});
