/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { createMockTransaction } from '../__tests__/fixtures';

import { useMarketTransactions } from './useMarketTransactions';

type IThrottledTransactionsUpdate = ((
  transactions: IMarketTokenTransaction[],
) => void) & {
  cancel: jest.Mock;
  flush: () => void;
  isPending: () => boolean;
};

type IMockUsePromiseResultReturn = {
  result?: {
    list: IMarketTokenTransaction[];
    cursor?: string;
  };
  isLoading: boolean;
  run: jest.Mock;
};

type IMockUsePromiseResult = (
  ...args: unknown[]
) => IMockUsePromiseResultReturn;

const mockUsePromiseResult: jest.MockedFunction<IMockUsePromiseResult> =
  jest.fn();
const mockFetchTransactions = jest.fn();
const mockThrottledTransactionsUpdates: IThrottledTransactionsUpdate[] = [];

jest.mock('use-debounce', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useThrottledCallback: (
      callback: (transactions: IMarketTokenTransaction[]) => void,
    ) => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      return React.useMemo(() => {
        let pendingTransactions: IMarketTokenTransaction[] | undefined;
        const throttledUpdate = ((transactions: IMarketTokenTransaction[]) => {
          pendingTransactions = transactions;
        }) as IThrottledTransactionsUpdate;

        throttledUpdate.cancel = jest.fn(() => {
          pendingTransactions = undefined;
        });
        throttledUpdate.flush = () => {
          if (!pendingTransactions) {
            return;
          }

          const transactions = pendingTransactions;
          pendingTransactions = undefined;
          callbackRef.current(transactions);
        };
        throttledUpdate.isPending = () => Boolean(pendingTransactions);

        mockThrottledTransactionsUpdates.push(throttledUpdate);

        return throttledUpdate;
      }, []);
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenTransactions: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => {
    return mockUsePromiseResult(...args);
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isNativeAndroid: false,
  },
}));

describe('useMarketTransactions', () => {
  beforeEach(() => {
    mockFetchTransactions.mockReset();
    mockUsePromiseResult.mockReset();
    mockThrottledTransactionsUpdates.length = 0;

    mockUsePromiseResult.mockReturnValue({
      result: {
        list: [createMockTransaction('base-1')],
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
    });
  });

  it('cancels queued throttled writes before flushing buffered transactions', () => {
    const { result } = renderHook(() =>
      useMarketTransactions({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        normalMode: false,
        enableRealtimePause: true,
      }),
    );

    const throttledUpdate = mockThrottledTransactionsUpdates[0];

    expect(throttledUpdate).toBeDefined();

    act(() => {
      throttledUpdate.flush();
    });

    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'base-1',
    ]);

    act(() => {
      result.current.addNewTransaction(createMockTransaction('live-1', 2));
      result.current.handleRealtimePauseHoverIn();
      result.current.addNewTransaction(createMockTransaction('buffered-1', 3));
    });

    expect(result.current.bufferedTransactionsCount).toBe(1);
    expect(throttledUpdate.isPending()).toBe(true);

    act(() => {
      result.current.flushBufferedTransactions();
    });

    expect(throttledUpdate.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'buffered-1',
      'live-1',
      'base-1',
    ]);
    expect(result.current.bufferedTransactionsCount).toBe(0);

    act(() => {
      throttledUpdate.flush();
    });

    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'buffered-1',
      'live-1',
      'base-1',
    ]);
  });

  it('flushes buffered transactions before disabling realtime pause', () => {
    const { result, rerender } = renderHook(
      ({ enableRealtimePause }: { enableRealtimePause: boolean }) =>
        useMarketTransactions({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
          normalMode: false,
          enableRealtimePause,
        }),
      {
        initialProps: {
          enableRealtimePause: true,
        },
      },
    );

    const throttledUpdate = mockThrottledTransactionsUpdates[0];

    expect(throttledUpdate).toBeDefined();

    act(() => {
      throttledUpdate.flush();
    });

    act(() => {
      result.current.handleRealtimePauseHoverIn();
      result.current.addNewTransaction(createMockTransaction('buffered-1', 2));
    });

    expect(result.current.bufferedTransactionsCount).toBe(1);

    act(() => {
      rerender({ enableRealtimePause: false });
    });

    expect(throttledUpdate.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'buffered-1',
      'base-1',
    ]);
    expect(result.current.bufferedTransactionsCount).toBe(0);
    expect(result.current.isRealtimePaused).toBe(false);
  });
});
