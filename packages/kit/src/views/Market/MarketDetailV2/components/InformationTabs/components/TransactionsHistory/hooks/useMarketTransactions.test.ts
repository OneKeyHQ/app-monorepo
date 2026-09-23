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

type IMockTokenListRequestReturn = {
  result?: {
    list: IMarketTokenTransaction[];
    cursor?: string;
  };
  isLoading: boolean | undefined;
  isInitialPending?: boolean;
  run: jest.Mock;
  setStopPolling: jest.Mock;
};

type IMockTokenListRequest = (
  ...args: unknown[]
) => IMockTokenListRequestReturn;

const mockTokenListRequest: jest.MockedFunction<IMockTokenListRequest> =
  jest.fn();
const mockFetchTransactions = jest.fn();
const mockSetStopPolling = jest.fn();
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

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketTokenListRequest',
  () => ({
    useMarketTokenListRequest: (...args: unknown[]) => ({
      isInitialPending: false,
      ...mockTokenListRequest(...args),
    }),
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isNativeAndroid: false,
  },
}));

function getMockMarketService() {
  return jest.requireMock(
    '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  ).default.serviceMarketV2 as {
    fetchMarketTokenTransactions: jest.Mock;
  };
}

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
    mockSetStopPolling.mockReset();
    mockTokenListRequest.mockReset();
    mockThrottledTransactionsUpdates.length = 0;
    getMockMarketService().fetchMarketTokenTransactions.mockReset();

    mockTokenListRequest.mockReturnValue({
      result: {
        list: [createMockTransaction('base-1')],
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
    });
  });

  it('keeps the initial skeleton until deferred transaction rows have committed', () => {
    const { result } = renderHook(() =>
      useMarketTransactions({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        normalMode: true,
      }),
    );
    expect(result.current.transactions).toEqual([]);
    expect(result.current.isInitialPending).toBe(true);
    act(() => mockThrottledTransactionsUpdates[0].flush());
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.isInitialPending).toBe(false);
  });

  it('keeps focus-gated empty transactions pending until the first request settles', () => {
    const pendingRequest = {
      isInitialPending: true,
      isLoading: undefined,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
    };
    mockTokenListRequest.mockReturnValue(pendingRequest);
    const { result, rerender } = renderHook(
      ({ isTabFocused }) =>
        useMarketTransactions({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
          normalMode: true,
          isTabFocused,
        }),
      { initialProps: { isTabFocused: false } },
    );
    expect(result.current.isInitialPending).toBe(true);
    rerender({ isTabFocused: true });
    expect(result.current.isInitialPending).toBe(true);
    mockTokenListRequest.mockReturnValue({
      ...pendingRequest,
      result: { list: [] },
      isInitialPending: false,
      isLoading: false,
    });
    rerender({ isTabFocused: true });
    expect(result.current.isInitialPending).toBe(false);
  });

  it('preserves unchanged REST rows while accepting corrected transaction data', () => {
    const transaction = createMockTransaction('base-1');
    const setSnapshot = (list: IMarketTokenTransaction[]) => {
      mockTokenListRequest.mockReturnValue({
        result: { list, cursor: 'cursor-1' },
        isLoading: false,
        run: mockFetchTransactions,
        setStopPolling: mockSetStopPolling,
      });
    };
    setSnapshot([transaction]);
    const { result, rerender } = renderHook(() =>
      useMarketTransactions({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        normalMode: true,
      }),
    );
    const flush = () => act(() => mockThrottledTransactionsUpdates[0].flush());
    flush();
    const initialRows = result.current.transactions;

    setSnapshot([{ ...transaction, from: { ...transaction.from } }]);
    rerender();
    flush();
    expect(result.current.transactions).toBe(initialRows);

    const newTransaction = createMockTransaction('new', 2);
    setSnapshot([newTransaction, { ...transaction }]);
    rerender();
    flush();
    expect(result.current.transactions[0]).toBe(newTransaction);
    expect(result.current.transactions[1]).toBe(initialRows[0]);

    setSnapshot([{ ...transaction, volumeUSD: 2 }]);
    rerender();
    flush();
    expect(result.current.transactions[1]).not.toBe(initialRows[0]);
    expect(result.current.transactions[1].volumeUSD).toBe(2);
  });

  it('keeps one REST snapshot and only enables polling in normal mode', () => {
    const { rerender } = renderHook(
      ({ normalMode }) =>
        useMarketTransactions({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
          normalMode,
        }),
      { initialProps: { normalMode: false } },
    );

    expect(mockSetStopPolling).toHaveBeenLastCalledWith(true);
    expect(mockTokenListRequest.mock.calls[0]?.[1]).toMatchObject({
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      isTabFocused: true,
    });

    rerender({ normalMode: true });

    expect(mockSetStopPolling).toHaveBeenLastCalledWith(false);
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
      result.current.addNewTransactions([createMockTransaction('live-1', 2)]);
      result.current.handleRealtimePauseHoverIn();
      result.current.addNewTransactions([
        createMockTransaction('buffered-1', 3),
      ]);
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
      result.current.addNewTransactions([
        createMockTransaction('buffered-1', 2),
      ]);
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

  it('merges batched live transaction inserts into one throttled update', () => {
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

    act(() => {
      result.current.addNewTransactions([
        createMockTransaction('live-1', 2),
        createMockTransaction('live-2', 3),
      ]);
    });

    expect(
      throttledUpdate.getPendingTransactions()?.map((tx) => tx.hash),
    ).toEqual(['live-2', 'live-1', 'base-1']);

    act(() => {
      throttledUpdate.flush();
    });

    expect(result.current.transactions.map((tx) => tx.hash)).toEqual([
      'live-2',
      'live-1',
      'base-1',
    ]);
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
        result.current.addNewTransactions([
          createMockTransaction(`buffered-${i}`, i + 1),
        ]);
      }
    });

    expect(result.current.bufferedTransactionsCount).toBe(
      MAX_BUFFERED_TRANSACTIONS,
    );
    expect(result.current.hasBufferOverflow).toBe(true);

    act(() => {
      result.current.flushBufferedTransactions();
    });

    expect(result.current.transactions).toHaveLength(MAX_BUFFERED_TRANSACTIONS);
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

  it('caps web transaction cache at 50 entries', async () => {
    mockTokenListRequest.mockReturnValue({
      result: {
        list: Array.from({ length: 55 }, (_, index) =>
          createMockTransaction(`base-${index + 1}`, index + 1),
        ),
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
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
    expect(result.current.hasMore).toBe(false);

    act(() => {
      result.current.addNewTransactions([createMockTransaction('live-1', 100)]);
    });

    const pendingTransactions = throttledUpdate.getPendingTransactions();

    expect(pendingTransactions).toHaveLength(50);
    expect(pendingTransactions?.[0]?.hash).toBe('live-1');

    await act(async () => {
      await result.current.loadMore();
    });

    expect(
      getMockMarketService().fetchMarketTokenTransactions,
    ).not.toHaveBeenCalled();
  });

  it('fills the market transaction cache to 50 and then stops pagination', async () => {
    mockTokenListRequest.mockReturnValue({
      result: {
        list: Array.from({ length: 45 }, (_, index) =>
          createMockTransaction(`base-${index + 1}`, 100 - index),
        ),
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
    });
    getMockMarketService().fetchMarketTokenTransactions.mockResolvedValue({
      list: Array.from({ length: 20 }, (_, index) =>
        createMockTransaction(`older-${index + 1}`, -index),
      ),
      cursor: 'cursor-2',
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

    expect(result.current.transactions).toHaveLength(45);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(
      getMockMarketService().fetchMarketTokenTransactions,
    ).toHaveBeenCalledTimes(1);
    expect(throttledUpdate.getPendingTransactions()).toHaveLength(50);

    act(() => {
      throttledUpdate.flush();
    });

    expect(result.current.transactions).toHaveLength(50);
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(
      getMockMarketService().fetchMarketTokenTransactions,
    ).toHaveBeenCalledTimes(1);
  });

  it('queues the native render slice for live transaction inserts', () => {
    getMockPlatformEnv().isNative = true;
    mockTokenListRequest.mockReturnValue({
      result: {
        list: Array.from({ length: 55 }, (_, index) =>
          createMockTransaction(`base-${index + 1}`, index + 1),
        ),
        cursor: 'cursor-1',
      },
      isLoading: false,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
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
      result.current.addNewTransactions([createMockTransaction('live-1', 100)]);
    });

    const pendingTransactions = throttledUpdate.getPendingTransactions();

    expect(pendingTransactions).toHaveLength(50);
    expect(pendingTransactions?.[0]?.hash).toBe('live-1');
  });
});
