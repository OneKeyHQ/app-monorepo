/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

import { usePerpLatestTrade } from './usePerpLatestTrade';
import { usePerpPublicTrades } from './usePerpPublicTrades';

jest.mock('../../../utils/watchHyperliquidPublicTrades', () => ({
  ...jest.requireActual<
    typeof import('../../../utils/watchHyperliquidPublicTrades')
  >('../../../utils/watchHyperliquidPublicTrades'),
  watchHyperliquidPublicTrades: jest.fn(() => jest.fn()),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: { getPerpRecentTrades: jest.fn() },
    serviceHyperliquidSubscription: {
      subscribePublicTrades: jest.fn().mockResolvedValue(true),
      unsubscribePublicTrades: jest.fn().mockResolvedValue(undefined),
    },
  },
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
  const fresh = trade({ tid: 3, px: '101' });
  act(() => feed.onTrades([fresh], true));
  expect(result.current.trade?.px).toBe('101');
  expect(result.current.getSelectablePrice()).toBeUndefined();
  act(() => feed.onTrades([fresh]));
  act(() => feed.onTrades([fresh], true));
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

it('displays strictly newer history without enabling fills and ignores responses after an instrument switch', async () => {
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
  expect(result.current.trade?.px).toBe('102');
  expect(result.current.getSelectablePrice()).toBeUndefined();
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

it('shares history across staggered reconnect acknowledgements and publishes a tape retry to both consumers', async () => {
  fetchSnapshot.mockResolvedValue([]);
  const latest = renderHook(() => usePerpLatestTrade('BTC', true));
  const tape = renderHook(() => usePerpPublicTrades('BTC', true));
  const [latestFeed, tapeFeed] = watch.mock.calls.map(([feed]) => feed);
  const disconnect = () => {
    latestFeed.onStatus?.('disconnected');
    tapeFeed.onStatus?.('disconnected');
  };
  await act(async () => {
    latestFeed.onStatus?.('connected');
    tapeFeed.onStatus?.('connected');
  });
  act(disconnect);
  fetchSnapshot
    .mockClear()
    .mockResolvedValueOnce([trade({ tid: 2, px: '102' })]);
  await act(async () => latestFeed.onStatus?.('connected'));
  await act(async () => tapeFeed.onStatus?.('connected'));
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(600));
  expect(tape.result.current.trades[0]?.px).toBe('102');
  expect(latest.result.current.trade?.px).toBe('102');
  act(disconnect);
  fetchSnapshot.mockRejectedValueOnce(new Error('history unavailable'));
  await act(async () => tapeFeed.onStatus?.('connected'));
  await act(async () => latestFeed.onStatus?.('connected'));
  expect(tape.result.current.isError).toBe(true);
  act(() => tape.result.current.retry());
  fetchSnapshot.mockResolvedValueOnce([trade({ tid: 3, px: '103' })]);
  await act(async () => watch.mock.calls.at(-1)?.[0].onStatus?.('connected'));
  expect(tape.result.current.trades[0]?.px).toBe('103');
  expect(latest.result.current.trade?.px).toBe('103');
  expect(latest.result.current.getSelectablePrice()).toBeUndefined();
});

it('displays a successful cold HTTP read after the first socket subscription fails', async () => {
  const latest = renderHook(() => usePerpLatestTrade('BTC', true));
  const tape = renderHook(() => usePerpPublicTrades('BTC', true));
  const fallback = Promise.withResolvers<IWsTrades>();
  fetchSnapshot.mockReturnValueOnce(fallback.promise);
  act(() => jest.advanceTimersByTime(1000));
  act(() => watch.mock.calls.forEach(([feed]) => feed.onStatus?.('failed')));
  await act(async () => fallback.resolve([trade({ px: '103' })]));
  expect(tape.result.current.trades[0]?.px).toBe('103');
  expect(tape.result.current.isLoading).toBe(false);
  expect(latest.result.current.trade?.px).toBe('103');
  expect(latest.result.current.getSelectablePrice()).toBeUndefined();
});

it.each([true, false])(
  'keeps a recovered price when a tape mounts late (already settled: %s)',
  async (alreadySettled) => {
    fetchSnapshot.mockResolvedValueOnce([]);
    const latest = renderHook(() => usePerpLatestTrade('BTC', true));
    const tickerFeed = watch.mock.calls[0][0];
    await act(async () => tickerFeed.onStatus?.('connected'));
    act(() => tickerFeed.onStatus?.('disconnected'));
    const recovery = Promise.withResolvers<IWsTrades>();
    const newest = trade({ tid: 5, px: '105' });
    fetchSnapshot
      .mockReturnValueOnce(recovery.promise)
      .mockResolvedValueOnce([trade({ tid: 4, px: '104' })]);
    act(() => tickerFeed.onStatus?.('connected'));
    if (alreadySettled) await act(async () => recovery.resolve([newest]));
    const tape = renderHook(() => usePerpPublicTrades('BTC', true));
    await act(async () => watch.mock.calls[1][0].onStatus?.('connected'));
    if (!alreadySettled) await act(async () => recovery.resolve([newest]));
    act(() => jest.advanceTimersByTime(600));
    expect(latest.result.current.trade?.px).toBe('105');
    expect(tape.result.current.trades[0]?.px).toBe('105');
  },
);

it.each([
  ['before mount', 50],
  ['before local failure', 50],
  ['after local failure', 50],
  ['before mount', 0],
  ['after local failure', 1],
] as const)(
  'settles Recent Trades when shared recovery succeeds %s with %i rows',
  async (timing, rowCount) => {
    fetchSnapshot.mockResolvedValueOnce([]);
    renderHook(() => usePerpLatestTrade('BTC', true));
    const tickerFeed = watch.mock.calls[0][0];
    await act(async () => tickerFeed.onStatus?.('connected'));
    act(() => tickerFeed.onStatus?.('disconnected'));
    const recovery = Promise.withResolvers<IWsTrades>();
    const local = Promise.withResolvers<IWsTrades>();
    fetchSnapshot
      .mockReturnValueOnce(recovery.promise)
      .mockReturnValueOnce(local.promise);
    act(() => tickerFeed.onStatus?.('connected'));
    const rows = Array.from({ length: rowCount }, (_, tid) => trade({ tid }));
    const succeed = () => act(async () => recovery.resolve(rows));
    if (timing === 'before mount') await succeed();
    const tape = renderHook(() => usePerpPublicTrades('BTC', true));
    await act(async () => watch.mock.calls[1][0].onStatus?.('connected'));
    if (timing === 'before local failure') await succeed();
    if (timing !== 'after local failure')
      expect(tape.result.current.isLoading).toBe(false);
    await act(async () => local.reject(new Error('independent fetch failed')));
    if (timing === 'after local failure') {
      expect(tape.result.current.isError).toBe(true);
      await succeed();
      act(() => jest.advanceTimersByTime(600));
    }
    expect(tape.result.current.trades).toHaveLength(rowCount);
    expect(tape.result.current.isError).toBe(false);
    expect(tape.result.current.isLoading).toBe(false);
  },
);

it('keeps a manual Retry in control when an earlier shared recovery returns late', async () => {
  fetchSnapshot.mockResolvedValueOnce([]);
  renderHook(() => usePerpLatestTrade('BTC', true));
  const tickerFeed = watch.mock.calls[0][0];
  await act(async () => tickerFeed.onStatus?.('connected'));
  act(() => tickerFeed.onStatus?.('disconnected'));
  const recovery = Promise.withResolvers<IWsTrades>();
  const manual = Promise.withResolvers<IWsTrades>();
  fetchSnapshot
    .mockReturnValueOnce(recovery.promise)
    .mockRejectedValueOnce(new Error('first read failed'))
    .mockReturnValueOnce(manual.promise);
  act(() => tickerFeed.onStatus?.('connected'));
  const tape = renderHook(() => usePerpPublicTrades('BTC', true));
  await act(async () => watch.mock.calls[1][0].onStatus?.('connected'));
  expect(tape.result.current.isError).toBe(true);
  act(() => tape.result.current.retry());
  await act(async () => watch.mock.calls[2][0].onStatus?.('connected'));
  await act(async () => recovery.resolve([trade()]));
  expect(tape.result.current.isLoading).toBe(true);
  await act(async () => manual.reject(new Error('retry failed')));
  expect(tape.result.current.isLoading).toBe(false);
  expect(tape.result.current.isError).toBe(true);
  expect(tape.result.current.trades).toHaveLength(1);
});

it('keeps a display-only event delivered after acknowledgement out of order entry', async () => {
  const actual = jest.requireActual<
    typeof import('../../../utils/watchHyperliquidPublicTrades')
  >('../../../utils/watchHyperliquidPublicTrades');
  watch.mockImplementationOnce(actual.watchHyperliquidPublicTrades);
  const latest = renderHook(() => usePerpLatestTrade('BTC', true));
  await act(async () => undefined);
  const payload = {
    type: 'market',
    subType: ESubscriptionType.TRADES,
    data: [trade({ px: '102' })],
  };
  act(() => {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
      ...payload,
      displayOnly: true,
    });
  });
  expect(latest.result.current.trade?.px).toBe('102');
  expect(latest.result.current.getSelectablePrice()).toBeUndefined();
  act(() => {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, payload);
  });
  expect(latest.result.current.getSelectablePrice()).toBe('102');
});
