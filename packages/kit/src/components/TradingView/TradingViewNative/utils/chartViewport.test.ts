import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import {
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePriceRange,
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

    expect(maxOffset).toBe(60);
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
        offset: 30,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(30);
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
      candleGap: 1,
      chartWidth: 100,
      pointCount: 20,
      zoomScale: 1,
    });

    expect(maxOffset).toBe(20);
    expect(
      clampTradingViewNativePanOffset({
        candleGap: 1,
        chartWidth: 100,
        offset: 30,
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

    expect(visiblePointRange).toEqual({ endIndex: 5, startIndex: 2 });
    expect(
      getTradingViewNativePriceRange({
        ...visiblePointRange,
        points,
      }),
    ).toEqual({ maxPrice: 500, minPrice: 30 });
  });

  it('includes candle bodies that intersect either viewport edge', () => {
    expect(
      getTradingViewNativeVisiblePointRange({
        chartWidth: 21,
        offset: 6.25,
        pointCount: 5,
        zoomScale: 1,
      }),
    ).toEqual({ endIndex: 5, startIndex: 1 });
  });

  it('updates the visible candle range after panning', () => {
    expect(
      getTradingViewNativeVisiblePointRange({
        chartWidth: 21,
        offset: 19,
        pointCount: 5,
        zoomScale: 1,
      }),
    ).toEqual({ endIndex: 3, startIndex: 0 });
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
});
