import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceTransform,
  getTradingViewNativePriceY,
  getTradingViewNativeTimeAxisLayout,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
} from './chartLayout';

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

function getLocalTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 12,
) {
  return new Date(year, month, day, hour).getTime() / 1000;
}

function buildPoints({
  count,
  startTimestamp,
  stepSeconds,
}: {
  count: number;
  startTimestamp: number;
  stepSeconds: number;
}): IMarketTokenKLineDataPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    c: 1,
    h: 1,
    l: 1,
    o: 1,
    t: startTimestamp + index * stepSeconds,
    v: 0,
  }));
}

describe('TradingViewNative chart layout', () => {
  it('formats price ticks with six significant digits', () => {
    expect(formatTradingViewNativePriceTick(123.456_789)).toBe('123.457');
    expect(formatTradingViewNativePriceTick(1)).toBe('1');
  });

  it('builds the shared rendering layout for native and web charts', () => {
    const points = buildPoints({
      count: 5,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    points[0] = { ...points[0], h: 2, l: 0.5, v: 3 };
    points[1] = { ...points[1], v: 10 };
    const width = 402;
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width,
    });

    expect(layout).not.toBeNull();
    if (!layout) {
      return;
    }
    expect(getTradingViewNativeChartWidth(width)).toBe(322);
    expect(layout).toMatchObject({
      maxPrice: 2,
      maxVolume: 10,
      priceAxisX: 322,
      timeAxisY: 276,
      volumeBottom: 252,
    });
    expect(layout.priceTicks).toHaveLength(5);
    expect(layout.timeTicks.length).toBeGreaterThan(0);
    expect(getTradingViewNativePriceY(layout.maxPrice, layout)).toBe(24);
  });

  it('maps a static price picture into the visible price range', () => {
    const transform = getTradingViewNativePriceTransform({
      baseMaxPrice: 10,
      basePriceRange: 10,
      priceChartHeight: 100,
      targetMaxPrice: 8,
      targetPriceRange: 4,
    });
    const mapY = (y: number) => y * transform.scaleY + transform.translateY;

    expect(mapY(44)).toBeCloseTo(24);
    expect(mapY(84)).toBeCloseTo(124);
  });

  it('centers a flat visible price range', () => {
    const transform = getTradingViewNativePriceTransform({
      baseMaxPrice: 10,
      basePriceRange: 10,
      priceChartHeight: 100,
      targetMaxPrice: 7,
      targetPriceRange: 0,
    });

    expect(54 * transform.scaleY + transform.translateY).toBeCloseTo(74);
  });

  it('uses minute ticks for an intraday visible range', () => {
    const points = buildPoints({
      count: 61,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: 60,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: 60,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('minute');
    expect(layout.ticks.length).toBeGreaterThan(1);
    expect(layout.ticks.every(({ label }) => /^\d{2}:\d{2}$/.test(label))).toBe(
      true,
    );
  });

  it('keeps hourly candles on intraday labels at mobile chart width', () => {
    const points = buildPoints({
      count: 46,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 8),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 271,
      endIndex: points.length,
      minimumIndexSpacing: getTradingViewNativeTimeTickMinimumIndexSpacing(6),
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('hour');
    expect(layout.ticks.some(({ label }) => /^\d{2}:\d{2}$/.test(label))).toBe(
      true,
    );
  });

  it('keeps tick anchors stable while panning within the same time unit', () => {
    const points = buildPoints({
      count: 72,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 8),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const commonOptions = {
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 271,
      minimumIndexSpacing: getTradingViewNativeTimeTickMinimumIndexSpacing(6),
      points,
    };
    const initialLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 46,
      startIndex: 0,
    });
    const pannedLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 47,
      startIndex: 1,
    });

    expect(initialLayout.unit).toBe('hour');
    expect(pannedLayout.unit).toBe('hour');
    expect(pannedLayout.ticks).toEqual(initialLayout.ticks);
  });

  it('uses day ticks for a multi-week visible range', () => {
    const points = buildPoints({
      count: 29,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_DAY,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_DAY,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('day');
    expect(layout.ticks.length).toBeGreaterThan(1);
  });

  it('uses month ticks for a one-year visible range', () => {
    const points = buildPoints({
      count: 53,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: 7 * SECONDS_PER_DAY,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: 7 * SECONDS_PER_DAY,
      chartWidth: 720,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('month');
    expect(layout.ticks.every(({ label }) => /^\d{4}-\d{2}$/.test(label))).toBe(
      true,
    );
  });

  it('adapts the unit to the visible subset when the chart is zoomed', () => {
    const points = buildPoints({
      count: 61,
      startTimestamp: getLocalTimestamp(2020, 0, 15),
      stepSeconds: 30 * SECONDS_PER_DAY,
    });
    const fullRangeLayout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: 30 * SECONDS_PER_DAY,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });
    const zoomedRangeLayout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: 30 * SECONDS_PER_DAY,
      chartWidth: 720,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: points.length - 6,
    });

    expect(fullRangeLayout.unit).toBe('year');
    expect(zoomedRangeLayout.unit).toBe('month');
  });

  it('keeps ticks apart for short or sparse candle data', () => {
    const points = buildPoints({
      count: 10,
      startTimestamp: getLocalTimestamp(2025, 0, 1),
      stepSeconds: SECONDS_PER_DAY,
    });
    for (let index = 5; index < points.length; index += 1) {
      points[index].t += 20 * SECONDS_PER_DAY;
    }
    const minimumIndexSpacing =
      getTradingViewNativeTimeTickMinimumIndexSpacing(8);
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_DAY,
      chartWidth: 720,
      endIndex: points.length,
      minimumIndexSpacing,
      points,
      startIndex: 0,
    });

    expect(minimumIndexSpacing).toBe(9);
    expect(layout.ticks.length).toBeGreaterThan(1);
    expect(
      layout.ticks.every(
        (tick, index) =>
          index === 0 ||
          tick.index - layout.ticks[index - 1].index >= minimumIndexSpacing,
      ),
    ).toBe(true);
  });

  it('shows the date on the first tick of each new local day', () => {
    const points = buildPoints({
      count: 49,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 8),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('hour');
    expect(layout.ticks.map(({ label }) => label)).toEqual(
      expect.arrayContaining(['01/16', '01/17']),
    );
  });

  it('returns no ticks without a drawable visible range', () => {
    expect(
      getTradingViewNativeTimeAxisLayout({
        candleIntervalSeconds: 60,
        chartWidth: 0,
        endIndex: 0,
        minimumIndexSpacing: 1,
        points: [],
        startIndex: 0,
      }),
    ).toEqual({ ticks: [], unit: null });
  });
});
