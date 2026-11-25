/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

import { usePerpLatestTrade } from './usePerpLatestTrade';

jest.mock('../../../utils/watchHyperliquidPublicTrades', () => ({
  ...jest.requireActual<
    typeof import('../../../utils/watchHyperliquidPublicTrades')
  >('../../../utils/watchHyperliquidPublicTrades'),
  watchHyperliquidPublicTrades: jest.fn(() => jest.fn()),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceHyperliquid: { getPerpRecentTrades: jest.fn() } },
}));

const watch = jest.mocked(watchHyperliquidPublicTrades);
const fetchSnapshot = jest.spyOn(
  backgroundApiProxy.serviceHyperliquid,
  'getPerpRecentTrades',
);
const trade = (
  overrides: Partial<IWsTrades[number]> = {},
): IWsTrades[number] => ({
  coin: 'BTC',
  side: 'B',
  px: '100',
  sz: '1',
  time: Date.now(),
  tid: 1,
  hash: '0x123',
  users: ['0x1', '0x2'],
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  watch.mockClear();
  fetchSnapshot.mockReset();
  fetchSnapshot.mockReturnValue(new Promise(() => undefined));
});
afterEach(() => jest.useRealTimers());

it('selects by time then trade ID, including same-price direction changes', () => {
  const { result } = renderHook(() => usePerpLatestTrade('BTC', true));
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade({ tid: 3, side: 'A' }), trade({ tid: 2 }), trade()]);
  });
  expect(result.current.trade?.side).toBe('A');
  expect(result.current.getSelectablePrice()).toBe('100');
  act(() => feed.onTrades([trade({ tid: 2, px: '999' })]));
  expect(result.current.trade?.tid).toBe(3);
  act(() => feed.onTrades([trade({ time: 1001, tid: 1 })]));
  expect(result.current.trade?.side).toBe('B');
  act(() =>
    feed.onTrades([
      trade({ coin: 'ETH', time: 1002 }),
      trade({ px: 'NaN', time: 1003 }),
      trade({ px: '0', time: 1004 }),
    ]),
  );
  expect(result.current.trade?.time).toBe(1001);
});

it('disables stale prices and disconnected batches until fresh connected data arrives', () => {
  const { result } = renderHook(() => usePerpLatestTrade('BTC', true));
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade()]);
  });
  act(() => jest.advanceTimersByTime(30_000));
  expect(result.current.trade?.px).toBe('100');
  expect(result.current.isInteractive).toBe(false);
  expect(result.current.getSelectablePrice()).toBeUndefined();
  act(() => {
    feed.onStatus?.('disconnected');
    feed.onTrades([trade({ tid: 2 })]);
  });
  expect(result.current.isInteractive).toBe(false);
  act(() => feed.onStatus?.('connected'));
  expect(result.current.getSelectablePrice()).toBeUndefined();
  act(() => feed.onTrades([trade({ tid: 3, px: '101' })]));
  expect(result.current.getSelectablePrice()).toBe('101');
});

it('backfills once on reconnect and keeps the recovered price display-only until a live trade arrives', async () => {
  fetchSnapshot.mockResolvedValueOnce([trade()]);
  const { result } = renderHook(() => usePerpLatestTrade('BTC', true));
  await act(async () => undefined);
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade()]);
    feed.onStatus?.('disconnected');
  });
  fetchSnapshot.mockResolvedValueOnce([trade({ tid: 2, px: '105' })]);
  await act(async () => {
    feed.onStatus?.('connected');
    feed.onStatus?.('connected');
  });
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  expect(result.current.trade?.px).toBe('105');
  expect(result.current.getSelectablePrice()).toBeUndefined();
  act(() => feed.onTrades([trade({ tid: 3, px: '106' })]));
  expect(result.current.getSelectablePrice()).toBe('106');
});

