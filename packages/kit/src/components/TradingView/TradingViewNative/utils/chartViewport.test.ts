import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import {
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeAppendedPointCount,
  getTradingViewNativeCandleX,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeGestureStartOffsetAfterDataUpdate,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePanOffsetAfterDataUpdate,
  getTradingViewNativePanStartOffsetAfterViewportPreservation,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativePriceExtrema,
  getTradingViewNativePriceRange,
  getTradingViewNativeRelativePinchScale,
  getTradingViewNativeViewportForPointRange,
  getTradingViewNativeViewportPointRange,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from './chartViewport';

function buildPoint(
  low: number,
  high: number,
  timestamp: number,
): IMarketTokenKLineDataPoint {
  return {
    c: low,
    h: high,
    l: low,
    o: low,
    t: timestamp,
    v: 0,
  };
}

describe('TradingViewNative chart viewport', () => {
  it('clamps horizontal panning to the available candle data', () => {
    const chartWidth = 100;
    const pointCount = 20;
    const maxOffset = getTradingViewNativeMaxPanOffset({
      chartWidth,
      pointCount,
      zoomScale: 1,
    });

    expect(maxOffset).toBe(20);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: -20,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(0);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: 10,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(10);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: 100,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(maxOffset);
  });

  it('supports a platform-specific candle gap', () => {
    const maxOffset = getTradingViewNativeMaxPanOffset({
      candleGap: 3,
      chartWidth: 100,
      pointCount: 20,
      zoomScale: 1,
    });

    expect(maxOffset).toBe(60);
    expect(
      clampTradingViewNativePanOffset({
        candleGap: 3,
        chartWidth: 100,
        offset: 100,
        pointCount: 20,
        zoomScale: 1,
      }),
    ).toBe(maxOffset);
  });

  it('keeps zoom within the supported range', () => {
    expect(clampTradingViewNativeZoomScale(0.1)).toBe(
      TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
    );
    expect(clampTradingViewNativeZoomScale(10)).toBe(
      TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
    );
  });

  it('detects candles appended after the previous latest candle', () => {
    expect(
      getTradingViewNativeAppendedPointCount({
        points: [buildPoint(1, 2, 1), buildPoint(1, 2, 2)],
        previousLatestTimestamp: 2,
      }),
    ).toBe(0);
    expect(
      getTradingViewNativeAppendedPointCount({
        points: [buildPoint(1, 2, 1), buildPoint(1, 2, 2), buildPoint(1, 2, 3)],
        previousLatestTimestamp: 2,
      }),
    ).toBe(1);
    expect(
      getTradingViewNativeAppendedPointCount({
        points: [buildPoint(1, 2, 2), buildPoint(1, 2, 3), buildPoint(1, 2, 4)],
        previousLatestTimestamp: 3,
      }),
    ).toBe(1);
  });

  it('reports appended candles and the latest timestamp', () => {
    const points = [
      buildPoint(1, 2, 1),
      buildPoint(1, 2, 2),
      buildPoint(1, 2, 3),
    ];
    const metadata = getTradingViewNativeDataUpdateMetadata({
      points,
      previousLatestTimestamp: 2,
    });

    expect(metadata).toEqual({ appendedPointCount: 1, latestTimestamp: 3 });
  });

  it('does not infer appended candles from unrelated history', () => {
    expect(
      getTradingViewNativeAppendedPointCount({
        points: [buildPoint(1, 2, 10), buildPoint(1, 2, 11)],
        previousLatestTimestamp: 2,
      }),
    ).toBe(0);
    expect(
      getTradingViewNativeAppendedPointCount({
        points: [buildPoint(1, 2, 10)],
        previousLatestTimestamp: undefined,
      }),
    ).toBe(0);
  });

  it('keeps a historical candle stationary when a new candle is appended', () => {
    expect(
      getTradingViewNativePanOffsetAfterDataUpdate({
        appendedPointCount: 1,
        chartWidth: 100,
        currentOffset: 10,
        pointCount: 21,
        zoomScale: 1,
      }),
    ).toBe(16);
    expect(
      getTradingViewNativePanOffsetAfterDataUpdate({
        appendedPointCount: 1,
        chartWidth: 100,
        currentOffset: 0,
        pointCount: 21,
        zoomScale: 1,
      }),
    ).toBe(0);
  });

  it('keeps a zero-offset viewport attached to the newest appended candle', () => {
    const nextOffset = getTradingViewNativePanOffsetAfterDataUpdate({
      appendedPointCount: 100,
      chartWidth: 21,
      currentOffset: 0,
      pointCount: 102,
      zoomScale: 1,
    });

    expect(nextOffset).toBe(0);
    expect(
      getTradingViewNativeVisiblePointRange({
        chartWidth: 21,
        offset: nextOffset,
        pointCount: 102,
        zoomScale: 1,
      }).endIndex,
    ).toBe(102);
  });

  it('keeps existing candles stationary when older history is prepended', () => {
    const currentX = getTradingViewNativeCandleX({
      index: 2,
      offset: 40,
      pointCount: 5,
      priceAxisX: 100,
      zoomScale: 1,
    });
    const nextX = getTradingViewNativeCandleX({
      index: 4,
      offset: 40,
      pointCount: 7,
      priceAxisX: 100,
      zoomScale: 1,
    });

    expect(nextX).toBe(currentX);
  });

  it('keeps active pan and pinch gesture baselines aligned after appending', () => {
    expect(
      getTradingViewNativeGestureStartOffsetAfterDataUpdate({
        currentZoomScale: 1,
        offsetDelta: 8,
        startOffset: 20,
        startZoomScale: 1,
      }),
    ).toBe(28);
    expect(
      getTradingViewNativeGestureStartOffsetAfterDataUpdate({
        currentZoomScale: 2,
        offsetDelta: 16,
        startOffset: 20,
        startZoomScale: 1,
      }),
    ).toBe(28);
  });

  it('rebases an active pan when a preserved viewport is applied', () => {
    expect(
      getTradingViewNativePanStartOffsetAfterViewportPreservation({
        currentTranslationX: -40,
        dragRatio: 1.1,
        preservedOffset: 300,
      }),
    ).toBe(344);
  });

  it('rebases cumulative pinch scale after an async viewport update', () => {
    expect(
      getTradingViewNativeRelativePinchScale({
        baselineScale: 1.5,
        gestureScale: 1.65,
      }),
    ).toBeCloseTo(1.1);
  });

  it('derives the price range from visible candles only', () => {
    const points = [
      buildPoint(1, 1000, 1),
      buildPoint(20, 25, 2),
      buildPoint(30, 500, 3),
      buildPoint(40, 45, 4),
      buildPoint(50, 55, 5),
    ];
    const visiblePointRange = getTradingViewNativeVisiblePointRange({
      chartWidth: 21,
      offset: 0,
      pointCount: points.length,
      zoomScale: 1,
    });

    expect(visiblePointRange).toEqual({ endIndex: 5, startIndex: 1 });
    expect(
      getTradingViewNativePriceRange({
        ...visiblePointRange,
        points,
      }),
    ).toEqual({ maxPrice: 500, minPrice: 20 });
    expect(
      getTradingViewNativePriceExtrema({
        ...visiblePointRange,
        points,
      }),
    ).toEqual({
      high: { index: 2, price: 500 },
      low: { index: 1, price: 20 },
    });
  });

  it('derives line price ranges from close prices', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 10, h: 1000, l: 1, o: 9, t: 1, v: 0 },
      { c: 30, h: 500, l: 2, o: 10, t: 2, v: 0 },
      { c: 20, h: 800, l: 3, o: 30, t: 3, v: 0 },
    ];

    expect(
      getTradingViewNativePriceRange({
        chartType: 'line',
        endIndex: points.length,
        points,
        startIndex: 0,
      }),
    ).toEqual({ maxPrice: 30, minPrice: 10 });
  });

  it('includes candle bodies that intersect either viewport edge', () => {
    expect(
      getTradingViewNativeVisiblePointRange({
        chartWidth: 21,
        offset: 3,
        pointCount: 5,
        zoomScale: 1,
      }),
    ).toEqual({ endIndex: 5, startIndex: 1 });
  });

  it('updates the visible candle range after panning', () => {
    expect(
      getTradingViewNativeVisiblePointRange({
        chartWidth: 21,
        offset: 9,
        pointCount: 5,
        zoomScale: 1,
      }),
    ).toEqual({ endIndex: 4, startIndex: 0 });
  });

  it('uses mobile candle spacing and zoom for the visible range', () => {
    expect(
      getTradingViewNativeVisiblePointRange({
        candleGap: 1,
        chartWidth: 21,
        offset: 0,
        pointCount: 5,
        zoomScale: 1,
      }),
    ).toEqual({ endIndex: 5, startIndex: 1 });
    expect(
      getTradingViewNativeVisiblePointRange({
        candleGap: 1,
        chartWidth: 21,
        offset: 0,
        pointCount: 5,
        zoomScale: 2,
      }),
    ).toEqual({ endIndex: 5, startIndex: 3 });
  });

  it('positions time ticks on the same horizontal scale as candles', () => {
    expect(
      getTradingViewNativeCandleX({
        index: 4,
        offset: 10,
        pointCount: 5,
        priceAxisX: 100,
        zoomScale: 2,
      }),
    ).toBe(103);
    expect(
      getTradingViewNativeCandleX({
        index: 3,
        offset: 10,
        pointCount: 5,
        priceAxisX: 100,
        zoomScale: 2,
      }),
    ).toBe(91);
  });

  it('finds the candle nearest to the crosshair position', () => {
    expect(
      getTradingViewNativePointIndexAtX({
        offset: 0,
        pointCount: 5,
        priceAxisX: 100,
        x: 94.5,
        zoomScale: 1,
      }),
    ).toBe(4);
    expect(
      getTradingViewNativePointIndexAtX({
        offset: 6,
        pointCount: 5,
        priceAxisX: 100,
        x: 96.5,
        zoomScale: 1,
      }),
    ).toBe(3);
    expect(
      getTradingViewNativePointIndexAtX({
        offset: 0,
        pointCount: 5,
        priceAxisX: 100,
        x: 0,
        zoomScale: 1,
      }),
    ).toBeNull();
    expect(
      getTradingViewNativePointIndexAtX({
        offset: 0,
        pointCount: 5,
        priceAxisX: 100,
        x: 101,
        zoomScale: 1,
      }),
    ).toBeNull();
  });

  it('keeps the candle under the zoom anchor in place', () => {
    const chartWidth = 100;
    const anchorX = 50;
    const currentContentRight = chartWidth - TRADING_VIEW_NATIVE_CANDLE_GAP;
    const anchorDistance = currentContentRight - anchorX;
    const viewport = getTradingViewNativeZoomedViewport({
      anchorX,
      chartWidth,
      currentOffset: 0,
      currentZoomScale: 1,
      nextZoomScale: 2,
      pointCount: 20,
    });
    const nextContentRight =
      chartWidth -
      TRADING_VIEW_NATIVE_CANDLE_GAP * viewport.zoomScale +
      viewport.offset;

    expect(nextContentRight - anchorDistance * viewport.zoomScale).toBe(
      anchorX,
    );
  });

  it('resolves timestamp and time-range targets to candle indices', () => {
    const points = [
      buildPoint(1, 2, 100),
      buildPoint(1, 2, 200),
      buildPoint(1, 2, 300),
      buildPoint(1, 2, 400),
    ];

    expect(
      getTradingViewNativeViewportPointRange({
        points,
        target: { kind: 'timestamp', timestamp: 260 },
      }),
    ).toEqual({
      firstIndex: 2,
      fitRange: false,
      lastIndex: 2,
    });
    expect(
      getTradingViewNativeViewportPointRange({
        points,
        target: { kind: 'timeRange', from: 150, to: 350 },
      }),
    ).toEqual({
      firstIndex: 1,
      fitRange: true,
      lastIndex: 2,
    });
  });

  it('centers a timestamp and fits a selected candle range', () => {
    const timestampViewport = getTradingViewNativeViewportForPointRange({
      chartWidth: 120,
      currentZoomScale: 1.5,
      firstIndex: 20,
      fitRange: false,
      lastIndex: 20,
      pointCount: 100,
    });
    expect(timestampViewport).not.toBeNull();
    if (!timestampViewport) {
      throw new OneKeyLocalError('Expected a timestamp viewport');
    }
    expect(timestampViewport.zoomScale).toBe(1.5);
    const timestampVisibleRange = getTradingViewNativeVisiblePointRange({
      chartWidth: 120,
      offset: timestampViewport.offset,
      pointCount: 100,
      zoomScale: timestampViewport.zoomScale,
    });
    expect(timestampVisibleRange.startIndex).toBeLessThanOrEqual(20);
    expect(timestampVisibleRange.endIndex).toBeGreaterThan(20);

    const timeRangeViewport = getTradingViewNativeViewportForPointRange({
      chartWidth: 120,
      currentZoomScale: 1,
      firstIndex: 40,
      fitRange: true,
      lastIndex: 59,
      pointCount: 100,
    });
    expect(timeRangeViewport).not.toBeNull();
    if (!timeRangeViewport) {
      throw new OneKeyLocalError('Expected a time-range viewport');
    }
    const timeRangeVisibleRange = getTradingViewNativeVisiblePointRange({
      chartWidth: 120,
      offset: timeRangeViewport.offset,
      pointCount: 100,
      zoomScale: timeRangeViewport.zoomScale,
    });
    expect(timeRangeVisibleRange.startIndex).toBeLessThanOrEqual(40);
    expect(timeRangeVisibleRange.endIndex).toBeGreaterThan(59);
  });
});
