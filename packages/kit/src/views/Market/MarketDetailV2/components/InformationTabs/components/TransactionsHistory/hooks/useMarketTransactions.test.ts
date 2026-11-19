/** @jest-environment jsdom */

import { Suspense, createElement, useLayoutEffect } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { createMockTransaction } from '../__tests__/fixtures';

import { MAX_BUFFERED_TRANSACTIONS } from './transactionBufferUtils';
import { useMarketTransactions } from './useMarketTransactions';

type IThrottledTransactionsUpdate = ((
  transactions: IMarketTokenTransaction[],
  scope: object,
) => void) & {
  cancel: jest.Mock;
  flush: () => void;
  isPending: () => boolean;
  getPendingTransactions: () => IMarketTokenTransaction[] | undefined;
};

type IMockTokenListRequestReturn = {
  result?: {
    list?: IMarketTokenTransaction[] | null;
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
      callback: (
        transactions: IMarketTokenTransaction[],
        scope: object,
      ) => void,
    ) => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      return React.useMemo(() => {
        let pendingTransactions: IMarketTokenTransaction[] | undefined;
        let pendingScope: object | undefined;
        const throttledUpdate = ((
          transactions: IMarketTokenTransaction[],
          scope: object,
        ) => {
          pendingTransactions = transactions;
          pendingScope = scope;
        }) as IThrottledTransactionsUpdate;

        throttledUpdate.cancel = jest.fn(() => {
          pendingTransactions = undefined;
          pendingScope = undefined;
        });
        throttledUpdate.flush = () => {
          if (!pendingTransactions || !pendingScope) {
            return;
          }

          const transactions = pendingTransactions;
          const scope = pendingScope;
          pendingTransactions = undefined;
          pendingScope = undefined;
          callbackRef.current(transactions, scope);
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
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      useMarketTokenListRequest: (
        request: unknown,
        props: { networkId: string; tokenAddress: string },
      ) => {
        const scope = React.useMemo(
          () => ({
            networkId: props.networkId,
            tokenAddress: props.tokenAddress,
          }),
          [props.networkId, props.tokenAddress],
        );
        return {
          scope,
          isInitialPending: false,
          ...mockTokenListRequest(request, props),
        };
      },
    };
  },
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

  it.each([{}, { list: null }])(
    'keeps the empty state when the response has no transaction list: %j',
    (response) => {
      mockTokenListRequest.mockReturnValue({
        result: response,
        isLoading: false,
        run: mockFetchTransactions,
        setStopPolling: mockSetStopPolling,
      });
      const { result } = renderHook(() =>
        useMarketTransactions({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
          normalMode: true,
        }),
      );
      expect(result.current.transactions).toEqual([]);
      expect(result.current.isInitialPending).toBe(false);
      expect(result.current.hasMore).toBe(false);
    },
  );

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

  it.each([
    { tokenAddress: '0xdef', networkId: 'evm--1' },
    { tokenAddress: '0xabc', networkId: 'evm--56' },
  ])(
    'never commits old rows when navigating during a suspended transition: %j',
    (nextToken) => {
      const commits: string[][] = [];
      let suspendOldRows = false;
      let suspendedRenders = 0;
      const pendingRender = new Promise<void>(() => {});
      const initialToken = { tokenAddress: '0xabc', networkId: 'evm--1' };
      const { result, rerender } = renderHook(
        (token) => {
          const value = useMarketTransactions({
            ...token,
            normalMode: false,
          });
          useLayoutEffect(() => {
            if (token !== initialToken) {
              commits.push(
                value.transactions.map((transaction) => transaction.hash),
              );
            }
          });
          if (
            suspendOldRows &&
            token === initialToken &&
            value.transactions.some(
              (transaction) => transaction.hash === 'pending-old',
            )
          ) {
            suspendedRenders += 1;
            throw pendingRender;
          }
          return value;
        },
        {
          initialProps: initialToken,
          wrapper: ({ children }) =>
            createElement(Suspense, { fallback: null }, children),
        },
      );
      const throttledUpdate = mockThrottledTransactionsUpdates[0];
      act(() => throttledUpdate.flush());
      expect(
        result.current.transactions.map((transaction) => transaction.hash),
      ).toEqual(['base-1']);

      suspendOldRows = true;
      act(() => {
        result.current.addNewTransactions([
          createMockTransaction('pending-old', 2),
        ]);
        throttledUpdate.flush();
      });
      // The real transition remains suspended; its rows have not committed.
      expect(suspendedRenders).toBeGreaterThan(0);
      expect(
        result.current.transactions.map((transaction) => transaction.hash),
      ).toEqual(['base-1']);

      mockTokenListRequest.mockReturnValue({
        isLoading: undefined,
        isInitialPending: true,
        run: mockFetchTransactions,
        setStopPolling: mockSetStopPolling,
      });
      rerender(nextToken);
      suspendOldRows = false;
      act(() => throttledUpdate.flush());

      expect(commits.length).toBeGreaterThan(0);
      expect(commits.every((transactions) => transactions.length === 0)).toBe(
        true,
      );
      expect(result.current.isInitialPending).toBe(true);

      mockTokenListRequest.mockReturnValue({
        result: { list: [createMockTransaction('current-token')] },
        isLoading: false,
        run: mockFetchTransactions,
        setStopPolling: mockSetStopPolling,
      });
      rerender(nextToken);
      act(() => throttledUpdate.flush());
      expect(
        result.current.transactions.map((transaction) => transaction.hash),
      ).toEqual(['current-token']);
      expect(result.current.isInitialPending).toBe(false);
    },
  );

  it('ignores pagination responses from an earlier visit to the same token', async () => {
    const initialToken = { tokenAddress: '0xabc', networkId: 'evm--1' };
    const { result, rerender } = renderHook(
      (token) => useMarketTransactions({ ...token, normalMode: false }),
      { initialProps: initialToken },
    );
    const throttledUpdate = mockThrottledTransactionsUpdates[0];
    act(() => throttledUpdate.flush());

    const page = Promise.withResolvers<{
      list: IMarketTokenTransaction[];
      cursor: string;
    }>();
    getMockMarketService().fetchMarketTokenTransactions.mockReturnValue(
      page.promise,
    );
    let pendingPage: Promise<void> | undefined;
    act(() => {
      pendingPage = result.current.loadMore();
    });
    expect(result.current.isLoadingMore).toBe(true);
    mockTokenListRequest.mockReturnValue({
      isLoading: undefined,
      isInitialPending: true,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
    });
    rerender({ ...initialToken, tokenAddress: '0xdef' });
    rerender(initialToken);
    expect(result.current.isLoadingMore).toBe(false);

    await act(async () => {
      page.resolve({
        list: [createMockTransaction('stale-page')],
        cursor: 'stale-cursor',
      });
      await pendingPage;
      throttledUpdate.flush();
    });
    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.isInitialPending).toBe(true);
  });

  it('keeps the current page request active when an older request finishes', async () => {
    const pageA = Promise.withResolvers<{ list: IMarketTokenTransaction[] }>();
    const pageB = Promise.withResolvers<{ list: IMarketTokenTransaction[] }>();
    getMockMarketService()
      .fetchMarketTokenTransactions.mockReturnValueOnce(pageA.promise)
      .mockReturnValueOnce(pageB.promise);
    const { result, rerender } = renderHook(
      ({ tokenAddress }) =>
        useMarketTransactions({
          tokenAddress,
          networkId: 'evm--1',
          normalMode: false,
        }),
      { initialProps: { tokenAddress: '0xabc' } },
    );
    const throttledUpdate = mockThrottledTransactionsUpdates[0];
    act(() => throttledUpdate.flush());
    let pendingA: Promise<void> | undefined;
    act(() => {
      pendingA = result.current.loadMore();
    });
    const addOldTransactions = result.current.addNewTransactions;

    mockTokenListRequest.mockReturnValue({
      result: {
        list: [createMockTransaction('token-b', 2)],
        cursor: 'cursor-b',
      },
      isLoading: false,
      run: mockFetchTransactions,
      setStopPolling: mockSetStopPolling,
    });
    rerender({ tokenAddress: '0xdef' });
    act(() => throttledUpdate.flush());
    let pendingB: Promise<void> | undefined;
    act(() => {
      pendingB = result.current.loadMore();
    });
    expect(
      getMockMarketService().fetchMarketTokenTransactions,
    ).toHaveBeenLastCalledWith({
      tokenAddress: '0xdef',
      networkId: 'evm--1',
      cursor: 'cursor-b',
      limit: 20,
    });
    await act(async () => {
      pageA.resolve({ list: [] });
      await pendingA;
      addOldTransactions([createMockTransaction('stale-live')]);
      throttledUpdate.flush();
    });
    expect(result.current.isLoadingMore).toBe(true);
    expect(result.current.hasMore).toBe(true);
    expect(
      result.current.transactions.map((transaction) => transaction.hash),
    ).toEqual(['token-b']);

    await act(async () => {
      pageB.resolve({ list: [createMockTransaction('page-b', 1)] });
      await pendingB;
      throttledUpdate.flush();
    });
    expect(
      result.current.transactions.map((transaction) => transaction.hash),
    ).toEqual(['token-b', 'page-b']);
    expect(result.current.isLoadingMore).toBe(false);
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
