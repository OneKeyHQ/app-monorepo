/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// Regression test for the "history load-more spinner stuck forever" bug.
//
// Repro: a periodic first-page refresh (polling / focus / visibility) lands
// while a load-more fetch is in flight. `onFirstPageResponse` bumps the
// pagination generation to orphan the in-flight load-more, but (before the fix)
// did NOT clear `inFlightRef` / `isLoadingMore`. When the orphaned load-more
// then resolves, its `finally` block is guarded out by the generation check, so
// the loading flags leak: the footer spinner stays visible forever and every
// subsequent loadMore() bails on the in-flight lock — no self-recovery.

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const globalMockBag = globalThis as typeof globalThis & {
  __historyLoadMoreFetch?: jest.Mock;
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const fetchAccountHistory = jest.fn();
  (globalThis as any).__historyLoadMoreFetch = fetchAccountHistory;
  return {
    __esModule: true,
    default: {
      serviceHistory: {
        fetchAccountHistory,
        fetchAccountHistoryForMergeDerive: jest.fn(),
      },
    },
  };
});

import { useHistoryListLoadMore } from './useHistoryListLoadMore';

function getFetchMock(): jest.Mock {
  const mock = globalMockBag.__historyLoadMoreFetch;
  if (!mock) throw new OneKeyLocalError('fetch mock not initialized');
  return mock;
}

describe('useHistoryListLoadMore', () => {
  beforeEach(() => {
    getFetchMock().mockReset();
  });

  it('clears the loading spinner when a first-page refresh orphans an in-flight load-more', async () => {
    const fetchMock = getFetchMock();
    const inflight = createDeferred<{
      txs: { id: string }[];
      hasMoreOnChainHistory: boolean;
      next?: string;
      isIndexer?: boolean;
      addressMap?: Record<string, unknown>;
    }>();
    fetchMock.mockReturnValueOnce(inflight.promise);

    const { result } = renderHook(() =>
      useHistoryListLoadMore({
        enabled: true,
        accountId: 'account-1',
        networkId: 'evm--1',
      }),
    );

    // Arm pagination (first page says there is more to load).
    act(() => {
      result.current.onFirstPageResponse({
        next: 'cursor-1',
        hasMore: true,
        isIndexer: false,
      });
    });
    expect(result.current.hasMore).toBe(true);

    // User scrolls to the bottom → load-more starts and the spinner shows.
    act(() => {
      void result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A periodic first-page refresh lands WHILE the load-more is still in
    // flight — this bumps the pagination generation, orphaning the load-more.
    act(() => {
      result.current.onFirstPageResponse({
        next: 'cursor-2',
        hasMore: true,
        isIndexer: false,
      });
    });

    // The orphaned load-more now resolves; its generation no longer matches.
    await act(async () => {
      inflight.resolve({
        txs: [{ id: 'tx-1' }],
        hasMoreOnChainHistory: true,
        next: 'cursor-1-next',
        isIndexer: false,
        addressMap: {},
      });
      await inflight.promise;
    });

    // The spinner must NOT be stuck on.
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    // …and the in-flight lock must be released so pagination can recover: a
    // fresh load-more should issue a new fetch rather than bail on the lock.
    const recovery = createDeferred<{
      txs: { id: string }[];
      hasMoreOnChainHistory: boolean;
    }>();
    fetchMock.mockReturnValueOnce(recovery.promise);
    act(() => {
      void result.current.loadMore();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Settle the recovery fetch so its soft-timeout timer is cleared and no
    // real timer leaks past the test.
    await act(async () => {
      recovery.resolve({ txs: [], hasMoreOnChainHistory: false });
      await recovery.promise;
    });
  });

  it('clears the spinner via the soft timeout when the proxy round-trip hangs', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = getFetchMock();
      // A request that never settles — simulates a hung UI<->background bridge
      // or cross-thread transport that the axios HTTP timeout can't recover.
      fetchMock.mockReturnValueOnce(new Promise(() => {}));

      const { result } = renderHook(() =>
        useHistoryListLoadMore({
          enabled: true,
          accountId: 'account-1',
          networkId: 'evm--1',
        }),
      );

      act(() => {
        result.current.onFirstPageResponse({
          next: 'cursor-1',
          hasMore: true,
          isIndexer: false,
        });
      });

      act(() => {
        void result.current.loadMore();
      });
      expect(result.current.isLoadingMore).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance well past the soft timeout — the hung request is abandoned and
      // the loading flags are released so the footer spinner disappears.
      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000);
      });
      expect(result.current.isLoadingMore).toBe(false);

      // The in-flight lock is released too, so a fresh load-more can issue a
      // new fetch rather than bail on the (otherwise stuck) lock.
      fetchMock.mockReturnValueOnce(new Promise(() => {}));
      act(() => {
        void result.current.loadMore();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
