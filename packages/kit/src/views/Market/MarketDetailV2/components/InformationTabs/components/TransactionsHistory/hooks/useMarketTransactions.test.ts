/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { createMockTransaction } from '../__tests__/fixtures';

import { MAX_BUFFERED_TRANSACTIONS } from './transactionBufferUtils';
import { useMarketTransactions } from './useMarketTransactions';

type IThrottledTransactionsUpdate = ((
  transactions: IMarketTokenTransaction[],
) => void) & {
  cancel: jest.Mock;
  flush: () => void;
  isPending: () => boolean;
  getPendingTransactions: () => IMarketTokenTransaction[] | undefined;
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
        throttledUpdate.getPendingTransactions = () => pendingTransactions;

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

function getMockPlatformEnv() {
  return jest.requireMock('@onekeyhq/shared/src/platformEnv').default as {
    isNative: boolean;
    isNativeAndroid: boolean;
  };
}

describe('useMarketTransactions', () => {
  beforeEach(() => {
    const platformEnv = getMockPlatformEnv();
    platformEnv.isNative = false;
    platformEnv.isNativeAndroid = false;
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
    const cancelCallCount = throttledUpdate.cancel.mock.calls.length;

    act(() => {
      result.current.flushBufferedTransactions();
    });

    expect(throttledUpdate.cancel).toHaveBeenCalledTimes(cancelCallCount + 1);
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
    const cancelCallCount = throttledUpdate.cancel.mock.calls.length;

    act(() => {
      rerender({ enableRealtimePause: false });
    });

    expect(throttledUpdate.cancel).toHaveBeenCalledTimes(cancelCallCount + 1);
    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'buffered-1',
      'base-1',
    ]);
    expect(result.current.bufferedTransactionsCount).toBe(0);
    expect(result.current.isRealtimePaused).toBe(false);
  });

  it('caps paused realtime buffers after hitting the overflow threshold', () => {
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
      result.current.handleRealtimePauseHoverIn();

      for (let i = 1; i <= MAX_BUFFERED_TRANSACTIONS + 5; i += 1) {
        result.current.addNewTransaction(
          createMockTransaction(`buffered-${i}`, i + 1),
        );
      }
    });

    expect(result.current.bufferedTransactionsCount).toBe(
      MAX_BUFFERED_TRANSACTIONS,
    );
    expect(result.current.hasBufferOverflow).toBe(true);

    act(() => {
      result.current.flushBufferedTransactions();
    });

    expect(result.current.transactions).toHaveLength(
      MAX_BUFFERED_TRANSACTIONS + 1,
    );
    expect(result.current.transactions[0]?.hash).toBe(
      `buffered-${MAX_BUFFERED_TRANSACTIONS + 5}`,
    );
    expect(
      result.current.transactions.some((tx) => tx.hash === 'buffered-1'),
    ).toBe(false);
    expect(
      result.current.transactions.some(
        (tx) => tx.hash === `buffered-${MAX_BUFFERED_TRANSACTIONS + 5}`,
      ),
    ).toBe(true);
  });

  it('clears accumulated transactions immediately when token identity changes', () => {
    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useMarketTransactions({
          tokenAddress,
          networkId: 'evm--1',
          normalMode: false,
          enableRealtimePause: true,
        }),
      {
        initialProps: {
          tokenAddress: '0xabc',
        },
      },
    );

    const throttledUpdate = mockThrottledTransactionsUpdates[0];

    expect(throttledUpdate).toBeDefined();

    act(() => {
      throttledUpdate.flush();
    });

    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'base-1',
    ]);

    const cancelCallCount = throttledUpdate.cancel.mock.calls.length;

    act(() => {
      rerender({ tokenAddress: '0xdef' });
    });

    expect(throttledUpdate.cancel).toHaveBeenCalledTimes(cancelCallCount + 1);
    expect(result.current.transactions).toEqual([]);
  });

  it('queues the native render slice for live transaction inserts', () => {
    getMockPlatformEnv().isNative = true;
    mockUsePromiseResult.mockReturnValue({
      result: {
        list: Array.from({ length: 55 }, (_, index) =>
          createMockTransaction(`base-${index + 1}`, index + 1),
        ),
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
    });

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

    expect(result.current.transactions).toHaveLength(50);

    act(() => {
      result.current.addNewTransaction(createMockTransaction('live-1', 100));
    });

    const pendingTransactions = throttledUpdate.getPendingTransactions();

    expect(pendingTransactions).toHaveLength(50);
    expect(pendingTransactions?.[0]?.hash).toBe('live-1');
  });
});
