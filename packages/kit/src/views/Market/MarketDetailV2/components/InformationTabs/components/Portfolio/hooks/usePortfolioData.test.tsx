/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IMarketAccountPortfolioItem,
  IMarketAccountPortfolioResponse,
} from '@onekeyhq/shared/types/marketV2';

import { usePortfolioData } from './usePortfolioData';

type IScopedPortfolioData = {
  list: IMarketAccountPortfolioItem[];
  networkId: string;
  tokenAddress: string;
  accountAddress?: string;
};

type IFetchPortfolioParams = {
  tokenAddress: string;
  networkId: string;
  accountAddress: string;
  xpub?: string;
  throwOnError?: boolean;
};

const mockFetchMarketAccountPortfolio = jest.fn<
  Promise<IMarketAccountPortfolioResponse>,
  [IFetchPortfolioParams]
>();
const mockRun = jest.fn();
let mockPortfolioResult: IScopedPortfolioData | undefined;
let mockCapturedMethod: (() => Promise<IScopedPortfolioData>) | undefined;
let mockCapturedDeps: unknown[] = [];
let mockCapturedOptions:
  | {
      pollingInterval?: number;
      undefinedResultIfReRun?: boolean;
      keepResultIfError?: boolean;
      watchLoading?: boolean;
    }
  | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: IFetchPortfolioParams) =>
        mockFetchMarketAccountPortfolio(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<IScopedPortfolioData>,
    deps: unknown[],
    options?: {
      pollingInterval?: number;
      undefinedResultIfReRun?: boolean;
      keepResultIfError?: boolean;
      watchLoading?: boolean;
    },
  ) => {
    mockCapturedMethod = method;
    mockCapturedDeps = deps;
    mockCapturedOptions = options;
    return {
      result: mockPortfolioResult,
      isLoading: false,
      run: mockRun,
    };
  },
}));

const portfolioItem: IMarketAccountPortfolioItem = {
  accountAddress: '0xaccount',
  tokenAddress: '0xSAME',
  amount: '8.5',
  symbol: 'AAPLon',
  tokenPrice: '200',
  totalPrice: '1700',
};

