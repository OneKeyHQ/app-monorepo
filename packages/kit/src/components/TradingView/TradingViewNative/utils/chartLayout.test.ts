import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING,
  TRADING_VIEW_NATIVE_PRICE_EXTREMA_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_LEGEND_TOP,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../chartConstants';

import {
  formatTradingViewNativeCrosshairTime,
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativeCurrentPriceLabel,
  getTradingViewNativeCurrentPriceLayout,
  getTradingViewNativeMaxVolume,
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceAxisLabel,
  getTradingViewNativePriceAxisWidth,
  getTradingViewNativePriceExtremumHorizontalLayout,
  getTradingViewNativePriceY,
  getTradingViewNativeScaledPriceAxisLabel,
  getTradingViewNativeTimeAxisLayout,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
  getTradingViewNativeVolumeAtY,
  getTradingViewNativeVolumeBarHeight,
  getTradingViewNativeWatermarkLayout,
  hasTradingViewNativeVolume,
} from './chartLayout';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * 60 * 60;

function getLocalTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
) {
  return new Date(year, month, day, hour, minute).getTime() / 1000;
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
  it('formats price ticks with the shared price display precision', () => {
    expect(formatTradingViewNativePriceTick(123.456_789)).toBe('123.46');
    expect(formatTradingViewNativePriceTick(1)).toBe('1.00');
    expect(formatTradingViewNativePriceTick(0)).toBe('0.00');
    expect(formatTradingViewNativePriceTick(0.135_573)).toBe('0.1356');
    expect(formatTradingViewNativePriceTick(0.004_542_83)).toBe('0.004543');
    expect(formatTradingViewNativePriceTick(0.000_045_428_3)).toBe(
      '0.00004543',
    );
    expect(formatTradingViewNativePriceTick(0.000_002_547)).toBe('0.0₅2547');
    expect(formatTradingViewNativePriceTick(0.000_000_000_149_73)).toBe(
      '0.0₉1497',
    );
    expect(formatTradingViewNativePriceTick(-0.000_002_547)).toBe('-0.0₅2547');
    expect(formatTradingViewNativePriceTick(0.999_99)).toBe('1.00');
    expect(formatTradingViewNativePriceTick(-0.999_99)).toBe('-1.00');
    expect(formatTradingViewNativePriceTick(Number.NaN)).toBe('--');
  });

  it('grows the price axis with the longest formatted price', () => {
    const regularPoints = buildPoints({
      count: 1,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    regularPoints[0] = {
      ...regularPoints[0],
      c: 12.34,
      h: 12.35,
      l: 12.33,
      o: 12.34,
    };
    const tinyPoints = regularPoints.map((point) => ({
      ...point,
      c: 0.000_045_428_3,
      h: 0.000_045_5,
      l: 0.000_045_4,
      o: 0.000_045_45,
    }));
    const measureLabel = (label: string) => label.length * 6;
    const regularAxisWidth = getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth: measureLabel(
        getTradingViewNativeCurrentPriceLabel(regularPoints),
      ),
      widestPriceLabelWidth: measureLabel(
        getTradingViewNativePriceAxisLabel(regularPoints),
      ),
    });
    const tinyAxisWidth = getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth: measureLabel(
        getTradingViewNativeCurrentPriceLabel(tinyPoints),
      ),
      widestPriceLabelWidth: measureLabel(
        getTradingViewNativePriceAxisLabel(tinyPoints),
      ),
    });

    expect(regularAxisWidth).toBe(46);
    expect(tinyAxisWidth).toBe(76);
    expect(tinyAxisWidth).toBeGreaterThan(regularAxisWidth);
    expect(getTradingViewNativePriceAxisLabel(regularPoints)).toBe('88.88');

    const subOnePoints = regularPoints.map((point) => ({
      ...point,
      c: 0.1,
      h: 0.2,
      l: 0.1,
      o: 0.2,
    }));
    expect(getTradingViewNativePriceAxisLabel(subOnePoints)).toBe('0.8888');

    const compactPoints = regularPoints.map((point) => ({
      ...point,
      c: 0.000_002_547,
      h: 0.000_002_6,
      l: 1.4973e-11,
      o: 0.000_002_55,
    }));
    expect(getTradingViewNativeCurrentPriceLabel(compactPoints)).toBe(
      '0.0₅2547',
    );
    expect(getTradingViewNativePriceAxisLabel(compactPoints)).toBe('0.0₁₀8888');

    const signedPoints = regularPoints.map((point) => ({
      ...point,
      c: 500,
      h: 500,
      l: -499,
      o: 400,
    }));
    expect(getTradingViewNativePriceAxisLabel(signedPoints)).toBe('-888.88');
  });

  it('reserves symmetric padding when the current price is the widest label', () => {
    const label = formatTradingViewNativePriceTick(0.000_034_89);
    const labelWidth = label.length * 6;

    expect(label).toBe('0.00003489');
    expect(
      getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth: labelWidth,
        widestPriceLabelWidth: labelWidth,
      }),
    ).toBe(76);
    expect(getTradingViewNativeCurrentPriceLabel([])).toBe('');
  });

  it('reserves enough width for volume-axis labels', () => {
    expect(
      getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth: 30,
        widestPriceLabelWidth: 30,
        widestVolumeLabelWidth: 42,
      }),
    ).toBe(50);
  });

  it('reserves the requested minimum axis width for price-scale controls', () => {
    expect(
      getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth: 0,
        minimumWidth: 52,
        widestPriceLabelWidth: 0,
      }),
    ).toBe(52);
  });

  it('includes labels created by a manually expanded price range', () => {
    expect(
      getTradingViewNativeScaledPriceAxisLabel({
        autoPriceRange: { maxPrice: 200, minPrice: 100 },
        baseLabel: '888.88',
        priceRangeScale: 10,
        priceScaleMode: 'linear',
      }),
    ).toBe('-0.00008888');
  });

  it('covers the plain-decimal label regime only when the price range reaches it', () => {
    const crossingPoints = buildPoints({
      count: 1,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    crossingPoints[0] = {
      ...crossingPoints[0],
      c: 0.1,
      h: 0.1,
      l: 0.000_000_5,
      o: 0.000_056_78,
    };
    expect(getTradingViewNativePriceAxisLabel(crossingPoints)).toBe(
      '0.00008888',
    );

    const negativeCrossingPoints = crossingPoints.map((point) => ({
      ...point,
      c: -0.000_056_78,
      h: -0.000_000_5,
      l: -0.1,
      o: -0.1,
    }));
    expect(getTradingViewNativePriceAxisLabel(negativeCrossingPoints)).toBe(
      '-0.00008888',
    );

    const compactOnlyPoints = crossingPoints.map((point) => ({
      ...point,
      c: 0.000_009,
      h: 0.000_009,
      l: 0.000_000_5,
      o: 0.000_008,
    }));
    expect(getTradingViewNativePriceAxisLabel(compactOnlyPoints)).toBe(
      '0.0₅8888',
    );
  });

  it('reserves enough width for price ticks interpolated across the compaction threshold', () => {
    const points = buildPoints({
      count: 1,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    points[0] = {
      ...points[0],
      c: 0.0005,
      h: 0.0005,
      l: 0.000_002_547,
      o: 0.0005,
    };
    const widestPriceLabel = getTradingViewNativePriceAxisLabel(points);
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth:
          getTradingViewNativeCurrentPriceLabel(points).length * 6,
        widestPriceLabelWidth: widestPriceLabel.length * 6,
      }),
      visiblePointRange: { endIndex: 1, startIndex: 0 },
      width: 402,
    });
    const tickLabels =
      layout?.priceTicks.map(({ price }) =>
        formatTradingViewNativePriceTick(price),
      ) ?? [];

    expect(widestPriceLabel).toBe('0.00008888');
    expect(tickLabels).toContain('0.00008546');
    expect(
      tickLabels.every((label) => label.length <= widestPriceLabel.length),
    ).toBe(true);
  });

  it('formats crosshair time labels for intraday and daily candles', () => {
    const timestamp = getLocalTimestamp(2025, 0, 15, 13, 5);
    expect(
      formatTradingViewNativeCrosshairTime(timestamp, SECONDS_PER_HOUR),
    ).toBe('2025-01-15 13:05');
    expect(
      formatTradingViewNativeCrosshairTime(timestamp, SECONDS_PER_DAY),
    ).toBe('2025-01-15');
  });

  it('places extrema labels toward the center of the chart', () => {
    expect(
      getTradingViewNativePriceExtremumHorizontalLayout({
        anchorX: 0,
        canvasWidth: 320,
        textWidth: 40,
      }),
    ).toEqual({ lineEndX: 8, textX: 11 });
    expect(
      getTradingViewNativePriceExtremumHorizontalLayout({
        anchorX: 320,
        canvasWidth: 320,
        textWidth: 40,
      }),
    ).toEqual({ lineEndX: 312, textX: 269 });
  });

  it('keeps the highest-price marker below the OHLC legend', () => {
    const legendTop = Math.max(
      TRADING_VIEW_NATIVE_PRICE_LEGEND_TOP -
        TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
      0,
    );
    const legendBottom =
      legendTop +
      TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE +
      TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING * 2;
    const extremumTextTop =
      TRADING_VIEW_NATIVE_CHART_TOP_PADDING -
      TRADING_VIEW_NATIVE_PRICE_EXTREMA_FONT_SIZE / 2;

    expect(extremumTextTop).toBeGreaterThan(legendBottom);
  });

  it('maps crosshair height to a visible price', () => {
    const range = { maxPrice: 10, minPrice: 0, priceChartHeight: 100 };
    expect(getTradingViewNativePriceAtY({ ...range, y: 24 })).toBe(10);
    expect(getTradingViewNativePriceAtY({ ...range, y: 74 })).toBe(5);
    expect(getTradingViewNativePriceAtY({ ...range, y: 124 })).toBe(0);
    expect(getTradingViewNativePriceAtY({ ...range, y: 125 })).toBeNull();
  });

  it('maps crosshair height to the visible volume scale', () => {
    const range = {
      maxVolume: 10,
      volumeBottom: 200,
      volumeHeight: 100,
      volumeTop: 100,
    };
    expect(getTradingViewNativeVolumeAtY({ ...range, y: 100 })).toBe(10);
    expect(getTradingViewNativeVolumeAtY({ ...range, y: 150 })).toBe(5);
    expect(getTradingViewNativeVolumeAtY({ ...range, y: 200 })).toBe(0);
    expect(getTradingViewNativeVolumeAtY({ ...range, y: 99 })).toBeNull();
    expect(
      getTradingViewNativeVolumeAtY({ ...range, maxVolume: 0, y: 150 }),
    ).toBeNull();
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
    const priceAxisWidth = getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth:
        getTradingViewNativeCurrentPriceLabel(points).length * 6,
      widestPriceLabelWidth:
        getTradingViewNativePriceAxisLabel(points).length * 6,
    });
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: true,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width,
    });

    expect(layout).not.toBeNull();
    if (!layout) {
      return;
    }
    expect(getTradingViewNativeChartWidth(width, priceAxisWidth)).toBe(358);
    expect(layout).toMatchObject({
      maxPrice: 2,
      maxVolume: 10,
      priceAxisX: 358,
      timeAxisY: 276,
      volumeBottom: 276,
      volumeTop: 225.6,
    });
    expect(
      layout.volumeTop -
        (TRADING_VIEW_NATIVE_CHART_TOP_PADDING + layout.priceChartHeight),
    ).toBe(TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING);
    expect(layout.priceTicks).toHaveLength(7);
    expect(layout.volumeTicks).toHaveLength(2);
    expect(layout.volumeTicks[0]?.volume).toBeCloseTo(10 * (2 / 3));
    expect(layout.volumeTicks[0]?.y).toBeCloseTo(242.4);
    expect(layout.volumeTicks[1]?.volume).toBeCloseTo(10 * (1 / 3));
    expect(layout.volumeTicks[1]?.y).toBeCloseTo(259.2);
    expect(layout.timeTicks.length).toBeGreaterThan(0);
    expect(getTradingViewNativePriceY(layout.maxPrice, layout)).toBe(24);
  });

  it('scales the visible price range around its center', () => {
    const points = buildPoints({
      count: 2,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    points[0] = { ...points[0], h: 2, l: 0.5 };
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      priceRangeScale: 2,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout).toMatchObject({
      maxPrice: 2.75,
      minPrice: -0.25,
      priceRange: 3,
    });
  });

  it('keeps a pinned price range when the visible data changes', () => {
    const points = buildPoints({
      count: 2,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    }).map((point) => ({
      ...point,
      c: 200,
      h: 250,
      l: 150,
      o: 180,
    }));
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      pinnedPriceRange: { maxPrice: 20, minPrice: 10 },
      points,
      priceAxisWidth: 44,
      priceRangeScale: 2,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout).toMatchObject({
      autoPriceRange: { maxPrice: 250, minPrice: 150 },
      maxPrice: 25,
      minPrice: 5,
      priceRange: 20,
    });
  });

  it('maps logarithmic prices by equal percentage distance', () => {
    const points = buildPoints({
      count: 2,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    }).map((point) => ({
      ...point,
      c: 100,
      h: 1000,
      l: 10,
      o: 100,
    }));
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      priceScaleMode: 'logarithmic',
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout).not.toBeNull();
    if (!layout) {
      return;
    }
    const middleY =
      TRADING_VIEW_NATIVE_CHART_TOP_PADDING + layout.priceChartHeight / 2;
    expect(layout).toMatchObject({
      maxPrice: 1000,
      minPrice: 10,
      priceScaleMode: 'logarithmic',
    });
    expect(getTradingViewNativePriceY(100, layout)).toBeCloseTo(middleY);
    expect(
      getTradingViewNativePriceAtY({
        maxPrice: layout.maxPrice,
        minPrice: layout.minPrice,
        priceChartHeight: layout.priceChartHeight,
        priceScaleMode: layout.priceScaleMode,
        y: middleY,
      }),
    ).toBeCloseTo(100);
    expect(
      layout.priceTicks[Math.floor(layout.priceTicks.length / 2)]?.price,
    ).toBeCloseTo(100);
  });

  it('scales a logarithmic range around its geometric center', () => {
    const points = buildPoints({
      count: 2,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    }).map((point) => ({
      ...point,
      c: 100,
      h: 1000,
      l: 10,
      o: 100,
    }));
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      priceRangeScale: 2,
      priceScaleMode: 'logarithmic',
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout?.minPrice).toBeCloseTo(1);
    expect(layout?.maxPrice).toBeCloseTo(10_000);
  });

  it('falls back to linear scale for non-positive prices', () => {
    const points = buildPoints({
      count: 2,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    points[0] = { ...points[0], h: 10, l: 0 };
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      priceScaleMode: 'logarithmic',
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout?.priceScaleMode).toBe('linear');
  });

  it('reserves pane space above the single shared time axis', () => {
    const points = buildPoints({
      count: 5,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      contentBottomInset: 56,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout).toMatchObject({
      mainChartBottom: 220,
      timeAxisY: 276,
      volumeBottom: 220,
    });
  });

  it('reduces price ticks when the main pane is compressed', () => {
    const points = buildPoints({
      count: 5,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    }).map((point, index) => ({
      ...point,
      c: index + 1,
      h: index + 2,
      l: index,
      o: index + 0.5,
    }));
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      contentBottomInset: 180,
      hasVolume: false,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(layout?.priceChartHeight).toBe(64);
    expect(layout?.priceTicks).toHaveLength(5);
  });

  it('derives max volume from the currently visible candles', () => {
    const points = buildPoints({
      count: 4,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    points[0].v = 1000;
    points[1].v = 5;
    points[2].v = 10;
    points[3].v = 2;
    const visiblePointRange = { endIndex: 3, startIndex: 1 };
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: true,
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth: 24,
        widestPriceLabelWidth: 24,
      }),
      visiblePointRange,
      width: 402,
    });

    expect(
      getTradingViewNativeMaxVolume({ ...visiblePointRange, points }),
    ).toBe(10);
    expect(layout?.maxVolume).toBe(10);
  });

  it('keeps bottom padding below the price area when the token has no volume', () => {
    const points = buildPoints({
      count: 5,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeChartLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      hasVolume: hasTradingViewNativeVolume(points),
      height: 300,
      minimumTimeTickIndexSpacing: 1,
      points,
      priceAxisWidth: 44,
      visiblePointRange: { endIndex: points.length, startIndex: 0 },
      width: 402,
    });

    expect(hasTradingViewNativeVolume(points)).toBe(false);
    expect(layout).toMatchObject({
      priceChartHeight: 244,
      volumeBottom: 276,
      volumeHeight: 0,
      volumeTicks: [],
      volumeTop: 276,
    });
    expect(
      layout
        ? 276 -
            (TRADING_VIEW_NATIVE_CHART_TOP_PADDING + layout.priceChartHeight)
        : 0,
    ).toBe(TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING);
    expect(
      hasTradingViewNativeVolume([...points, { ...points[0], v: 0.000_001 }]),
    ).toBe(true);
  });

  it('returns no layout when bottom padding leaves no drawable price area', () => {
    const points = buildPoints({
      count: 1,
      startTimestamp: getLocalTimestamp(2025, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const height =
      TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT +
      TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
      TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING +
      TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING;

    expect(
      getTradingViewNativeChartLayout({
        candleIntervalSeconds: SECONDS_PER_HOUR,
        hasVolume: false,
        height,
        minimumTimeTickIndexSpacing: 1,
        points,
        priceAxisWidth: 44,
        visiblePointRange: { endIndex: points.length, startIndex: 0 },
        width: 402,
      }),
    ).toBeNull();
  });

  it('calculates volume bar height only for positive finite values', () => {
    expect(
      getTradingViewNativeVolumeBarHeight({
        maxVolume: 10,
        volume: 5,
        volumeHeight: 100,
      }),
    ).toBe(50);
    expect(
      getTradingViewNativeVolumeBarHeight({
        maxVolume: 10,
        volume: 0,
        volumeHeight: 100,
      }),
    ).toBe(0);
    expect(
      getTradingViewNativeVolumeBarHeight({
        maxVolume: 10,
        volume: Number.POSITIVE_INFINITY,
        volumeHeight: 100,
      }),
    ).toBe(0);
  });

  it('centers the watermark on small screens and uses bottom-left on large screens', () => {
    const regularLayout = getTradingViewNativeWatermarkLayout({
      canvasWidth: 640,
      mainChartBottom: 300,
    });
    expect(regularLayout).toMatchObject({ width: 96, x: 272 });
    expect(regularLayout?.height).toBeCloseTo(29.2683);
    expect(regularLayout?.y).toBeCloseTo(135.3659);

    const smallLayout = getTradingViewNativeWatermarkLayout({
      canvasWidth: 100,
      mainChartBottom: 50,
    });
    expect(smallLayout).toMatchObject({ width: 15, x: 42.5 });
    expect(smallLayout?.height).toBeCloseTo(4.5732);
    expect(smallLayout?.y).toBeCloseTo(22.7134);

    const wideLayout = getTradingViewNativeWatermarkLayout({
      canvasWidth: 3840,
      mainChartBottom: 2160,
    });
    expect(wideLayout).toMatchObject({ width: 320, x: 8 });

    const mobileLayout = getTradingViewNativeWatermarkLayout({
      canvasWidth: 320,
      isMobileLayout: true,
      mainChartBottom: 284,
    });
    expect(mobileLayout).toMatchObject({ width: 70.4, x: 124.8 });
    expect(mobileLayout?.height).toBeCloseTo(21.4634);
    expect(mobileLayout?.y).toBeCloseTo(131.2683);

    const mobileLandscapeLayout = getTradingViewNativeWatermarkLayout({
      canvasWidth: 1000,
      isMobileLayout: true,
      mainChartBottom: 500,
    });
    expect(mobileLandscapeLayout).toMatchObject({ width: 220, x: 390 });
    expect(mobileLandscapeLayout?.y).toBeCloseTo(216.4634);

    expect(
      getTradingViewNativeWatermarkLayout({
        canvasWidth: 767,
        mainChartBottom: 300,
      })?.x,
    ).toBeCloseTo((767 - 767 * 0.15) / 2);
    expect(
      getTradingViewNativeWatermarkLayout({
        canvasWidth: 768,
        mainChartBottom: 300,
      })?.x,
    ).toBe(8);
    expect(
      getTradingViewNativeWatermarkLayout({
        canvasWidth: 100,
        mainChartBottom: 0,
      }),
    ).toBeNull();
  });

  it('positions the current price line and keeps its label inside the price axis', () => {
    expect(
      getTradingViewNativeCurrentPriceLayout({
        labelHeight: 20,
        maxPrice: 10,
        minPrice: 0,
        price: 7,
        priceChartHeight: 100,
      }),
    ).toEqual({ labelTop: 44, lineY: 54 });
    expect(
      getTradingViewNativeCurrentPriceLayout({
        labelHeight: 20,
        maxPrice: 10,
        minPrice: 0,
        price: 10,
        priceChartHeight: 100,
      }),
    ).toEqual({ labelTop: 24, lineY: 24 });
    expect(
      getTradingViewNativeCurrentPriceLayout({
        labelHeight: 20,
        maxPrice: 10,
        minPrice: 0,
        price: 0,
        priceChartHeight: 100,
      }),
    ).toEqual({ labelTop: 104, lineY: 124 });
  });

  it('hides the current price line when its value is outside the visible range', () => {
    expect(
      getTradingViewNativeCurrentPriceLayout({
        labelHeight: 20,
        maxPrice: 10,
        minPrice: 5,
        price: 11,
        priceChartHeight: 100,
      }),
    ).toBeNull();
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

  it('keeps minute tick labels aligned with candle timestamps', () => {
    const points = buildPoints({
      count: 6,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 0, 2),
      stepSeconds: 15 * SECONDS_PER_MINUTE,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: 15 * SECONDS_PER_MINUTE,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing: 1,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('minute');
    expect(layout.ticks.map(({ label }) => label)).toEqual([
      '00:02',
      '00:17',
      '00:32',
      '00:47',
      '01:02',
      '01:17',
    ]);
  });

  it('keeps hour tick labels aligned with candle timestamps', () => {
    const points = buildPoints({
      count: 120,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 0, 15),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 360,
      endIndex: 100,
      minimumIndexSpacing: getTradingViewNativeTimeTickMinimumIndexSpacing(9),
      points,
      startIndex: 60,
    });

    expect(layout.unit).toBe('hour');
    const timeTicks = layout.ticks.filter(({ label }) =>
      /^\d{2}:\d{2}$/.test(label),
    );
    expect(timeTicks.length).toBeGreaterThan(0);
    expect(timeTicks.every(({ label }) => label.endsWith(':15'))).toBe(true);
    expect(
      timeTicks.every(
        ({ label, timestamp }) =>
          formatTradingViewNativeCrosshairTime(
            timestamp,
            SECONDS_PER_HOUR,
          ).slice(-5) === label,
      ),
    ).toBe(true);
  });

  it('preserves fractional-hour phases in hour tick labels', () => {
    const points = buildPoints({
      count: 120,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 0, 30),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 360,
      endIndex: 100,
      minimumIndexSpacing: getTradingViewNativeTimeTickMinimumIndexSpacing(9),
      points,
      startIndex: 60,
    });
    const timeTicks = layout.ticks.filter(({ label }) =>
      /^\d{2}:\d{2}$/.test(label),
    );

    expect(layout.unit).toBe('hour');
    expect(timeTicks.length).toBeGreaterThan(0);
    expect(timeTicks.every(({ label }) => label.endsWith(':30'))).toBe(true);
    expect(
      timeTicks.every(
        ({ label, timestamp }) =>
          formatTradingViewNativeCrosshairTime(
            timestamp,
            SECONDS_PER_HOUR,
          ).slice(-5) === label,
      ),
    ).toBe(true);
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

  it('limits time-axis point reads to the visible window', () => {
    const sourcePoints = buildPoints({
      count: 10_000,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 8),
      stepSeconds: SECONDS_PER_HOUR,
    });
    let pointReadCount = 0;
    const points = sourcePoints.map((point) => ({
      ...point,
      get t() {
        pointReadCount += 1;
        return point.t;
      },
    }));

    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 271,
      endIndex: 5050,
      minimumIndexSpacing: 12,
      points,
      startIndex: 5000,
    });

    expect(layout.ticks.length).toBeGreaterThan(0);
    expect(pointReadCount).toBeLessThan(200);
    expect(
      layout.ticks.every(({ index }) => index > 4900 && index < 5150),
    ).toBe(true);
  });

  it('keeps visible tick anchors stable across an aligned window boundary', () => {
    const points = buildPoints({
      count: 240,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 8),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const commonOptions = {
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 271,
      minimumIndexSpacing: 12,
      points,
    };
    const initialLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 153,
      startIndex: 107,
    });
    const pannedLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 154,
      startIndex: 108,
    });
    const getSharedVisibleTicks = (
      layout: ReturnType<typeof getTradingViewNativeTimeAxisLayout>,
    ) => layout.ticks.filter(({ index }) => index >= 108 && index < 153);

    expect(pannedLayout.unit).toBe(initialLayout.unit);
    expect(getSharedVisibleTicks(pannedLayout)).toEqual(
      getSharedVisibleTicks(initialLayout),
    );
  });

  it('keeps hourly tick anchors fixed while panning across a tick window boundary', () => {
    const points = buildPoints({
      count: 120,
      startTimestamp: getLocalTimestamp(2025, 0, 15, 0),
      stepSeconds: SECONDS_PER_HOUR,
    });
    const commonOptions = {
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 360,
      minimumIndexSpacing: getTradingViewNativeTimeTickMinimumIndexSpacing(9),
      points,
    };
    const initialLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 71,
      startIndex: 31,
    });
    const pannedLayout = getTradingViewNativeTimeAxisLayout({
      ...commonOptions,
      endIndex: 72,
      startIndex: 32,
    });
    const getSharedVisibleTicks = (
      layout: ReturnType<typeof getTradingViewNativeTimeAxisLayout>,
    ) => layout.ticks.filter(({ index }) => index >= 32 && index < 71);

    expect(initialLayout.unit).toBe('hour');
    expect(pannedLayout.unit).toBe('hour');
    expect(getSharedVisibleTicks(pannedLayout)).toEqual(
      getSharedVisibleTicks(initialLayout),
    );
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

  it('keeps consecutive month labels across a short February', () => {
    const pointSpacing = 2.5;
    const points = buildPoints({
      count: 144,
      startTimestamp: getLocalTimestamp(2026, 0, 1),
      stepSeconds: SECONDS_PER_DAY,
    });
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_DAY,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing:
        getTradingViewNativeTimeTickMinimumIndexSpacing(pointSpacing),
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('month');
    expect(layout.ticks.map(({ label }) => label)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ]);
  });

  it('uses a drawable month cadence when February is shorter than the spacing', () => {
    const pointSpacing = 2.16;
    const points = buildPoints({
      count: 144,
      startTimestamp: getLocalTimestamp(2026, 0, 1),
      stepSeconds: SECONDS_PER_DAY,
    });
    const minimumIndexSpacing =
      getTradingViewNativeTimeTickMinimumIndexSpacing(pointSpacing);
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_DAY,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('month');
    expect(layout.ticks.map(({ label }) => label)).toEqual([
      '2026-01',
      '2026-03',
      '2026-05',
    ]);
    expect(
      layout.ticks.every(
        (tick, index) =>
          index === 0 ||
          tick.index - layout.ticks[index - 1].index >= minimumIndexSpacing,
      ),
    ).toBe(true);
  });

  it('uses a drawable day cadence across a DST-shortened day', () => {
    const pointSpacing = 5.58;
    const points = buildPoints({
      count: 72,
      startTimestamp: getLocalTimestamp(2026, 2, 7, 0),
      stepSeconds: SECONDS_PER_HOUR,
    });
    for (let index = 26; index < points.length; index += 1) {
      points[index].t += SECONDS_PER_HOUR;
    }
    const minimumIndexSpacing =
      getTradingViewNativeTimeTickMinimumIndexSpacing(pointSpacing);
    const layout = getTradingViewNativeTimeAxisLayout({
      candleIntervalSeconds: SECONDS_PER_HOUR,
      chartWidth: 360,
      endIndex: points.length,
      minimumIndexSpacing,
      points,
      startIndex: 0,
    });

    expect(layout.unit).toBe('day');
    expect(layout.ticks.map(({ index, label }) => ({ index, label }))).toEqual([
      { index: 0, label: '03/07' },
      { index: 24, label: '03/08' },
      { index: 47, label: '03/09' },
      { index: 71, label: '03/10' },
    ]);
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

    expect(minimumIndexSpacing).toBe(8);
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
