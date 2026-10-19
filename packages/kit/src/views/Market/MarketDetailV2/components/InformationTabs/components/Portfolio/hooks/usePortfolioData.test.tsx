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
    });
    expect(mockCapturedDeps).toEqual([
      '0xSAME',
      'evm--8453',
      '0xaccount',
      'xpub',
    ]);
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
      pollingInterval: 5000,
    });
  });

  it('settles once the result for the current token and account is back', () => {
    const props = {
      tokenAddress: '0xsame',
      networkId: 'evm--8453',
      accountAddress: '0xaccount',
      isAccountResolved: true,
    };
    const { result, rerender } = renderHook(() => usePortfolioData(props));
    expect(result.current.isPortfolioSettled).toBe(false);

    mockPortfolioResult = {
      list: [portfolioItem],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xaccount',
    };
    rerender();
    expect(result.current.isPortfolioSettled).toBe(true);
  });

  it('does not settle on a result from another account or before the account resolves', () => {
    mockPortfolioResult = {
      list: [portfolioItem],
      networkId: 'evm--8453',
      tokenAddress: '0xSAME',
      accountAddress: '0xother',
    };
    const { result: otherAccount } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
        isAccountResolved: true,
      }),
    );
    expect(otherAccount.current.isPortfolioSettled).toBe(false);

    mockPortfolioResult = {
      ...mockPortfolioResult,
      accountAddress: '0xaccount',
    };
    const { result: accountPending } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
        isAccountResolved: false,
      }),
    );
    expect(accountPending.current.isPortfolioSettled).toBe(false);
  });

  it('settles when the request fails, so the page does not wait forever', async () => {
    mockFetchMarketAccountPortfolio.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      usePortfolioData({
        tokenAddress: '0xsame',
        networkId: 'evm--8453',
        accountAddress: '0xaccount',
        isAccountResolved: true,
      }),
    );
    expect(result.current.isPortfolioSettled).toBe(false);

    await act(async () => {
      await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
    });

    expect(result.current.isPortfolioSettled).toBe(true);
    expect(result.current.portfolioData).toEqual([]);
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
        isAccountResolved: true,
      }),
    );

    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.isPortfolioSettled).toBe(false);
  });

  it('does not let a failure from an earlier visit settle a fresh request', async () => {
    mockFetchMarketAccountPortfolio.mockRejectedValue(new Error('offline'));
    const tokenA = {
      tokenAddress: '0xaaa',
      networkId: 'evm--8453',
      accountAddress: '0xaccount',
      isAccountResolved: true,
    };
    const tokenB = { ...tokenA, tokenAddress: '0xbbb' };
    const { result, rerender } = renderHook(
      (props: typeof tokenA) => usePortfolioData(props),
      { initialProps: tokenA },
    );
    await act(async () => {
      await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
    });
    expect(result.current.isPortfolioSettled).toBe(true);

    rerender(tokenB);
    rerender(tokenA);

    expect(result.current.isPortfolioSettled).toBe(false);
  });
});
