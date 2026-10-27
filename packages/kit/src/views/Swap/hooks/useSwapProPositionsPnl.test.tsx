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
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(6);
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
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(6);
    rerender({ displayed: tokens });
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(10);
    while (complete.length > 0) {
      await act(async () => {
        complete.splice(0).forEach((resolve) => resolve());
      });
    }
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

  it('hides the previous account PnL immediately while the next account is pending', async () => {
    const pnl = {
      isPnlSupported: true,
      totalPnlUsd: '12',
      totalPnlPercent: '6',
      unrealizedPnlUsd: '8',
      unrealizedPnlPercent: '4',
    };
    mockFetchPortfolio.mockResolvedValue({
      list: [
        {
          accountAddress: 'account-a',
          tokenAddress: tokens[0].contractAddress,
          amount: '2',
          symbol: 'T0',
          tokenPrice: '100',
          totalPrice: '200',
          pnl,
        },
      ],
    });
    const { result, rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 1) } },
    );
    await flushRequests();
    expect(result.current.get('evm--1-token-0')).toEqual(pnl);
    mockFetchPortfolio.mockImplementation(() => new Promise(() => {}));
    rerender({ displayed: [{ ...tokens[0], accountAddress: 'account-b' }] });
    expect(result.current.size).toBe(0);
    await flushRequests();
    expect(result.current.size).toBe(0);
    unmount();
  });

  it('deduplicates a holding needed by both consumers and clears removed PnL immediately', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: [tokens[0], { ...tokens[0] }] } },
    );
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(1);
    rerender({ displayed: [] });
    expect(result.current.size).toBe(0);
    await flushRequests();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('skips queued reads from the previous account before sending the next account requests', async () => {
    const complete: Array<() => void> = [];
    mockFetchPortfolio.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete.push(() => resolve({ list: [] }));
        }),
    );
    const { rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 8) } },
    );
    await flushRequests();
    expect(mockFetchPortfolio).toHaveBeenCalledTimes(4);
    rerender({ displayed: [{ ...tokens[0], accountAddress: 'account-b' }] });
    await flushRequests();
    await act(async () => {
      complete.splice(0).forEach((resolve) => resolve());
    });
    expect(
      mockFetchPortfolio.mock.calls.map(([p]) => p.accountAddress),
    ).toEqual([
      'account-a',
      'account-a',
      'account-a',
      'account-a',
      'account-b',
    ]);
    unmount();
    await act(async () => {
      complete.splice(0).forEach((resolve) => resolve());
    });
  });

  it('publishes completed PnL and keeps polling while an unrelated holding is slow', async () => {
    const pnl = {
      isPnlSupported: true,
      totalPnlUsd: '1',
      totalPnlPercent: '1',
      unrealizedPnlUsd: '1',
      unrealizedPnlPercent: '1',
    };
    let finishSlow: (() => void) | undefined;
    mockFetchPortfolio.mockImplementation((p) =>
      p.tokenAddress === tokens[0].contractAddress
        ? Promise.resolve({
            list: [
              {
                accountAddress: p.accountAddress,
                tokenAddress: p.tokenAddress,
                symbol: 'T0',
                amount: '1',
                tokenPrice: '1',
                totalPrice: '1',
                pnl,
              },
            ],
          })
        : new Promise((resolve) => {
            finishSlow = () => resolve({ list: [] });
          }),
    );
    const { result, unmount } = renderHook(() =>
      useSwapProPositionsPnl(tokens.slice(0, 2)),
    );
    await flushRequests();
    expect(result.current.get('evm--1-token-0')).toEqual(pnl);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(
      mockFetchPortfolio.mock.calls.filter(
        ([p]) => p.tokenAddress === tokens[0].contractAddress,
      ),
    ).toHaveLength(2);
    expect(
      mockFetchPortfolio.mock.calls.filter(
        ([p]) => p.tokenAddress === tokens[1].contractAddress,
      ),
    ).toHaveLength(1);
    unmount();
    await act(async () => {
      finishSlow?.();
    });
  });

  it('ignores a late PnL response from the previous account', async () => {
    const response = (address: string, value: string) => ({
      list: [
        {
          accountAddress: address,
          tokenAddress: tokens[0].contractAddress,
          symbol: 'T0',
          amount: '1',
          tokenPrice: '1',
          totalPrice: '1',
          pnl: {
            isPnlSupported: true,
            totalPnlUsd: value,
            totalPnlPercent: value,
            unrealizedPnlUsd: value,
            unrealizedPnlPercent: value,
          },
        },
      ],
    });
    let finishA: (() => void) | undefined;
    mockFetchPortfolio.mockImplementation((p) =>
      p.accountAddress === 'account-a'
        ? new Promise((resolve) => {
            finishA = () => resolve(response('account-a', '10'));
          })
        : Promise.resolve(response('account-b', '20')),
    );
    const { result, rerender, unmount } = renderHook(
      ({ displayed }) => useSwapProPositionsPnl(displayed),
      { initialProps: { displayed: tokens.slice(0, 1) } },
    );
    await flushRequests();
    rerender({ displayed: [{ ...tokens[0], accountAddress: 'account-b' }] });
    await flushRequests();
    expect(result.current.get('evm--1-token-0')?.totalPnlUsd).toBe('20');
    await act(async () => {
      finishA?.();
    });
    expect(result.current.get('evm--1-token-0')?.totalPnlUsd).toBe('20');
    unmount();
  });
});
