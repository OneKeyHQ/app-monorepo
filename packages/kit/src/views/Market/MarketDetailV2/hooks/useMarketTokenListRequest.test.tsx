/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';

import { act, renderHook } from '@testing-library/react';

import type {
  IMarketTokenDetail,
  IMarketTokenHolder,
} from '@onekeyhq/shared/types/marketV2';

import { useMarketHolders } from './useMarketHolders';
import { useMarketTokenListRequest } from './useMarketTokenListRequest';

const mockFetchHolders = jest.fn<
  Promise<{ list: IMarketTokenHolder[] }>,
  [{ networkId: string; tokenAddress: string }]
>();
let mockTokenDetail: IMarketTokenDetail | undefined;

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise'),
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenHolders: (params: {
        networkId: string;
        tokenAddress: string;
      }) => mockFetchHolders(params),
    },
  },
}));

jest.mock('./useTokenDetail', () => ({
  useTokenDetail: () => ({ tokenDetail: mockTokenDetail }),
}));

const holderA: IMarketTokenHolder = {
  accountAddress: '0xholder-a',
  amount: '10',
  fiatValue: '20',
};
const holderB: IMarketTokenHolder = {
  accountAddress: '0xholder-b',
  amount: '20',
  fiatValue: '60',
};
const initialScope = {
  networkId: 'evm--1',
  tokenAddress: '0xa',
  isTabFocused: false,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchHolders.mockReset();
  mockTokenDetail = {
    networkId: 'evm--1',
    address: '0xa',
    name: 'A',
    symbol: 'A',
    decimals: 18,
    logoUrl: '',
    fdv: '2000',
    price: '2',
  };
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useMarketTokenListRequest', () => {
  it('keeps the first focused commit pending and only polls the visible tab', async () => {
    const response = Promise.withResolvers<string[]>();
    const request = jest.fn(() => response.promise);
    const commits: boolean[] = [];
    const { result, rerender } = renderHook(
      (props) => {
        const state = useMarketTokenListRequest(request, props);
        useLayoutEffect(() => {
          commits.push(state.isInitialPending);
        });
        return state;
      },
      { initialProps: initialScope },
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(request).not.toHaveBeenCalled();
    expect(result.current.isInitialPending).toBe(true);
    commits.length = 0;
    rerender({ ...initialScope, isTabFocused: true });
    expect(commits[0]).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      response.resolve([]);
    });
    expect(result.current.result).toEqual([]);
    expect(result.current.isInitialPending).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(request).toHaveBeenCalledTimes(2);
    rerender(initialScope);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('settles an initial failure without allowing an older failure to settle a new token', async () => {
    const oldResponse = Promise.withResolvers<string[]>();
    const newResponse = Promise.withResolvers<string[]>();
    const request = jest
      .fn<Promise<string[]>, []>()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const { result, rerender } = renderHook(
      (props) => useMarketTokenListRequest<string[]>(request, props),
      { initialProps: initialScope },
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    let oldRun: Promise<void> | undefined;
    act(() => {
      oldRun = result.current.run({ alwaysSetState: true });
    });
    rerender({ ...initialScope, tokenAddress: '0xb' });
    await act(async () => {
      oldResponse.reject(new Error('stale A request'));
      await oldRun;
    });
    expect(result.current.isInitialPending).toBe(true);
    await act(async () => {
      const currentRun = result.current.run({ alwaysSetState: true });
      newResponse.reject(new Error('B request failed'));
      await expect(currentRun).rejects.toThrow('B request failed');
    });
    expect(result.current.isInitialPending).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeUndefined();
  });

  it('discards a late A response after switching A -> B -> A', async () => {
    const oldResponse = Promise.withResolvers<string[]>();
    const currentResponse = Promise.withResolvers<string[]>();
    const request = jest
      .fn<Promise<string[]>, []>()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise);
    const { result, rerender } = renderHook(
      (props) => useMarketTokenListRequest<string[]>(request, props),
      { initialProps: { ...initialScope, isTabFocused: true } },
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(request).toHaveBeenCalledTimes(1);
    rerender({ ...initialScope, tokenAddress: '0xb' });
    rerender(initialScope);
    await act(async () => {
      oldResponse.resolve(['stale A']);
    });
    expect(result.current.result).toBeUndefined();
    expect(result.current.isInitialPending).toBe(true);
    rerender({ ...initialScope, isTabFocused: true });
    await act(async () => {
      currentResponse.resolve(['current A']);
    });
    expect(result.current.result).toEqual(['current A']);
    expect(result.current.isInitialPending).toBe(false);
  });
});

describe('useMarketHolders request ownership', () => {
  it.each([
    { networkId: 'evm--1', tokenAddress: '0xb' },
    { networkId: 'evm--56', tokenAddress: '0xa' },
  ])('clears hidden holders on identity change: %j', async (nextToken) => {
    const responseA = Promise.withResolvers<{ list: IMarketTokenHolder[] }>();
    const responseB = Promise.withResolvers<{ list: IMarketTokenHolder[] }>();
    mockFetchHolders
      .mockReturnValueOnce(responseA.promise)
      .mockReturnValueOnce(responseB.promise);
    const commits: Array<ReturnType<typeof useMarketHolders>> = [];
    const { result, rerender } = renderHook(
      (props) => {
        const state = useMarketHolders(props);
        useLayoutEffect(() => {
          commits.push(state);
        });
        return state;
      },
      { initialProps: { ...initialScope, isTabFocused: true } },
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(mockFetchHolders).toHaveBeenCalledTimes(1);
    await act(async () => {
      responseA.resolve({ list: [holderA] });
    });
    expect(result.current.holders).toEqual([
      { ...holderA, percentage: '1.00' },
    ]);
    rerender(initialScope);
    mockTokenDetail = {
      ...mockTokenDetail,
      ...nextToken,
      name: 'B',
      symbol: 'B',
      decimals: 18,
      logoUrl: '',
      fdv: '600',
      price: '3',
      address: nextToken.tokenAddress,
    };
    commits.length = 0;
    rerender({ ...nextToken, isTabFocused: false });
    expect(commits.every((state) => state.holders.length === 0)).toBe(true);
    expect(result.current.isInitialPending).toBe(true);
    expect(mockFetchHolders).toHaveBeenCalledTimes(1);
    commits.length = 0;
    rerender({ ...nextToken, isTabFocused: true });
    expect(commits[0].holders).toEqual([]);
    expect(commits[0].isInitialPending).toBe(true);
    await act(async () => {
      responseB.resolve({ list: [holderB] });
    });
    expect(result.current.holders).toEqual([
      { ...holderB, percentage: '10.00' },
    ]);
    expect(result.current.isInitialPending).toBe(false);
  });
});
