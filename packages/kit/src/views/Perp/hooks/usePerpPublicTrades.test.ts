/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

import { usePerpPublicTrades } from './usePerpPublicTrades';

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

function trades(start: number, count: number): IRecentTrade[] {
  return Array.from({ length: count }, (_, index) => ({
    coin: 'BTC',
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
    const { result } = renderHook(() => usePerpPublicTrades('BTC', true));
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
  const { result } = renderHook(() => usePerpPublicTrades('BTC', true));
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
    const { result } = renderHook(() => usePerpPublicTrades('BTC', true));
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
    act(() => result.current.retry());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.trades).toHaveLength(rowCount);
    await act(async () => {
      watch.mock.calls.at(-1)?.[0].onStatus?.('connected');
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.trades).toHaveLength(rowCount);

    snapshot.mockResolvedValueOnce(trades(51, 50));
    act(() => result.current.retry());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(true);
    await act(async () => {
      watch.mock.calls.at(-1)?.[0].onStatus?.('connected');
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
  const { result } = renderHook(() => usePerpPublicTrades('BTC', true));
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
  const { result } = renderHook(() => usePerpPublicTrades('BTC', true));
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
