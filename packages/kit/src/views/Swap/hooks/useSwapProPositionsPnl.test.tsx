/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketAccountPortfolioPnl,
  IMarketAccountPortfolioResponse,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapProPositionsPnl } from './useSwapProPositionsPnl';

type IFetchMarketAccountPortfolioParams = {
  accountAddress: string;
  networkId: string;
  tokenAddress: string;
};

const mockFetchMarketAccountPortfolio: jest.MockedFunction<
  (
    params: IFetchMarketAccountPortfolioParams,
  ) => Promise<IMarketAccountPortfolioResponse>
> = jest.fn();
const mockUseInterval: jest.MockedFunction<
  (callback: () => void, delay?: number) => void
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (
        params: IFetchMarketAccountPortfolioParams,
      ) => mockFetchMarketAccountPortfolio(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: (callback: () => void, delay?: number) => {
    mockUseInterval(callback, delay);
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function buildToken(accountAddress: string): ISwapToken {
  return {
    networkId: 'evm--1',
    contractAddress: '0xstock',
    accountAddress,
    symbol: 'STOCK',
    decimals: 18,
    isNative: false,
  };
}

function buildPnl(unrealizedPnlUsd: string): IMarketAccountPortfolioPnl {
  return {
    isPnlSupported: true,
    totalPnlUsd: unrealizedPnlUsd,
    totalPnlPercent: '1',
    unrealizedPnlUsd,
    unrealizedPnlPercent: '1',
  };
}

function buildPortfolioResponse({
  accountAddress,
  pnl,
}: {
  accountAddress: string;
  pnl: IMarketAccountPortfolioPnl;
}): IMarketAccountPortfolioResponse {
  return {
    list: [
      {
        accountAddress,
        tokenAddress: '0xstock',
        amount: '1',
        symbol: 'STOCK',
        tokenPrice: '100',
        totalPrice: '100',
        pnl,
      },
    ],
  };
}

describe('useSwapProPositionsPnl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getLatestIntervalCallback() {
    expect(mockUseInterval).toHaveBeenCalled();
    return mockUseInterval.mock.calls.at(-1)?.[0] ?? (() => undefined);
  }

  it('does not expose owner A PnL while owner B is pending', async () => {
    const pnlA = buildPnl('1');
    const pnlB = buildPnl('2');
    const ownerBDeferred = createDeferred<IMarketAccountPortfolioResponse>();
    mockFetchMarketAccountPortfolio.mockImplementation(({ accountAddress }) =>
      accountAddress === '0xowner-a'
        ? Promise.resolve(buildPortfolioResponse({ accountAddress, pnl: pnlA }))
        : ownerBDeferred.promise,
    );
    const { result, rerender } = renderHook(
      ({ ownerKey, tokens }) => useSwapProPositionsPnl(tokens, ownerKey),
      {
        initialProps: {
          ownerKey: 'owner-a__evm--1',
          tokens: [buildToken('0xowner-a')],
        },
      },
    );

    await waitFor(() =>
      expect(result.current.get('evm--1-0xstock')).toBe(pnlA),
    );

    rerender({
      ownerKey: 'owner-b__evm--1',
      tokens: [buildToken('0xowner-b')],
    });
    expect(result.current.size).toBe(0);

    await act(async () => {
      ownerBDeferred.resolve(
        buildPortfolioResponse({
          accountAddress: '0xowner-b',
          pnl: pnlB,
        }),
      );
      await ownerBDeferred.promise;
    });
    await waitFor(() =>
      expect(result.current.get('evm--1-0xstock')).toBe(pnlB),
    );
  });

  it('keeps same-owner last-good PnL visible during refresh', async () => {
    const lastGoodPnl = buildPnl('1');
    const refreshedPnl = buildPnl('2');
    const refreshDeferred = createDeferred<IMarketAccountPortfolioResponse>();
    mockFetchMarketAccountPortfolio
      .mockResolvedValueOnce(
        buildPortfolioResponse({
          accountAddress: '0xowner-a',
          pnl: lastGoodPnl,
        }),
      )
      .mockImplementationOnce(() => refreshDeferred.promise);
    const { result } = renderHook(() =>
      useSwapProPositionsPnl([buildToken('0xowner-a')], 'owner-a__evm--1'),
    );

    await waitFor(() =>
      expect(result.current.get('evm--1-0xstock')).toBe(lastGoodPnl),
    );

    act(() => {
      getLatestIntervalCallback()();
    });
    await waitFor(() =>
      expect(mockFetchMarketAccountPortfolio).toHaveBeenCalledTimes(2),
    );
    expect(result.current.get('evm--1-0xstock')).toBe(lastGoodPnl);

    await act(async () => {
      refreshDeferred.resolve(
        buildPortfolioResponse({
          accountAddress: '0xowner-a',
          pnl: refreshedPnl,
        }),
      );
      await refreshDeferred.promise;
    });
    await waitFor(() =>
      expect(result.current.get('evm--1-0xstock')).toBe(refreshedPnl),
    );
  });

  it('keeps same-owner last-good PnL when a refresh request rejects', async () => {
    const lastGoodPnl = buildPnl('1');
    const refreshDeferred = createDeferred<IMarketAccountPortfolioResponse>();
    mockFetchMarketAccountPortfolio
      .mockResolvedValueOnce(
        buildPortfolioResponse({
          accountAddress: '0xowner-a',
          pnl: lastGoodPnl,
        }),
      )
      .mockImplementationOnce(() => refreshDeferred.promise);
    const { result } = renderHook(() =>
      useSwapProPositionsPnl([buildToken('0xowner-a')], 'owner-a__evm--1'),
    );

    await waitFor(() =>
      expect(result.current.get('evm--1-0xstock')).toBe(lastGoodPnl),
    );

    act(() => {
      getLatestIntervalCallback()();
    });
    await waitFor(() =>
      expect(mockFetchMarketAccountPortfolio).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      refreshDeferred.reject(new Error('portfolio offline'));
      await expect(refreshDeferred.promise).rejects.toThrow(
        'portfolio offline',
      );
    });

    expect(result.current.get('evm--1-0xstock')).toBe(lastGoodPnl);
  });
});
