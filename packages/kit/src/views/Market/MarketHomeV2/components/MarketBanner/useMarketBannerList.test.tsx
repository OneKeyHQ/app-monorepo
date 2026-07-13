/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useMarketBannerList } from './useMarketBannerList';

const mockUsePromiseResult = jest.fn((..._args: unknown[]) => ({
  result: undefined,
  isLoading: false,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => mockUsePromiseResult(...args),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: false,
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
  },
}));

jest.mock('./marketBannerListPlatformApi', () => ({
  fetchMarketBannerListForPlatform: jest.fn(),
}));

describe('useMarketBannerList', () => {
  beforeEach(() => {
    mockUsePromiseResult.mockClear();
  });

  it('uses an empty banner list when the optional request fails', () => {
    const { result } = renderHook(() => useMarketBannerList());

    expect(mockUsePromiseResult).toHaveBeenCalledWith(
      expect.any(Function),
      [false],
      expect.objectContaining({
        undefinedResultIfError: true,
      }),
    );
    expect(result.current).toEqual({
      bannerList: [],
      isLoading: false,
      isFetched: false,
    });
  });
});
