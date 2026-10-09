import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativeKLineInterval } from '../../tradingViewNativeIntervals';

import { createTradingViewNativeHyperliquidDataProvider } from './hyperliquidDataProvider';
import { tradingViewNativeHyperliquidGateway } from './tradingViewNativeHyperliquidGateway';

jest.mock('./tradingViewNativeHyperliquidGateway', () => ({
  tradingViewNativeHyperliquidGateway: {
    fetchCandles: jest.fn(),
    subscribeCandle: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { networkDoctor: { log: { error: jest.fn() } } },
}));

const gateway = jest.mocked(tradingViewNativeHyperliquidGateway);
const source = {
  kind: 'hyperliquid',
  coin: 'BTC',
  environment: 'mainnet',
} as const;
const ts = (date: string) => Date.parse(date) / 1000;
const interval = (value: string) => {
  const result = getTradingViewNativeKLineInterval(value);
  if (!result) throw new OneKeyLocalError('Missing test interval');
  return result;
};
const point = (
  date: string,
  overrides: Partial<IMarketTokenKLineDataPoint> = {},
) => ({
  t: ts(date),
  o: 100,
  h: 110,
  l: 90,
  c: 105,
  v: 10,
  ...overrides,
});
const response = (points: IMarketTokenKLineDataPoint[]) => ({
  points,
  total: points.length,
});
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Hyperliquid native calendar provider', () => {
  let listener: (value: IMarketTokenKLineDataPoint) => void;
  const unsubscribe = jest.fn();
  const ensure = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T12:00:00Z'));
    gateway.fetchCandles.mockResolvedValue(
      response([point('2026-10-05'), point('2026-10-09')]),
    );
    unsubscribe.mockResolvedValue(undefined);
    ensure.mockResolvedValue(undefined);
    gateway.subscribeCandle.mockImplementation(async (request) => {
      listener = request.listener;
      return { ensure, unsubscribe };
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const subscribe = (
    value = '1W',
    controller = new AbortController(),
    onPoint = jest.fn(),
  ) => {
    return {
      onPoint,
      promise: createTradingViewNativeHyperliquidDataProvider(
        source,
      ).subscribeRealtime({
        interval: interval(value),
        signal: controller.signal,
        subscriberId: 'chart',
        onPoint,
      }),
    };
  };

  it.each([
    ['1W', '2026-10-05', '2026-10-11T23:59:59Z'],
    ['1M', '2026-10-01', '2026-10-31T23:59:59Z'],
  ])(
    'loads complete calendar %s boundaries using daily candles',
    async (value, from, to) => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-09'));
      await createTradingViewNativeHyperliquidDataProvider(source).fetchHistory(
        {
          interval: interval(value),
          signal: new AbortController().signal,
          timeFrom: ts('2026-10-08'),
          timeTo: ts('2026-10-09'),
        },
      );
      expect(gateway.fetchCandles.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          interval: '1d',
          timeFrom: ts(from),
          timeTo: ts(to),
        }),
      );
    },
  );

  it('preserves normal interval history and subscription contracts', async () => {
    const provider = createTradingViewNativeHyperliquidDataProvider(source);
    const signal = new AbortController().signal;
    await provider.fetchHistory({
      interval: interval('60'),
      signal,
      timeFrom: 1,
      timeTo: 2,
    });
    expect(gateway.fetchCandles.mock.calls.at(-1)?.[0]).toEqual({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      signal,
      timeFrom: 1,
      timeTo: 2,
    });
    const onPoint = jest.fn();
    await provider.subscribeRealtime({
      interval: interval('60'),
      signal,
      subscriberId: 'plain',
      onPoint,
    });
    expect(gateway.subscribeCandle.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ interval: '1h', listener: onPoint }),
    );
  });

  it('does not confuse aggregated bar count with the 5000 source candle limit', () => {
    const provider = createTradingViewNativeHyperliquidDataProvider(source);
    expect(
      provider.getHistoryRequestCandleCount(interval('1W')) * 7,
    ).toBeLessThan(5000);
    expect(
      provider.getHistoryRequestCandleCount(interval('1M')) * 31,
    ).toBeLessThan(5000);
    expect(
      provider.hasMoreHistory({
        interval: interval('1W'),
        receivedPointCount: 2,
      }),
    ).toBe(true);
    expect(
      provider.hasMoreHistory({
        interval: interval('1M'),
        receivedPointCount: 0,
      }),
    ).toBe(false);
  });

  it('seeds the whole week before publishing a daily websocket update', async () => {
    const seed = deferred<ReturnType<typeof response>>();
    gateway.fetchCandles.mockReturnValueOnce(seed.promise);
    const { onPoint, promise } = subscribe();
    await flush();
    listener(point('2026-10-09', { h: 130, c: 125, v: 12 }));
    expect(onPoint).not.toHaveBeenCalled();
    seed.resolve(
      response([point('2026-10-05', { o: 80, l: 70 }), point('2026-10-09')]),
    );
    await promise;
    expect(onPoint).toHaveBeenLastCalledWith(
      point('2026-10-05', { o: 80, h: 130, l: 70, c: 125, v: 22 }),
    );
    expect(gateway.subscribeCandle.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ interval: '1d' }),
    );
  });

  it('replaces repeated daily snapshots without adding volume twice', async () => {
    const { onPoint, promise } = subscribe();
    await promise;
    listener(point('2026-10-09', { c: 106, v: 11 }));
    listener(point('2026-10-09', { c: 107, v: 12 }));
    expect(onPoint).toHaveBeenLastCalledWith(
      point('2026-10-05', { c: 107, v: 22 }),
    );
    const count = onPoint.mock.calls.length;
    listener(point('2026-10-08', { c: 999 }));
    expect(onPoint).toHaveBeenCalledTimes(count);
  });

  it('keeps the day-transition frame when the refill returns an older snapshot', async () => {
    const { onPoint, promise } = subscribe();
    await promise;
    gateway.fetchCandles.mockResolvedValueOnce(
      response([point('2026-10-05'), point('2026-10-09'), point('2026-10-10')]),
    );
    listener(point('2026-10-10', { h: 180, c: 170, v: 30 }));
    await flush();
    expect(onPoint).toHaveBeenLastCalledWith(
      point('2026-10-05', { h: 180, c: 170, v: 50 }),
    );
  });

  it('backfills missed days before publishing after a day gap', async () => {
    const { onPoint, promise } = subscribe();
    await promise;
    gateway.fetchCandles.mockResolvedValueOnce(
      response([
        point('2026-10-05'),
        point('2026-10-09'),
        point('2026-10-10', { h: 150 }),
        point('2026-10-11', { c: 120, v: 15 }),
      ]),
    );
    listener(point('2026-10-11', { c: 120, v: 15 }));
    await flush();
    expect(onPoint).toHaveBeenLastCalledWith(
      point('2026-10-05', { h: 150, c: 120, v: 45 }),
    );
  });

  it.each([
    ['1W', '2026-10-12'],
    ['1M', '2026-11-01'],
  ])('starts a clean %s bucket at %s', async (value, nextDay) => {
    const { onPoint, promise } = subscribe(value);
    await promise;
    const nextPoint = point(nextDay, { o: 200, h: 220, l: 190, c: 210, v: 7 });
    gateway.fetchCandles.mockResolvedValueOnce(response([nextPoint]));
    listener(nextPoint);
    await flush();
    expect(onPoint).toHaveBeenLastCalledWith(nextPoint);
  });

  it('refreshes the full bucket on ensure and preserves newer frames during the request', async () => {
    const { onPoint, promise } = subscribe();
    const subscription = await promise;
    const refresh = deferred<ReturnType<typeof response>>();
    gateway.fetchCandles.mockReturnValueOnce(refresh.promise);
    const recovery = subscription?.ensure();
    await flush();
    listener(point('2026-10-09', { h: 140, c: 130, v: 20 }));
    refresh.resolve(
      response([point('2026-10-05', { h: 150 }), point('2026-10-09')]),
    );
    await recovery;
    expect(onPoint).toHaveBeenLastCalledWith(
      point('2026-10-05', { h: 150, c: 130, v: 30 }),
    );
  });

  it('does not publish or keep a subscription after abort during seeding', async () => {
    const seed = deferred<ReturnType<typeof response>>();
    gateway.fetchCandles.mockReturnValueOnce(seed.promise);
    const controller = new AbortController();
    const { onPoint, promise } = subscribe('1W', controller);
    await flush();
    controller.abort();
    seed.resolve(response([point('2026-10-09')]));
    expect(await promise).toBeNull();
    listener(point('2026-10-09'));
    expect(onPoint).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not publish a late refill after unsubscribe', async () => {
    const { onPoint, promise } = subscribe();
    const subscription = await promise;
    const seed = deferred<ReturnType<typeof response>>();
    gateway.fetchCandles.mockReturnValueOnce(seed.promise);
    listener(point('2026-10-10'));
    await subscription?.unsubscribe();
    onPoint.mockClear();
    seed.resolve(response([point('2026-10-10')]));
    await flush();
    expect(onPoint).not.toHaveBeenCalled();
  });

  it('cleans up the websocket when initial history fails', async () => {
    gateway.fetchCandles.mockRejectedValueOnce(new Error('offline'));
    await expect(subscribe().promise).rejects.toThrow('offline');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
