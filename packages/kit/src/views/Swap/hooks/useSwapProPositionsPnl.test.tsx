/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketAccountPortfolioResponse } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapProPositionsPnl } from './useSwapProPositionsPnl';

const mockFetchPortfolio = jest.fn<
  Promise<IMarketAccountPortfolioResponse>,
  [{ networkId: string; accountAddress: string; tokenAddress: string }]
>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: {
        networkId: string;
        accountAddress: string;
        tokenAddress: string;
      }) => mockFetchPortfolio(params),
    },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const { useMemo } = jest.requireActual<typeof import('react')>('react');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise: () =>
      useMemo(
        () => ({
          resolve: () => {},
          reset: () => {},
          promise: Promise.resolve(),
        }),
        [],
      ),
  };
});
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));

const tokens: ISwapToken[] = Array.from({ length: 25 }, (_, index) => ({
  networkId: 'evm--1',
  contractAddress: `token-${index}`,
  accountAddress: 'account-a',
  symbol: `T${index}`,
  name: `Token ${index}`,
  decimals: 18,
}));

async function flushRequests() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

describe('useSwapProPositionsPnl request lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchPortfolio.mockReset();
    mockFetchPortfolio.mockResolvedValue({ list: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches only newly displayed positions and refreshes after 30 seconds', async () => {
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 6) } },
    );
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(6);

    rerender({ displayed: tokens });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(25);

    rerender({ displayed: tokens.slice(0, 6) });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(25);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(31);
    unmount();
  });

  it('shares pending requests and bounds expansion concurrency', async () => {
    const complete: Array<() => void> = [];
    let active = 0;
    let maximumActive = 0;
    mockFetchPortfolio.mockImplementation(
      () =>
        new Promise((resolve) => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          complete.push(() => {
            active -= 1;
            resolve({ list: [] });
          });
        }),
    );
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 6) } },
    );
    await flushRequests();
    rerender({ displayed: tokens });
    rerender({ displayed: tokens.slice(0, 6) });
    await flushRequests();

    while (complete.length > 0) {
      await act(async () => {
        complete.splice(0).forEach((resolve) => resolve());
      });
    }
    expect(maximumActive).toBe(4);
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(25);
    expect(
      mockFetchPortfolio.mock.calls.filter(
        ([params]) => params.tokenAddress === tokens[0].contractAddress,
      ),
    ).toHaveLength(1);
    unmount();
  });

  it('keeps account, network and contract identities separate', async () => {
    const first = tokens[0];
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: [first] } },
    );
    await flushRequests();
    rerender({ displayed: [{ ...first, accountAddress: 'account-b' }] });
    await flushRequests();
    rerender({ displayed: [{ ...first, networkId: 'evm--56' }] });
    await flushRequests();
    rerender({ displayed: [{ ...first, contractAddress: 'another-token' }] });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(4);
    rerender({ displayed: [first] });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(4);
    unmount();
  });

  it('keeps queued requests shared until completion, then starts their freshness window', async () => {
    const complete: Array<() => void> = [];
    mockFetchPortfolio.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete.push(() => resolve({ list: [] }));
        }),
    );
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens } },
    );
    await flushRequests();
    jest.setSystemTime(Date.now() + 30_001);
    rerender({ displayed: tokens.slice(0, 6) });
    await flushRequests();
    while (complete.length > 0) {
      await act(async () => {
        complete.splice(0).forEach((resolve) => resolve());
      });
    }
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(25);
    rerender({ displayed: tokens });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(25);
    unmount();
  });

  it('stops queued service reads after unmount', async () => {
    const complete: Array<() => void> = [];
    mockFetchPortfolio.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete.push(() => resolve({ list: [] }));
        }),
    );
    const { unmount } = renderHook(() => useSwapProPositionsPnl(tokens));
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(4);
    unmount();
    await act(async () => {
      complete.splice(0).forEach((resolve) => resolve());
    });
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(4);
  });

  it('retries failed reads without caching the failure', async () => {
    mockFetchPortfolio.mockRejectedValueOnce(new Error('temporary failure'));
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 1) } },
    );
    await flushRequests();
    rerender({ displayed: tokens.slice(0, 2) });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(3);
    unmount();
  });
});