describe('usePortfolioData', () => {
  beforeEach(() => {
    mockFetchMarketAccountPortfolio.mockReset();
    mockRun.mockReset();
    mockPortfolioResult = undefined;
    mockCapturedMethod = undefined;
    mockCapturedDeps = [];
    mockCapturedOptions = undefined;
  });

  it('tags the fetched portfolio with the requested token scope', async () => {
    mockFetchMarketAccountPortfolio.mockResolvedValue({
      list: [portfolioItem],
    });

    renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xSAME',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
        xpub: 'xpub',
      }),
    );

    await expect(mockCapturedMethod?.()).resolves.toEqual({
      list: [portfolioItem],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xaccount',
    });
    expect(mockFetchMarketAccountPortfolio).toHaveBeenCalledWith({
      tokenAddress: '0xSAME',
      networkId: 'evm--8453',
      accountAddress: '0xaccount',
      xpub: 'xpub',
      throwOnError: true,
    });
    expect(mockCapturedDeps).toEqual([
      '0xSAME',
      'evm--8453',
      '0xaccount',
      'xpub',
    ]);
  });

  it('keeps tiny Stock holdings without changing non-Stock portfolio rules', () => {
    const tinyHolding = {
      ...portfolioItem,
      amount: '0.00000001',
      totalPrice: '0',
    };
    const zeroHolding = { ...portfolioItem, amount: '0' };
    mockPortfolioResult = {
      list: [tinyHolding, zeroHolding],
      networkId: 'evm--1',
      tokenAddress: '0xSAME',
      accountAddress: '0xaccount',
    };

    const { result, rerender } = renderHook(
      ({ isStock }) =>
        usePortfolioData({
          tokenAddress: '0xSAME',
          networkId: 'evm--1',
          accountAddress: '0xaccount',
          isStock,
        }),
      { initialProps: { isStock: true } },
    );

    expect(result.current.portfolioData).toEqual([tinyHolding]);
    rerender({ isStock: false });
    expect(result.current.portfolioData).toEqual([tinyHolding, zeroHolding]);
  });

  it('does not expose a stale result from another network', () => {
    mockPortfolioResult = {
      list: [portfolioItem],
      networkId: 'evm--1',
      tokenAddress: '0xSAME',
    };

    const { result } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
      }),
    );

    expect(result.current.portfolioData).toEqual([]);
  });

  it('exposes a result only for the current token scope', () => {
    mockPortfolioResult = {
      list: [portfolioItem],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xaccount',
    };

    const { result } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
      }),
    );

    expect(result.current.portfolioData).toEqual([portfolioItem]);
    expect(mockCapturedOptions).toEqual({
      watchLoading: true,
      keepResultIfError: true,
      runImmediatelyOnPollingIntervalChange: true,
      pollingInterval: 5000,
    });
  });

  it('hides rows from the previous account while the new one loads', () => {
    mockPortfolioResult = {
      list: [portfolioItem],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xprevious',
    };
    const { result } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
      }),
    );

    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.isPortfolioPending).toBe(true);
  });

  it('shows a skeleton until the first result for this token is back', () => {
    const props = {
      tokenAddress: '0xsame',
      networkId: 'evm--8453',
      accountAddress: '0xaccount',
    };
    const { result, rerender } = renderHook(() => usePortfolioData(props));
    expect(result.current.isPortfolioPending).toBe(true);

    mockPortfolioResult = {
      list: [],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xaccount',
    };
    rerender();
    expect(result.current.isPortfolioPending).toBe(false);
  });

  it('stops the skeleton when the first request fails', async () => {
    mockFetchMarketAccountPortfolio.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
      }),
    );
    expect(result.current.isPortfolioPending).toBe(true);
    expect(result.current.isPortfolioFailed).toBe(false);

    await act(async () => {
      await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
    });

    expect(result.current.isPortfolioPending).toBe(false);
    expect(result.current.isPortfolioFailed).toBe(true);
    expect(result.current.portfolioData).toEqual([]);
  });

  it.each([
    ['succeeds', true],
    ['fails', false],
  ] as const)(
    'keeps the selected token failed when an older request %s late',
    async (_case, olderSucceeds) => {
      let settleOlder: (() => void) | undefined;
      mockFetchMarketAccountPortfolio.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            settleOlder = () =>
              olderSucceeds ? resolve({ list: [] }) : reject(new Error('old'));
          }),
      );
      const { result, rerender } = renderHook(
        (props: { tokenAddress: string }) =>
          usePortfolioData({
            ...props,
            networkId: 'evm--8453',
            accountAddress: '0xaccount',
          }),
        { initialProps: { tokenAddress: '0xold' } },
      );
      const olderRequest = mockCapturedMethod?.();

      rerender({ tokenAddress: '0xnew' });
      mockFetchMarketAccountPortfolio.mockRejectedValueOnce(
        new Error('offline'),
      );
      await act(async () => {
        await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
      });
      expect(result.current.isPortfolioFailed).toBe(true);

      await act(async () => {
        settleOlder?.();
        await olderRequest?.catch(() => undefined);
      });
      expect(result.current.isPortfolioFailed).toBe(true);
      expect(result.current.isPortfolioPending).toBe(false);
    },
  );

  it('clears the failed state once a result for this token is back', async () => {
    mockFetchMarketAccountPortfolio.mockRejectedValue(new Error('offline'));
    const { result, rerender } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
      }),
    );
    await act(async () => {
      await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
    });
    expect(result.current.isPortfolioFailed).toBe(true);

    mockPortfolioResult = {
      list: [],
      networkId: 'evm--8453',
      tokenAddress: '0xsame',
      accountAddress: '0xaccount',
    };
    rerender();
    expect(result.current.isPortfolioFailed).toBe(false);
    expect(result.current.isPortfolioPending).toBe(false);
  });
});
