/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react-native';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapStockTokenDetail } from './useSwapStockTokenDetail';

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
    mockFetchMarketTokenDetail.mockReset();
    mockFetchMarketTokenDetail.mockResolvedValue({
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
          requireCurrentActivation: true,
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
    expect(result.current.latestFetchSucceeded).toBe(true);
    const firstFetchedAt = result.current.fetchedAt;
    expect(firstFetchedAt).toBeDefined();

    await tick(10_000);
    expect(mockFetchMarketTokenDetail.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.fetchedAt).toBeGreaterThan(firstFetchedAt ?? 0);

    rerender({ enabled: false });
    await tick(0);
    const callsAfterDisable = mockFetchMarketTokenDetail.mock.calls.length;

    await tick(30_000);
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(callsAfterDisable);
    unmount();
  });

  it('keeps last-good current-activation data without treating a failed poll as successful', async () => {
    mockFetchMarketTokenDetail
      .mockResolvedValueOnce({
        data: {
          perpsInfo: {
            hlTicker: 'AAPL',
          },
          token: {
            address: stockToken.contractAddress,
            stock: {
              isOpen: true,
            },
          },
        },
      })
      .mockRejectedValueOnce(new Error('transient Market failure'))
      .mockResolvedValueOnce({
        data: {
          perpsInfo: {
            hlTicker: 'AAPL',
          },
          token: {
            address: stockToken.contractAddress,
            stock: {
              description: 'Reopens in 2h',
              isOpen: false,
            },
          },
        },
      });

    const { result, unmount } = renderHook(() =>
      useSwapStockTokenDetail({
        enabled: true,
        requireCurrentActivation: true,
        token: stockToken,
      }),
    );

    await tick(0);
    const firstFetchedAt = result.current.fetchedAt;
    expect(result.current.latestFetchSucceeded).toBe(true);
    expect(result.current.tokenDetail?.stock?.isOpen).toBe(true);

    await tick(10_000);
    expect(result.current.pending).toBe(false);
    expect(result.current.latestFetchSucceeded).toBe(false);
    expect(result.current.fetchedAt).toBe(firstFetchedAt);
    expect(result.current.tokenDetail?.stock?.isOpen).toBe(true);

    await tick(10_000);
    expect(result.current.latestFetchSucceeded).toBe(true);
    expect(result.current.fetchedAt).toBeGreaterThan(firstFetchedAt ?? 0);
    expect(result.current.tokenDetail?.stock?.isOpen).toBe(false);
    unmount();
  });

  it('keeps a restrictive last-good status until its TTL expires', async () => {
    mockFetchMarketTokenDetail
      .mockResolvedValueOnce({
        data: {
          token: {
            address: stockToken.contractAddress,
            stock: {
              isPaused: true,
              isOpen: true,
            },
          },
        },
      })
      .mockRejectedValue(new Error('Market unavailable'));

    const { result, unmount } = renderHook(() =>
      useSwapStockTokenDetail({
        enabled: true,
        requireCurrentActivation: true,
        token: stockToken,
      }),
    );

    await tick(0);
    expect(result.current.tokenDetail?.stock?.isPaused).toBe(true);

    for (let elapsed = 10_000; elapsed <= 60_000; elapsed += 10_000) {
      await tick(10_000);
      expect(result.current.pending).toBe(false);
      expect(result.current.latestFetchSucceeded).toBe(false);
      expect(result.current.tokenDetail?.stock?.isPaused).toBe(true);
    }

    await tick(10_000);
    expect(result.current.pending).toBe(false);
    expect(result.current.latestFetchSucceeded).toBe(false);
    expect(result.current.tokenDetail).toBeUndefined();
    unmount();
  });

  it('keeps a cached success pending until the current activation resolves', async () => {
    const { result, rerender, unmount } = renderHook<
      ReturnType<typeof useSwapStockTokenDetail>,
      { enabled: boolean }
    >(
      ({ enabled }) =>
        useSwapStockTokenDetail({
          enabled,
          requireCurrentActivation: true,
          token: stockToken,
        }),
      {
        initialProps: {
          enabled: true,
        },
      },
    );

    await tick(0);
    expect(result.current.latestFetchSucceeded).toBe(true);

    rerender({ enabled: false });
    await tick(0);

    let resolveCurrentActivation: (value: unknown) => void = () => {};
    mockFetchMarketTokenDetail.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveCurrentActivation = resolve;
        }),
    );
    rerender({ enabled: true });
    await tick(0);

    expect(result.current.pending).toBe(true);
    expect(result.current.latestFetchSucceeded).toBe(false);
    expect(result.current.tokenDetail).toBeUndefined();

    resolveCurrentActivation({
      data: {
        token: {
          address: stockToken.contractAddress,
          stock: {
            isOpen: false,
          },
        },
      },
    });
    await tick(0);

    expect(result.current.pending).toBe(false);
    expect(result.current.latestFetchSucceeded).toBe(true);
    expect(result.current.tokenDetail?.stock?.isOpen).toBe(false);
    unmount();
  });

  it('does not land an old same-mount fallback in a new activation', async () => {
    mockFetchMarketTokenDetail.mockRejectedValueOnce(
      new Error('initial Market failure'),
    );
    const { result, rerender, unmount } = renderHook<
      ReturnType<typeof useSwapStockTokenDetail>,
      { enabled: boolean }
    >(
      ({ enabled }) =>
        useSwapStockTokenDetail({
          enabled,
          requireCurrentActivation: true,
          token: stockToken,
        }),
      {
        initialProps: {
          enabled: true,
        },
      },
    );

    await tick(0);
    expect(result.current.pending).toBe(false);
    expect(result.current.latestFetchSucceeded).toBe(false);

    rerender({ enabled: false });
    await tick(0);

    let resolveCurrentActivation: (value: unknown) => void = () => {};
    mockFetchMarketTokenDetail.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveCurrentActivation = resolve;
        }),
    );
    rerender({ enabled: true });
    await tick(0);

    expect(result.current.pending).toBe(true);
    expect(result.current.latestFetchSucceeded).toBe(false);

    resolveCurrentActivation({
      data: {
        token: {
          address: stockToken.contractAddress,
          stock: {
            isOpen: false,
          },
        },
      },
    });
    await tick(0);

    expect(result.current.pending).toBe(false);
    expect(result.current.latestFetchSucceeded).toBe(true);
    unmount();
  });

  it('does not expose perps data for a non-stock token detail response', async () => {
    mockFetchMarketTokenDetail.mockResolvedValue({
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