it('clears on instrument changes, retains inactive display, and ignores late callbacks', () => {
  const { result, rerender, unmount } = renderHook(
    ({ coin, active }) => usePerpLatestTrade(coin, active),
    { initialProps: { coin: 'BTC', active: true } },
  );
  const oldFeed = watch.mock.calls[0][0];
  act(() => oldFeed.onTrades([trade()]));
  rerender({ coin: 'ETH', active: true });
  expect(watch.mock.results[0].value).toHaveBeenCalledTimes(1);
  act(() => oldFeed.onTrades([trade({ tid: 9 })]));
  expect(result.current.trade).toBeUndefined();
  const newFeed = watch.mock.calls[1][0];
  act(() => {
    newFeed.onStatus?.('connected');
    newFeed.onTrades([trade({ coin: 'ETH' })]);
  });
  expect(result.current.trade?.coin).toBe('ETH');
  rerender({ coin: 'ETH', active: false });
  expect(result.current.trade?.coin).toBe('ETH');
  expect(result.current.getSelectablePrice()).toBeUndefined();
  expect(watch.mock.results[1].value).toHaveBeenCalledTimes(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps the price and direction while opening and dismissing a selector without changing coins', () => {
  const { result, rerender } = renderHook(
    ({ active }) => usePerpLatestTrade('BTC', active),
    { initialProps: { active: true } },
  );
  const firstFeed = watch.mock.calls[0][0];
  act(() => {
    firstFeed.onStatus?.('connected');
    firstFeed.onTrades([trade({ tid: 5, side: 'A' })]);
  });
  rerender({ active: false });
  expect(result.current.trade?.px).toBe('100');
  expect(result.current.trade?.side).toBe('A');
  expect(result.current.isInteractive).toBe(false);
  rerender({ active: true });
  expect(result.current.trade?.px).toBe('100');
  expect(result.current.getSelectablePrice()).toBeUndefined();
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  const resumedFeed = watch.mock.calls[1][0];
  act(() => {
    resumedFeed.onStatus?.('connected');
    resumedFeed.onTrades([trade({ tid: 4, px: '99' })]);
  });
  expect(result.current.trade?.tid).toBe(5);
  expect(result.current.isInteractive).toBe(false);
  act(() => resumedFeed.onTrades([trade({ tid: 6, px: '101' })]));
  expect(result.current.getSelectablePrice()).toBe('101');
});

it('seeds a new market from recent trades while waiting for the first websocket batch', async () => {
  fetchSnapshot.mockResolvedValueOnce([trade({ side: 'A' })]);
  const { result } = renderHook(() => usePerpLatestTrade('BTC', true));
  await act(async () => undefined);
  expect(result.current.trade?.px).toBe('100');
  expect(result.current.trade?.side).toBe('A');
  expect(result.current.isInteractive).toBe(false);
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade({ tid: 2, px: '101' })]);
  });
  expect(result.current.getSelectablePrice()).toBe('101');
});

it('ignores late HTTP snapshots after newer trades or an instrument switch', async () => {
  let resolveSnapshot: (trades: IWsTrades) => void = () => undefined;
  fetchSnapshot.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSnapshot = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ coin }) => usePerpLatestTrade(coin, true),
    { initialProps: { coin: 'BTC' } },
  );
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade({ tid: 2, px: '101' })]);
  });
  await act(async () => resolveSnapshot([trade({ tid: 3, px: '102' })]));
  expect(result.current.getSelectablePrice()).toBe('101');
  fetchSnapshot.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSnapshot = resolve;
    }),
  );
  rerender({ coin: 'ETH' });
  rerender({ coin: 'SOL' });
  await act(async () => resolveSnapshot([trade({ coin: 'ETH' })]));
  expect(result.current.trade).toBeUndefined();
});

it('rejects old socket trades and expires using exchange time', () => {
  const { result } = renderHook(() => usePerpLatestTrade('BTC', true));
  const feed = watch.mock.calls[0][0];
  act(() => {
    feed.onStatus?.('connected');
    feed.onTrades([trade({ time: Date.now() - 60_000 })]);
  });
  expect(result.current.getSelectablePrice()).toBeUndefined();
  act(() => feed.onTrades([trade({ time: Date.now() - 20_000 })]));
  expect(result.current.getSelectablePrice()).toBe('100');
  act(() => jest.advanceTimersByTime(10_000));
  expect(result.current.isInteractive).toBe(false);
  expect(result.current.getSelectablePrice()).toBeUndefined();
});

it('shares the HTTP snapshot and feed across visible consumers and remounts', async () => {
  fetchSnapshot.mockResolvedValueOnce([trade()]);
  const ticker = renderHook(() => usePerpLatestTrade('BTC', true));
  const book = renderHook(() => usePerpLatestTrade('BTC', true));
  await act(async () => undefined);
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  expect(watch).toHaveBeenCalledTimes(1);
  expect(book.result.current.trade).toBe(ticker.result.current.trade);
  book.unmount();
  const remounted = renderHook(() => usePerpLatestTrade('BTC', true));
  expect(remounted.result.current.trade).toBe(ticker.result.current.trade);
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  act(() => {
    watch.mock.calls[0][0].onStatus?.('connected');
    watch.mock.calls[0][0].onTrades([trade({ tid: 2, px: '101' })]);
  });
  expect(remounted.result.current.getSelectablePrice()).toBe('101');
  expect(ticker.result.current.getSelectablePrice()).toBe('101');
});

it('backfills after an extended pause while retaining the previous display', async () => {
  fetchSnapshot.mockResolvedValueOnce([trade()]);
  const { result, rerender } = renderHook(
    ({ active }) => usePerpLatestTrade('BTC', active),
    { initialProps: { active: true } },
  );
  await act(async () => undefined);
  rerender({ active: false });
  act(() => jest.advanceTimersByTime(31_000));
  fetchSnapshot.mockResolvedValueOnce([trade({ tid: 2, px: '102' })]);
  rerender({ active: true });
  expect(result.current.trade?.px).toBe('100');
  await act(async () => undefined);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  expect(result.current.trade?.px).toBe('102');
  expect(result.current.getSelectablePrice()).toBeUndefined();
});
