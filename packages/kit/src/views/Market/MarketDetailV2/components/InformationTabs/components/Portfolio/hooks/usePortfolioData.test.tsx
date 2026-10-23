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

    await act(async () => {
      await expect(mockCapturedMethod?.()).rejects.toThrow('offline');
    });

    expect(result.current.isPortfolioPending).toBe(false);
    expect(result.current.portfolioData).toEqual([]);
  });
});
