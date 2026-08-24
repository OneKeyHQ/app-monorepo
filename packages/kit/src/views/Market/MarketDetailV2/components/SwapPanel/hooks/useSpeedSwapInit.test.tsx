/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { ISpeedSwapConfig } from '@onekeyhq/shared/types/swap/types';

const mockUsePromiseResult = jest.fn();
const mockFetchSpeedSwapConfig = jest.fn<
  Promise<ISpeedSwapConfig>,
  unknown[]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSpeedSwapConfig: (...args: unknown[]): Promise<ISpeedSwapConfig> =>
        mockFetchSpeedSwapConfig(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]): unknown =>
    mockUsePromiseResult(...args),
}));

const { useSpeedSwapInit } =
  jest.requireActual<typeof import('./useSpeedSwapInit')>('./useSpeedSwapInit');

const cachedConfig: ISpeedSwapConfig = {
  provider: 'provider',
  speedConfig: {
    spenderAddress: '0xspender',
    slippage: 0.5,
    defaultTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        symbol: 'TOKEN',
        decimals: 18,
        logoURI: 'https://example.com/token.png',
      },
    ],
    defaultLimitTokens: [],
    swapMevNetConfig: [],
  },
  supportSpeedSwap: true,
  onlySupportCrossChain: false,
  onlySupportSingleChain: false,
  speedDefaultSelectToken: undefined,
};

describe('useSpeedSwapInit cold display config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    swrCacheUtils.remove(swrKeys.swapStockSpeedConfig({ networkId: 'evm--1' }));
    mockUsePromiseResult.mockReturnValue({
      result: {
        config: cachedConfig,
        scope: 'evm--1',
      },
      isLoading: true,
    });
  });

  it('uses the network-scoped SWR snapshot on the first render', () => {
    const { result } = renderHook(() => useSpeedSwapInit('evm--1'));

    expect(result.current.speedConfigReady).toBe(true);
    expect(result.current.defaultTokens[0]?.logoURI).toBe(
      'https://example.com/token.png',
    );
    expect(mockUsePromiseResult.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        swrKey: 'swapStockSpeedConfig:v1:evm--1',
      }),
    );
  });

  it('does not replace the last-good SWR value when revalidation fails', async () => {
    swrCacheUtils.set(swrKeys.swapStockSpeedConfig({ networkId: 'evm--1' }), {
      config: cachedConfig,
      scope: 'evm--1',
    });
    mockFetchSpeedSwapConfig.mockRejectedValueOnce(new Error('offline'));
    renderHook(() => useSpeedSwapInit('evm--1'));

    const request = mockUsePromiseResult.mock.calls[0]?.[0] as () => Promise<{
      shouldPersist: boolean;
    }>;
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      swrShouldPersist: (value: { shouldPersist: boolean }) => boolean;
    };
    const failedResult = await request();

    expect(failedResult).toEqual(
      expect.objectContaining({
        config: cachedConfig,
        scope: 'evm--1',
      }),
    );
    expect(options.swrShouldPersist(failedResult)).toBe(false);
  });
});
