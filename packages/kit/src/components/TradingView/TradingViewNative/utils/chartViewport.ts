import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

export interface ITradingViewNativeVisiblePointRange {
  endIndex: number;
  startIndex: number;
}

export interface ITradingViewNativePriceRange {
  maxPrice: number;
  minPrice: number;
}

export function clampTradingViewNativeZoomScale(scale: number) {
  'worklet';

  return Math.min(
    Math.max(scale, TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE),
    TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  );
}

export function getTradingViewNativeMaxPanOffset({
  candleGap = TRADING_VIEW_NATIVE_CANDLE_GAP,
  chartWidth,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  if (chartWidth <= 0 || pointCount <= 0) {
    return 0;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + candleGap;
  const dataWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + (pointCount - 1) * candleStep) *
    clampedZoomScale;
  const visibleWidth = Math.max(chartWidth - candleGap * clampedZoomScale, 0);

  return Math.max(dataWidth - visibleWidth, 0);
}

export function clampTradingViewNativePanOffset({
  candleGap = TRADING_VIEW_NATIVE_CANDLE_GAP,
  chartWidth,
  offset,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  offset: number;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  return Math.min(
    Math.max(offset, 0),
    getTradingViewNativeMaxPanOffset({
      candleGap,
      chartWidth,
      pointCount,
      zoomScale,
    }),
  );
}

export function getTradingViewNativeVisiblePointRange({
  candleGap = TRADING_VIEW_NATIVE_CANDLE_GAP,
  chartWidth,
  offset,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  offset: number;
  pointCount: number;
  zoomScale: number;
}): ITradingViewNativeVisiblePointRange {
  'worklet';

  if (chartWidth <= 0 || pointCount <= 0) {
    return { endIndex: 0, startIndex: 0 };
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const clampedOffset = clampTradingViewNativePanOffset({
    candleGap,
    chartWidth,
    offset,
    pointCount,
    zoomScale: clampedZoomScale,
  });
  const candleStep =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + candleGap) * clampedZoomScale;
  const halfCandleBodyWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * clampedZoomScale) / 2;
  const lastCandleCenter =
    chartWidth -
    (candleGap + TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2) * clampedZoomScale +
    clampedOffset;
  const newestVisibleDistance = Math.max(
    Math.ceil(
      (lastCandleCenter - chartWidth - halfCandleBodyWidth) / candleStep,
    ),
    0,
  );
  const oldestVisibleDistance = Math.min(
    Math.floor((lastCandleCenter + halfCandleBodyWidth) / candleStep),
    pointCount - 1,
  );

  if (newestVisibleDistance > oldestVisibleDistance) {
    return { endIndex: 0, startIndex: 0 };
  }

  return {
    endIndex: pointCount - newestVisibleDistance,
    startIndex: pointCount - oldestVisibleDistance - 1,
  };
}

export function getTradingViewNativePriceRange({
  endIndex,
  points,
  startIndex,
}: ITradingViewNativeVisiblePointRange & {
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativePriceRange | null {
  const clampedStartIndex = Math.min(
    Math.max(Math.floor(startIndex), 0),
    points.length,
  );
  const clampedEndIndex = Math.min(
    Math.max(Math.floor(endIndex), clampedStartIndex),
    points.length,
  );
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (let index = clampedStartIndex; index < clampedEndIndex; index += 1) {
    const point = points[index];
    if (Number.isFinite(point.l) && Number.isFinite(point.h)) {
      minPrice = Math.min(minPrice, point.l);
      maxPrice = Math.max(maxPrice, point.h);
    }
  }

  return Number.isFinite(minPrice) && Number.isFinite(maxPrice)
    ? { maxPrice, minPrice }
    : null;
}

export function getTradingViewNativeZoomedViewport({
  anchorX,
  candleGap = TRADING_VIEW_NATIVE_CANDLE_GAP,
  chartWidth,
  currentOffset,
  currentZoomScale,
  nextZoomScale,
  pointCount,
}: {
  anchorX: number;
  candleGap?: number;
  chartWidth: number;
  currentOffset: number;
  currentZoomScale: number;
  nextZoomScale: number;
  pointCount: number;
}) {
  'worklet';

  const currentScale = clampTradingViewNativeZoomScale(currentZoomScale);
  const zoomScale = clampTradingViewNativeZoomScale(nextZoomScale);
  const clampedAnchorX = Math.min(Math.max(anchorX, 0), chartWidth);
  const offset = clampTradingViewNativePanOffset({
    candleGap,
    chartWidth,
    offset: currentOffset,
    pointCount,
    zoomScale: currentScale,
  });
  const currentContentRight = chartWidth - candleGap * currentScale;
  const nextContentRight = chartWidth - candleGap * zoomScale;
  const anchorDistance =
    (currentContentRight + offset - clampedAnchorX) / currentScale;
  const nextOffset =
    clampedAnchorX - nextContentRight + anchorDistance * zoomScale;

  return {
    offset: clampTradingViewNativePanOffset({
      candleGap,
      chartWidth,
      offset: nextOffset,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
