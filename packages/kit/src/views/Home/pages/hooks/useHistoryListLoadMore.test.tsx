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
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type IHistoryLoadMoreTestResponse = {
  txs: IAccountHistoryTx[];
  hasMoreOnChainHistory: boolean;
  next?: string;
  isIndexer?: boolean;
  addressMap?: Record<string, unknown>;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createMockTx(id: string): IAccountHistoryTx {
  return { id } as IAccountHistoryTx;
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

  it('keeps loaded rows stable when a first-page refresh lands during in-flight load-more', async () => {
    const fetchMock = getFetchMock();
    const inflight = createDeferred<IHistoryLoadMoreTestResponse>();
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
        txs: [createMockTx('tx-1'), createMockTx('tx-2')],
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

    // A periodic first-page refresh lands while page 2 is still in flight.
    // The new first page pushed tx-2 out of page 1, so tx-2 must be kept in
    // appended rows instead of shrinking the list back to the first page.
    act(() => {
      result.current.onFirstPageResponse({
        txs: [createMockTx('tx-0'), createMockTx('tx-1')],
        next: 'cursor-new-first-page',
        hasMore: true,
        isIndexer: false,
      });
    });
    await waitFor(() =>
      expect(result.current.appendedTxs.map((tx) => tx.id)).toEqual(['tx-2']),
    );
    expect(result.current.isLoadingMore).toBe(true);

    await act(async () => {
      inflight.resolve({
        txs: [createMockTx('tx-3')],
        hasMoreOnChainHistory: true,
        next: 'cursor-2',
        isIndexer: false,
        addressMap: {},
      });
      await inflight.promise;
    });

    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(result.current.appendedTxs.map((tx) => tx.id)).toEqual([
      'tx-2',
      'tx-3',
    ]);
  });

  it('preserves the loaded range and deep cursor after first-page polling refresh', async () => {
    const fetchMock = getFetchMock();
    fetchMock.mockResolvedValueOnce({
      txs: [createMockTx('tx-3'), createMockTx('tx-4')],
      hasMoreOnChainHistory: true,
      next: 'cursor-2',
      isIndexer: false,
      addressMap: {},
    } satisfies IHistoryLoadMoreTestResponse);

    const { result } = renderHook(() =>
      useHistoryListLoadMore({
        enabled: true,
        accountId: 'account-1',
        networkId: 'evm--1',
      }),
    );

    act(() => {
      result.current.onFirstPageResponse({
        txs: [createMockTx('tx-1'), createMockTx('tx-2')],
        next: 'cursor-1',
        hasMore: true,
        isIndexer: false,
      });
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        cursor: 'cursor-1',
      }),
    );
    expect(result.current.appendedTxs.map((tx) => tx.id)).toEqual([
      'tx-3',
      'tx-4',
    ]);

    act(() => {
      result.current.onFirstPageResponse({
        txs: [createMockTx('tx-0'), createMockTx('tx-1')],
        next: 'cursor-new-first-page',
        hasMore: true,
        isIndexer: false,
      });
    });

    expect(result.current.appendedTxs.map((tx) => tx.id)).toEqual([
      'tx-2',
      'tx-3',
      'tx-4',
    ]);

    fetchMock.mockResolvedValueOnce({
      txs: [createMockTx('tx-5')],
      hasMoreOnChainHistory: false,
      isIndexer: false,
      addressMap: {},
    } satisfies IHistoryLoadMoreTestResponse);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 3,
        cursor: 'cursor-2',
      }),
    );
    expect(result.current.appendedTxs.map((tx) => tx.id)).toEqual([
      'tx-2',
      'tx-3',
      'tx-4',
      'tx-5',
    ]);
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
          txs: [createMockTx('tx-1')],
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
