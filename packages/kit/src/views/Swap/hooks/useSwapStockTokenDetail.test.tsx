/** @jest-environment jsdom */

import * as React from 'react';
import { useRef } from 'react';

import { act, render, renderHook } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapStockTokenDetail } from './useSwapStockTokenDetail';

// The installed React runtime exposes Activity before its published types do.
function isReactActivity(
  value: unknown,
): value is React.ExoticComponent<
  React.PropsWithChildren<{ mode: 'hidden' | 'visible' }>
> {
  return value === Symbol.for('react.activity');
}

const activity: unknown = Reflect.get(React, 'Activity');
if (!isReactActivity(activity)) {
  throw new OneKeyLocalError('The React runtime does not provide Activity');
}
const Activity = activity;

const mockFetchMarketTokenDetail = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenDetailByTokenAddress: (...args: unknown[]) =>
        mockFetchMarketTokenDetail(...args) as Promise<unknown>,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en',
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../components/src/hooks/useDeferredPromise');

  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: () => ({
      isRawInternetReachable: null,
    }),
  };
});

const stockToken: ISwapToken = {
  contractAddress: '0xstock-a',
  decimals: 18,
  isStock: true,
  networkId: 'evm--1',
  symbol: 'AAPLon',
};

const tick = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('useSwapStockTokenDetail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
    mockFetchMarketTokenDetail.mockReset();
    mockFetchMarketTokenDetail.mockResolvedValue({
      code: 0,
      data: {
        perpsInfo: {
          hlTicker: 'AAPL',
        },
        token: {
          address: stockToken.contractAddress,
          stock: {
            description: 'Reopens in 2h',
            isOpen: false,
            sourceLogoUri: '',
            subtitle: 'Apple',
          },
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts immediately when enabled and stops without issuing inactive requests', async () => {
    const { result, rerender, unmount } = renderHook<
      ReturnType<typeof useSwapStockTokenDetail>,
      { enabled: boolean }
    >(
      ({ enabled }) =>
        useSwapStockTokenDetail({
          enabled,
          token: stockToken,
        }),
      {
        initialProps: {
          enabled: false,
        },
      },
    );

    await tick(0);
    expect(mockFetchMarketTokenDetail).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await tick(0);

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      stockToken.contractAddress,
      stockToken.networkId,
      {
        autoHandleError: false,
      },
    );
    expect(result.current.tokenDetail?.stock?.isOpen).toBe(false);
    expect(result.current.perpsInfo?.hlTicker).toBe('AAPL');

    await tick(10_000);
    expect(mockFetchMarketTokenDetail.mock.calls.length).toBeGreaterThan(1);

    rerender({ enabled: false });
    await tick(0);
    const callsAfterDisable = mockFetchMarketTokenDetail.mock.calls.length;

    await tick(30_000);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(callsAfterDisable);
    unmount();
  });

  it('resumes the current stock detail polling after a retained surface reconnects', async () => {
    let currentResult: ReturnType<typeof useSwapStockTokenDetail> | undefined;
    const identities = new Set<object>();
    function StockDetailProbe({ token }: { token: ISwapToken }) {
      const identity = useRef({});
      identities.add(identity.current);
      currentResult = useSwapStockTokenDetail({ token });
      return null;
    }
    const renderActivity = (mode: 'hidden' | 'visible', token: ISwapToken) => (
      <Activity mode={mode}>
        <StockDetailProbe token={token} />
      </Activity>
    );
    const { rerender, unmount } = render(renderActivity('visible', stockToken));
    await tick();
    expect(currentResult?.tokenDetail?.stock?.isOpen).toBe(false);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);

    rerender(renderActivity('hidden', stockToken));
    await tick(65_000);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    rerender(renderActivity('visible', stockToken));
    await tick();

    expect(identities.size).toBe(1);
    const callsAfterReconnect = mockFetchMarketTokenDetail.mock.calls.length;
    expect(callsAfterReconnect).toBeGreaterThan(1);
    expect(currentResult?.pending).toBe(false);
    expect(currentResult?.tokenDetail?.stock?.isOpen).toBe(false);
    await tick(10_000);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(
      callsAfterReconnect + 1,
    );
    await tick(10_000);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(
      callsAfterReconnect + 2,
    );

    const nextToken = { ...stockToken, contractAddress: '0xstock-b' };
    let resolveNext: ((value: unknown) => void) | undefined;
    mockFetchMarketTokenDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
    );
    rerender(renderActivity('visible', nextToken));
    await tick();
    expect(mockFetchMarketTokenDetail).toHaveBeenLastCalledWith(
      nextToken.contractAddress,
      nextToken.networkId,
      { autoHandleError: false },
    );
    expect(currentResult?.pending).toBe(true);
    expect(currentResult?.tokenDetail).toBeUndefined();
    await act(async () => {
      resolveNext?.({
        code: 0,
        data: {
          token: {
            address: nextToken.contractAddress,
            stock: { isOpen: true, sourceLogoUri: '', subtitle: 'Apple' },
          },
        },
      });
    });
    await tick();
    expect(currentResult?.pending).toBe(false);
    expect(currentResult?.tokenDetail?.stock?.isOpen).toBe(true);
    unmount();
  });

  it('retains only the asset relation and preserves token and issuer metadata', async () => {
    const { result, unmount } = renderHook(() =>
      useSwapStockTokenDetail({
        token: {
          ...stockToken,
          stock: {
            stockId: 'AAPL',
            subtitle: 'Apple',
            sourceLogoUri: 'https://example.com/ondo.png',
          },
        },
      }),
    );
    await tick();
    expect(result.current.tokenDetail?.stock).toMatchObject({
      stockId: 'AAPL',
      subtitle: 'Apple',
      sourceLogoUri: '',
    });
    unmount();
  });

  it.each([
    { address: '0xanother-token' },
    { networkId: 'evm--56' },
    {
      stock: {
        stockId: 'NVDA',
        subtitle: 'NVIDIA',
        sourceLogoUri: 'https://example.com/bstock.png',
      },
    },
    { code: 1 },
  ])(
    'rejects an invalid response before it can seed a token-to-asset relation (%j)',
    async (overrides) => {
      const { code = 0, ...tokenOverrides } = overrides;
      mockFetchMarketTokenDetail.mockResolvedValue({
        code,
        data: {
          token: {
            address: stockToken.contractAddress,
            stock: {
              subtitle: 'Apple',
              sourceLogoUri: 'https://example.com/ondo.png',
            },
            ...tokenOverrides,
          },
        },
      });
      const { result, unmount } = renderHook(() =>
        useSwapStockTokenDetail({
          token: {
            ...stockToken,
            stock: { stockId: 'AAPL', subtitle: 'Apple', sourceLogoUri: '' },
          },
        }),
      );
      await tick();
      expect(result.current.tokenDetail).toBeUndefined();
      unmount();
    },
  );

  it('does not expose perps data for a non-stock token detail response', async () => {
    mockFetchMarketTokenDetail.mockResolvedValue({
      code: 0,
      data: {
        perpsInfo: {
          hlTicker: 'NOT_STOCK',
        },
        token: {
          address: stockToken.contractAddress,
        },
      },
    });

    const { result, unmount } = renderHook(() =>
      useSwapStockTokenDetail({
        enabled: true,
        token: stockToken,
      }),
    );

    await tick(0);

    expect(result.current.tokenDetail).toBeUndefined();
    expect(result.current.perpsInfo).toBeUndefined();
    unmount();
  });
});
