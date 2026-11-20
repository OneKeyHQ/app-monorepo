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
