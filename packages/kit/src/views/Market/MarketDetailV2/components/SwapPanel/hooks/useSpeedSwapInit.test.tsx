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

const disabledConfig: ISpeedSwapConfig = {
  ...cachedConfig,
  provider: '',
  speedConfig: {
    ...cachedConfig.speedConfig,
    spenderAddress: '',
    defaultTokens: [],
    defaultLimitTokens: [],
  },
  supportSpeedSwap: false,
};

const unavailableConfig: ISpeedSwapConfig = {
  ...disabledConfig,
  speedDefaultSelectToken: cachedConfig.speedConfig.defaultTokens[0],
  unavailable: true,
};

const missingSupportConfig: ISpeedSwapConfig = {
  ...disabledConfig,
  supportSpeedSwap: undefined,
};

describe('useSpeedSwapInit cold display config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    swrCacheUtils.remove(swrKeys.swapStockSpeedConfig({ networkId: 'evm--1' }));
    swrCacheUtils.remove(
      swrKeys.swapStockSpeedConfig({ networkId: 'evm--56' }),
    );
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
      config: ISpeedSwapConfig;
      fromCache?: boolean;
      scope?: string;
    }>;
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      swrShouldPersist: (value: { fromCache?: boolean }) => boolean;
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

  it('keeps the last-good SWR value when the service returns its unavailable config', async () => {
    swrCacheUtils.set(swrKeys.swapStockSpeedConfig({ networkId: 'evm--1' }), {
      config: cachedConfig,
      scope: 'evm--1',
    });
    mockFetchSpeedSwapConfig.mockResolvedValueOnce(unavailableConfig);
    renderHook(() => useSpeedSwapInit('evm--1'));

    const request = mockUsePromiseResult.mock.calls[0]?.[0] as () => Promise<{
      config: ISpeedSwapConfig;
      fromCache?: boolean;
      scope?: string;
    }>;
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      swrShouldPersist: (value: { fromCache?: boolean }) => boolean;
    };
    const failedResult = await request();

    expect(failedResult).toEqual({
      config: cachedConfig,
      fromCache: true,
      scope: 'evm--1',
    });
    expect(options.swrShouldPersist(failedResult)).toBe(false);
  });

  it('falls back to the Swap default pair when no last-good config exists', async () => {
    mockFetchSpeedSwapConfig.mockResolvedValueOnce(unavailableConfig);
    renderHook(() => useSpeedSwapInit('evm--56'));

    const request = mockUsePromiseResult.mock.calls[0]?.[0] as () => Promise<{
      config: ISpeedSwapConfig;
      fromCache?: boolean;
      scope?: string;
    }>;
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      swrShouldPersist: (value: { fromCache?: boolean }) => boolean;
    };
    const failedResult = await request();

    expect(failedResult.config.supportSpeedSwap).toBe(false);
    expect(
      failedResult.config.speedConfig.defaultTokens.map((token) => ({
        networkId: token.networkId,
        symbol: token.symbol,
      })),
    ).toEqual([
      { networkId: 'evm--56', symbol: 'BNB' },
      { networkId: 'evm--56', symbol: 'USDC' },
    ]);
    expect(failedResult.config.speedDefaultSelectToken?.networkId).toBe(
      'evm--56',
    );
    expect(failedResult.config.speedDefaultSelectToken?.symbol).toBe('USDC');
    expect(options.swrShouldPersist(failedResult)).toBe(false);
  });

  it('normalizes a missing support decision to the Swap fallback', async () => {
    mockFetchSpeedSwapConfig.mockResolvedValueOnce(missingSupportConfig);
    renderHook(() => useSpeedSwapInit('evm--1'));

    const request = mockUsePromiseResult.mock.calls[0]?.[0] as () => Promise<{
      config: ISpeedSwapConfig;
      fromCache?: boolean;
      scope?: string;
    }>;
    const missingSupportResult = await request();

    expect(missingSupportResult.config.supportSpeedSwap).toBe(false);
    expect(
      missingSupportResult.config.speedConfig.defaultTokens.map(
        (token) => token.symbol,
      ),
    ).toEqual(['ETH', 'USDC']);
  });

  it('replaces the cached config when the service explicitly disables swap', async () => {
    swrCacheUtils.set(swrKeys.swapStockSpeedConfig({ networkId: 'evm--1' }), {
      config: cachedConfig,
      scope: 'evm--1',
    });
    mockFetchSpeedSwapConfig.mockResolvedValueOnce(disabledConfig);
    renderHook(() => useSpeedSwapInit('evm--1'));

    const request = mockUsePromiseResult.mock.calls[0]?.[0] as () => Promise<{
      config: ISpeedSwapConfig;
      fromCache?: boolean;
      scope?: string;
    }>;
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      swrShouldPersist: (value: { fromCache?: boolean }) => boolean;
    };
    const disabledResult = await request();

    expect(disabledResult.config).toEqual(
      expect.objectContaining({
        supportSpeedSwap: false,
        speedConfig: expect.objectContaining({
          defaultTokens: expect.arrayContaining([
            expect.objectContaining({ symbol: 'ETH' }),
            expect.objectContaining({ symbol: 'USDC' }),
          ]),
        }),
      }),
    );
    expect(disabledResult.scope).toBe('evm--1');
    expect(options.swrShouldPersist(disabledResult)).toBe(true);
  });
});
