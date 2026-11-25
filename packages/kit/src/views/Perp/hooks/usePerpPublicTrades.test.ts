/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

import {
  refreshPerpPublicTrades,
  usePerpPublicTrades,
} from './usePerpPublicTrades';

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceHyperliquid: { getPerpRecentTrades: jest.fn() } },
}));
jest.mock('../../../utils/watchHyperliquidPublicTrades', () => ({
  watchHyperliquidPublicTrades: jest.fn(() => jest.fn()),
}));

const snapshot = jest.spyOn(
  backgroundApiProxy.serviceHyperliquid,
  'getPerpRecentTrades',
);
const watch = jest.mocked(watchHyperliquidPublicTrades);

let coin: string;
let marketId = 0;

function trades(start: number, count: number): IRecentTrade[] {
  return Array.from({ length: count }, (_, index) => ({
    coin,
    side: 'B',
    px: '10',
    sz: '1',
    time: start + index,
    tid: start + index,
    hash: '0x123',
    users: ['0x1', '0x2'],
  }));
}

beforeEach(() => {
  jest.useFakeTimers();
  marketId += 1;
  coin = `test-market-${marketId}`;
  snapshot.mockReset();
  watch.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

it.each([
  { wsRows: 30, immediately: 30, afterDeadline: 30 },
  { wsRows: 1, immediately: 0, afterDeadline: 11 },
])(
  'groups an initial 10-row snapshot with a $wsRows-row replay without delaying later trades',
  async ({ wsRows, immediately, afterDeadline }) => {
    snapshot.mockResolvedValueOnce(trades(21, 10));
    const { result } = renderHook(() => usePerpPublicTrades(coin, true));
    const feed = watch.mock.calls[0][0];
    await act(async () => {
      feed.onStatus?.('connected');
    });
    expect(result.current.trades).toHaveLength(0);
    expect(result.current.isLoading).toBe(true);
    act(() => {
      jest.advanceTimersByTime(400);
      feed.onTrades(trades(1, wsRows));
    });
    expect(result.current.trades).toHaveLength(immediately);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.trades).toHaveLength(afterDeadline);
    expect(result.current.trades[0].tid).toBe(30);
    act(() => feed.onTrades(trades(80, 1)));
    expect(result.current.trades).toHaveLength(afterDeadline + 1);
  },
);

it('keeps a late successful fallback after the acknowledged backfill fails', async () => {
  let resolveFallback: (value: IRecentTrade[]) => void = () => undefined;
  snapshot
    .mockReturnValueOnce(
      new Promise<IRecentTrade[]>((resolve) => {
        resolveFallback = resolve;
      }),
    )
    .mockRejectedValueOnce(new Error('backfill failed'));
  const { result } = renderHook(() => usePerpPublicTrades(coin, true));
  act(() => {
    jest.runOnlyPendingTimers();
  });
  await act(async () => {
    watch.mock.calls[0][0].onStatus?.('connected');
  });
  await act(async () => {
    resolveFallback(trades(1, 10));
  });
  expect(result.current.trades).toHaveLength(10);
  expect(result.current.isError).toBe(true);
  expect(result.current.isLoading).toBe(false);
});

it.each([0, 50])(
  'retains the error and %i existing rows while retrying until recovery succeeds',
  async (rowCount) => {
    snapshot.mockResolvedValueOnce(trades(1, rowCount));
    const { result } = renderHook(() => usePerpPublicTrades(coin, true));
    const feed = watch.mock.calls[0][0];
    await act(async () => {
      feed.onStatus?.('connected');
    });
    snapshot.mockRejectedValueOnce(new Error('unavailable'));
    await act(async () => {
      feed.onStatus?.('disconnected');
      feed.onStatus?.('connected');
    });
    expect(result.current.isError).toBe(true);

    snapshot.mockRejectedValueOnce(new Error('still unavailable'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.trades).toHaveLength(rowCount);

    snapshot.mockResolvedValueOnce(trades(51, 50));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.isDisconnected).toBe(false);
    expect(result.current.trades[0].tid).toBe(100);
  },
);

it('fills the gap between a slow subscription and the first replay without refetching on duplicate acknowledgements', async () => {
  snapshot
    .mockResolvedValueOnce(trades(1, 50))
    .mockResolvedValueOnce(trades(41, 50));
  const { result } = renderHook(() => usePerpPublicTrades(coin, true));
  const feed = watch.mock.calls[0][0];
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(result.current.trades).toHaveLength(50);

  await act(async () => {
    feed.onTrades(trades(61, 30));
    feed.onStatus?.('connected');
    feed.onStatus?.('connected');
  });
  expect(snapshot).toHaveBeenCalledTimes(2);
  expect(result.current.trades.map((trade) => trade.tid)).toEqual(
    trades(41, 50)
      .map((trade) => trade.tid)
      .toReversed(),
  );
});

it('clears a backfill failure only after the live connection covers a full distinct window', async () => {
  snapshot.mockResolvedValueOnce(trades(1, 50));
  const { result } = renderHook(() => usePerpPublicTrades(coin, true));
  const feed = watch.mock.calls[0][0];
  await act(async () => {
    feed.onStatus?.('connected');
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(snapshot).toHaveBeenCalledTimes(1);

  snapshot.mockRejectedValueOnce(new Error('unavailable'));
  await act(async () => {
    feed.onStatus?.('disconnected');
    feed.onStatus?.('connected');
    feed.onTrades(trades(51, 49));
    feed.onTrades(trades(51, 49));
  });
  expect(result.current.trades).toHaveLength(50);
  expect(result.current.isError).toBe(true);
  act(() => feed.onTrades(trades(100, 1)));
  expect(result.current.isError).toBe(false);

  snapshot.mockRejectedValueOnce(new Error('late failure'));
  await act(async () => {
    feed.onStatus?.('disconnected');
    feed.onStatus?.('connected');
    feed.onTrades(trades(101, 50));
  });
  expect(result.current.isError).toBe(false);
  expect(result.current.isLoading).toBe(false);
});

it.each(['disconnected', 'failed', 'connected'] as const)(
  'shows cached rows immediately when remounting with a %s subscription and a failed snapshot',
  async (status) => {
    snapshot.mockResolvedValueOnce(trades(1, 3));
    const first = renderHook(() => usePerpPublicTrades(coin, true));
    await act(async () => {
      watch.mock.calls.at(-1)?.[0].onStatus?.('connected');
    });
    first.unmount();

    snapshot.mockRejectedValueOnce(new Error('snapshot unavailable'));
    const { result } = renderHook(() => usePerpPublicTrades(coin, true));
    expect(result.current.trades).toHaveLength(3);
    await act(async () => {
      watch.mock.calls.at(-1)?.[0].onStatus?.(status);
      if (status !== 'connected') {
        await jest.advanceTimersByTimeAsync(1000);
      }
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.trades.map((trade) => trade.tid)).toEqual([3, 2, 1]);

    act(() => watch.mock.calls.at(-1)?.[0].onTrades(trades(4, 1)));
    expect(result.current.trades.map((trade) => trade.tid)).toEqual([
      4, 3, 2, 1,
    ]);
  },
);

it('isolates full market identities and ignores callbacks from a previous market', async () => {
  const originalCoin = coin;
  snapshot.mockResolvedValueOnce(trades(1, 30));
  const { result, rerender } = renderHook(
    ({ market }) => usePerpPublicTrades(market, true),
    { initialProps: { market: originalCoin } },
  );
  const oldFeed = watch.mock.calls.at(-1)?.[0];
  await act(async () => oldFeed?.onStatus?.('connected'));
  rerender({ market: `xyz:${originalCoin}` });
  expect(result.current.trades).toHaveLength(0);
  act(() => {
    oldFeed?.onTrades(trades(100, 30));
    oldFeed?.onStatus?.('failed');
  });
  expect(result.current.trades).toHaveLength(0);
  expect(result.current.isDisconnected).toBe(false);
  rerender({ market: originalCoin });
  expect(result.current.trades).toHaveLength(30);
  expect(result.current.trades[0].tid).toBe(30);
});

it('does not restore expired cached rows on a new mount', async () => {
  snapshot.mockResolvedValueOnce(trades(1, 30));
  const first = renderHook(() => usePerpPublicTrades(coin, true));
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  first.unmount();
  jest.advanceTimersByTime(5 * 60_000);
  const { result } = renderHook(() => usePerpPublicTrades(coin, true));
  expect(result.current.trades).toHaveLength(0);
});

it('does not extend cached rows when a later snapshot has no matching trades', async () => {
  snapshot.mockResolvedValueOnce(trades(1, 30));
  const first = renderHook(() => usePerpPublicTrades(coin, true));
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  first.unmount();
  jest.advanceTimersByTime(4 * 60_000);

  snapshot.mockResolvedValueOnce(
    trades(31, 30).map((trade) => ({
      ...trade,
      coin: `other:${coin}`,
    })),
  );
  const second = renderHook(() => usePerpPublicTrades(coin, true));
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  expect(second.result.current.trades).toHaveLength(30);
  expect(second.result.current.isLoading).toBe(false);
  second.unmount();

  jest.advanceTimersByTime(2 * 60_000);
  const third = renderHook(() => usePerpPublicTrades(coin, true));
  expect(third.result.current.trades).toHaveLength(0);
});

it.each(['connected', 'disconnected'] as const)(
  'refreshes a %s active feed immediately and coalesces simultaneous requests',
  async (status) => {
    snapshot.mockResolvedValueOnce(trades(1, 30));
    const { result, unmount } = renderHook(() =>
      usePerpPublicTrades(coin, true),
    );
    const feed = watch.mock.calls.at(-1)?.[0];
    await act(async () => feed?.onStatus?.('connected'));
    act(() => feed?.onStatus?.(status));
    snapshot.mockResolvedValueOnce(trades(31, 30));
    await act(async () => {
      await Promise.all([refreshPerpPublicTrades(), refreshPerpPublicTrades()]);
    });
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(result.current.trades[0].tid).toBe(60);
    expect(watch).toHaveBeenCalledTimes(status === 'connected' ? 1 : 2);
    if (status === 'disconnected') {
      expect(watch.mock.results[0].value).toHaveBeenCalledTimes(1);
    }
    unmount();
    await act(async () => refreshPerpPublicTrades());
    expect(snapshot).toHaveBeenCalledTimes(2);
  },
);

it('refreshes during snapshot backoff without restarting a connected watcher', async () => {
  snapshot.mockRejectedValueOnce(new Error('unavailable'));
  const { result } = renderHook(() => usePerpPublicTrades(coin, true));
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  snapshot.mockResolvedValueOnce(trades(1, 30));
  await act(async () => refreshPerpPublicTrades());
  expect(result.current.isError).toBe(false);
  expect(result.current.trades).toHaveLength(30);
  await act(async () => jest.advanceTimersByTimeAsync(30_000));
  expect(snapshot).toHaveBeenCalledTimes(2);
  expect(watch).toHaveBeenCalledTimes(1);
});

it('refreshes the new market while the previous market snapshot is still pending', async () => {
  let resolveOld: (value: IRecentTrade[]) => void = () => undefined;
  snapshot.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ market }) => usePerpPublicTrades(market, true),
    { initialProps: { market: coin } },
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = refreshPerpPublicTrades();
  });
  const nextCoin = `next:${coin}`;
  rerender({ market: nextCoin });
  snapshot.mockResolvedValueOnce(
    trades(100, 30).map((trade) => ({ ...trade, coin: nextCoin })),
  );
  await act(async () => refreshPerpPublicTrades());
  expect(snapshot).toHaveBeenLastCalledWith({ coin: nextCoin });
  expect(result.current.trades[0].coin).toBe(nextCoin);
  await act(async () => {
    resolveOld(trades(1, 30));
    await pending;
  });
  expect(result.current.trades[0].coin).toBe(nextCoin);
});

it('stops snapshot retries when paused and resumes with cached rows', async () => {
  snapshot.mockResolvedValueOnce(trades(1, 30));
  const { result, rerender, unmount } = renderHook(
    ({ active }) => usePerpPublicTrades(coin, active),
    { initialProps: { active: true } },
  );
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  snapshot.mockRejectedValueOnce(new Error('snapshot unavailable'));
  await act(async () => {
    const feed = watch.mock.calls.at(-1)?.[0];
    feed?.onStatus?.('disconnected');
    feed?.onStatus?.('connected');
  });
  rerender({ active: false });
  await act(async () => jest.advanceTimersByTimeAsync(30_000));
  expect(snapshot).toHaveBeenCalledTimes(2);
  expect(result.current.trades).toHaveLength(30);
  rerender({ active: true });
  expect(result.current.trades).toHaveLength(30);
  unmount();
  await act(async () => jest.advanceTimersByTimeAsync(30_000));
  expect(snapshot).toHaveBeenCalledTimes(2);
});
