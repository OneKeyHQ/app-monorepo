import { jest } from '@jest/globals';

import {
  createTradingViewEmbedReadyMonitor,
  isTradingViewChartErrorPayload,
  isTradingViewChartReadyPayload,
} from './tradingViewEmbedReady.web';

describe('tradingViewEmbedReady', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('recognizes the private chart ready message', () => {
    expect(
      isTradingViewChartReadyPayload({
        scope: '$private',
        method: 'tradingview_chartReady',
        data: { symbol: 'BTC' },
      }),
    ).toBe(true);
    expect(
      isTradingViewChartReadyPayload({
        scope: '$private',
        method: 'tradingview_historyReady',
      }),
    ).toBe(false);
  });

  test('resolves when the chart becomes ready', async () => {
    const monitor = createTradingViewEmbedReadyMonitor();

    expect(
      monitor.notify({
        scope: '$private',
        method: 'tradingview_chartReady',
      }),
    ).toBe(true);
    await expect(monitor.wait(1000)).resolves.toBeUndefined();
  });

  test('rejects immediately when the chart reports an error', async () => {
    jest.useFakeTimers();
    const monitor = createTradingViewEmbedReadyMonitor();
    const readyPromise = monitor.wait(15_000);
    const errorPayload = {
      scope: '$private',
      method: 'tradingview_chartError',
      data: { code: 'embed_asset_failed' },
    };

    expect(isTradingViewChartErrorPayload(errorPayload)).toBe(true);
    expect(monitor.notify(errorPayload)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    await expect(readyPromise).rejects.toThrow(
      'TradingView embed chart initialization failed',
    );
  });

  test('rejects when chart readiness times out', async () => {
    jest.useFakeTimers();
    const monitor = createTradingViewEmbedReadyMonitor();
    const readyPromise = monitor.wait(1000);

    jest.advanceTimersByTime(1000);
    await expect(readyPromise).rejects.toThrow(
      'TradingView embed chart ready timed out',
    );
  });

  test('does not time out chart readiness unless a caller requests it', async () => {
    jest.useFakeTimers();
    const monitor = createTradingViewEmbedReadyMonitor();
    const readyPromise = monitor.wait();

    jest.advanceTimersByTime(60_000);
    expect(jest.getTimerCount()).toBe(0);

    monitor.notify({
      scope: '$private',
      method: 'tradingview_chartReady',
    });
    await expect(readyPromise).resolves.toBeUndefined();
  });

  test('cancels a pending readiness timeout without rejecting', async () => {
    jest.useFakeTimers();
    const monitor = createTradingViewEmbedReadyMonitor();
    const readyPromise = monitor.wait(1000);

    monitor.cancel();
    jest.advanceTimersByTime(1000);

    await expect(readyPromise).resolves.toBeUndefined();
  });
});
