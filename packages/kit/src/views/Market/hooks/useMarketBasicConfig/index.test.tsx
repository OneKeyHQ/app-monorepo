/** @jest-environment jsdom */

import { useMarketBasicConfig } from '.';

import { renderHook } from '@testing-library/react';

const mockUsePromiseResult = jest.fn((..._args: unknown[]) => ({
  result: undefined,
  isLoading: false,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => mockUsePromiseResult(...args),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
  },
}));

jest.mock('./fetchMarketBasicConfigForPlatform', () => ({
  fetchMarketBasicConfigForPlatform: jest.fn(),
}));

describe('useMarketBasicConfig', () => {
  beforeEach(() => {
    mockUsePromiseResult.mockClear();
  });

  it('uses safe defaults when the optional config request fails', () => {
    const { result } = renderHook(() => useMarketBasicConfig());

    expect(mockUsePromiseResult).toHaveBeenCalledWith(
      expect.any(Function),
      [],
      expect.objectContaining({
        undefinedResultIfError: true,
      }),
    );
    expect(result.current).toMatchObject({
      basicConfig: undefined,
      defaultNetworkId: undefined,
      recommendedTokens: [],
      minLiquidity: 5000,
      refreshInterval: 5,
      formattedMinLiquidity: '5K',
      networkList: [],
      homeTab: [],
      perpsCategories: [],
      spotCategories: [],
      stockCategories: [],
    });
  });
});
