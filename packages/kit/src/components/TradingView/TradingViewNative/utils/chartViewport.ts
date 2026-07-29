import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import type { ITradingViewNativeChartType } from '../types';

export interface ITradingViewNativeVisiblePointRange {
  endIndex: number;
  startIndex: number;
}

export interface ITradingViewNativePriceRange {
  maxPrice: number;
  minPrice: number;
}

export interface ITradingViewNativePriceExtremum {
  index: number;
  price: number;
}

export interface ITradingViewNativePriceExtrema {
  high: ITradingViewNativePriceExtremum;
  low?: ITradingViewNativePriceExtremum;
}

export interface ITradingViewNativeDataUpdateMetadata {
  appendedPointCount: number;
  latestTimestamp: number | undefined;
}

export type ITradingViewNativeViewportTarget =
  | {
      kind: 'timestamp';
      timestamp: number;
    }
  | {
      kind: 'timeRange';
      from: number;
      to: number;
    };

export interface ITradingViewNativeViewportRequest {
  preserveVisibleAnchor?: boolean;
  requestId: number;
  target: ITradingViewNativeViewportTarget;
}

export interface ITradingViewNativeViewportPointRange {
  firstIndex: number;
  fitRange: boolean;
  lastIndex: number;
}

function findFirstPointIndexAtOrAfter(
  points: IMarketTokenKLineDataPoint[],
  timestamp: number,
) {
  let startIndex = 0;
  let endIndex = points.length;

  while (startIndex < endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);
    if (points[middleIndex].t < timestamp) {
      startIndex = middleIndex + 1;
    } else {
      endIndex = middleIndex;
    }
  }

  return startIndex;
}

function findFirstPointIndexAfter(
  points: IMarketTokenKLineDataPoint[],
  timestamp: number,
) {
  let startIndex = 0;
  let endIndex = points.length;

  while (startIndex < endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);
    if (points[middleIndex].t <= timestamp) {
      startIndex = middleIndex + 1;
    } else {
      endIndex = middleIndex;
    }
  }

  return startIndex;
}

function findClosestPointIndex(
  points: IMarketTokenKLineDataPoint[],
  timestamp: number,
) {
  const nextIndex = findFirstPointIndexAtOrAfter(points, timestamp);
  if (nextIndex <= 0) {
    return 0;
  }
  if (nextIndex >= points.length) {
    return points.length - 1;
  }

  const previousIndex = nextIndex - 1;
  return timestamp - points[previousIndex].t <= points[nextIndex].t - timestamp
    ? previousIndex
    : nextIndex;
}

export function getTradingViewNativeViewportPointRange({
  points,
  target,
}: {
  points: IMarketTokenKLineDataPoint[];
  target: ITradingViewNativeViewportTarget;
}): ITradingViewNativeViewportPointRange | null {
  if (!points.length) {
    return null;
  }

  if (target.kind === 'timestamp') {
    if (!Number.isFinite(target.timestamp)) {
      return null;
    }
    const pointIndex = findClosestPointIndex(points, target.timestamp);
    return {
      firstIndex: pointIndex,
      fitRange: false,
      lastIndex: pointIndex,
    };
  }

  if (!Number.isFinite(target.from) || !Number.isFinite(target.to)) {
    return null;
  }
  const from = Math.min(target.from, target.to);
  const to = Math.max(target.from, target.to);
  const firstIndex = findFirstPointIndexAtOrAfter(points, from);
  const endIndex = findFirstPointIndexAfter(points, to);
  if (firstIndex < endIndex) {
    return {
      firstIndex,
      fitRange: true,
      lastIndex: endIndex - 1,
    };
  }

  const closestIndex = findClosestPointIndex(points, (from + to) / 2);
  return {
    firstIndex: closestIndex,
    fitRange: true,
    lastIndex: closestIndex,
  };
}

export function clampTradingViewNativeZoomScale(scale: number) {
  'worklet';

  return Math.min(
    Math.max(scale, TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE),
    TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  );
}

export function getTradingViewNativeRelativePinchScale({
  baselineScale,
  gestureScale,
}: {
  baselineScale: number;
  gestureScale: number;
}) {
  'worklet';

  return gestureScale / Math.max(baselineScale, 0.0001);
}

export function getTradingViewNativeMaxPanOffset({
  candleGap,
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

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  if (chartWidth <= 0 || pointCount <= 0) {
    return 0;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap;
  const dataWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + (pointCount - 1) * candleStep) *
    clampedZoomScale;
  const visibleWidth = Math.max(
    chartWidth - resolvedCandleGap * clampedZoomScale,
    0,
  );

  return Math.max(dataWidth - visibleWidth, 0);
}

export function clampTradingViewNativePanOffset({
  candleGap,
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

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  return Math.min(
    Math.max(offset, 0),
    getTradingViewNativeMaxPanOffset({
      candleGap: resolvedCandleGap,
      chartWidth,
      pointCount,
      zoomScale,
    }),
  );
}

export function getTradingViewNativeViewportForPointRange({
  candleGap,
  chartWidth,
  currentZoomScale,
  firstIndex,
  fitRange,
  lastIndex,
  pointCount,
}: ITradingViewNativeViewportPointRange & {
  candleGap?: number;
  chartWidth: number;
  currentZoomScale: number;
  pointCount: number;
}) {
  'worklet';

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  if (chartWidth <= 0 || pointCount <= 0) {
    return null;
  }

  const clampedFirstIndex = Math.min(
    Math.max(Math.floor(firstIndex), 0),
    pointCount - 1,
  );
  const clampedLastIndex = Math.min(
    Math.max(Math.floor(lastIndex), clampedFirstIndex),
    pointCount - 1,
  );
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap;
  const targetIndex = (clampedFirstIndex + clampedLastIndex) / 2;
  let zoomScale = clampTradingViewNativeZoomScale(currentZoomScale);

  if (fitRange) {
    const targetDataWidth =
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH +
      (clampedLastIndex - clampedFirstIndex) * candleStep +
      candleStep * 2;
    zoomScale = clampTradingViewNativeZoomScale(chartWidth / targetDataWidth);
  }

  const distanceFromNewest = pointCount - targetIndex - 1;
  const targetOffset =
    chartWidth / 2 -
    chartWidth +
    (resolvedCandleGap +
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2 +
      distanceFromNewest * candleStep) *
      zoomScale;

  return {
    offset: clampTradingViewNativePanOffset({
      candleGap: resolvedCandleGap,
      chartWidth,
      offset: targetOffset,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}

export function getTradingViewNativeAppendedPointCount({
  points,
  previousLatestTimestamp,
}: {
  points: IMarketTokenKLineDataPoint[];
  previousLatestTimestamp: number | undefined;
}) {
  if (
    previousLatestTimestamp === undefined ||
    !Number.isFinite(previousLatestTimestamp)
  ) {
    return 0;
  }

  const previousLatestPointIndex = points.findIndex(
    (point) => point.t === previousLatestTimestamp,
  );
  if (previousLatestPointIndex === -1) {
    return 0;
  }

  return Math.max(points.length - previousLatestPointIndex - 1, 0);
}

export function getTradingViewNativeDataUpdateMetadata({
  points,
  previousLatestTimestamp,
}: {
  points: IMarketTokenKLineDataPoint[];
  previousLatestTimestamp: number | undefined;
}): ITradingViewNativeDataUpdateMetadata {
  return {
    appendedPointCount: getTradingViewNativeAppendedPointCount({
      points,
      previousLatestTimestamp,
    }),
    latestTimestamp: points[points.length - 1]?.t,
  };
}

export function getTradingViewNativePanOffsetAfterDataUpdate({
  appendedPointCount,
  candleGap,
  chartWidth,
  currentOffset,
  pointCount,
  zoomScale,
}: {
  appendedPointCount: number;
  candleGap?: number;
  chartWidth: number;
  currentOffset: number;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  const clampedOffset = clampTradingViewNativePanOffset({
    candleGap: resolvedCandleGap,
    chartWidth,
    offset: currentOffset,
    pointCount,
    zoomScale,
  });
  const safeAppendedPointCount = Number.isFinite(appendedPointCount)
    ? Math.max(Math.floor(appendedPointCount), 0)
    : 0;
  if (clampedOffset <= 0 || safeAppendedPointCount === 0) {
    return clampedOffset;
  }

  const candleStep =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap) *
    clampTradingViewNativeZoomScale(zoomScale);
  return clampTradingViewNativePanOffset({
    candleGap: resolvedCandleGap,
    chartWidth,
    offset: clampedOffset + safeAppendedPointCount * candleStep,
    pointCount,
    zoomScale,
  });
}

export function getTradingViewNativeGestureStartOffsetAfterDataUpdate({
  currentZoomScale,
  offsetDelta,
  startOffset,
  startZoomScale,
}: {
  currentZoomScale: number;
  offsetDelta: number;
  startOffset: number;
  startZoomScale: number;
}) {
  'worklet';

  return (
    startOffset +
    (offsetDelta * clampTradingViewNativeZoomScale(startZoomScale)) /
      clampTradingViewNativeZoomScale(currentZoomScale)
  );
}

export function getTradingViewNativePanStartOffsetAfterViewportPreservation({
  currentTranslationX,
  dragRatio,
  preservedOffset,
}: {
  currentTranslationX: number;
  dragRatio: number;
  preservedOffset: number;
}) {
  'worklet';

  return preservedOffset - currentTranslationX * dragRatio;
}

export function getTradingViewNativeVisiblePointRange({
  candleGap,
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

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  if (chartWidth <= 0 || pointCount <= 0) {
    return { endIndex: 0, startIndex: 0 };
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const clampedOffset = clampTradingViewNativePanOffset({
    candleGap: resolvedCandleGap,
    chartWidth,
    offset,
    pointCount,
    zoomScale: clampedZoomScale,
  });
  const candleStep =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap) *
    clampedZoomScale;
  const halfCandleBodyWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * clampedZoomScale) / 2;
  const lastCandleCenter =
    chartWidth -
    (resolvedCandleGap + TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2) *
      clampedZoomScale +
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

export function getTradingViewNativeCandleX({
  candleGap,
  index,
  offset,
  pointCount,
  priceAxisX,
  zoomScale,
}: {
  candleGap?: number;
  index: number;
  offset: number;
  pointCount: number;
  priceAxisX: number;
  zoomScale: number;
}) {
  'worklet';

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  if (pointCount <= 0) {
    return priceAxisX;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const clampedIndex = Math.min(Math.max(Math.floor(index), 0), pointCount - 1);
  const distanceFromNewest = pointCount - clampedIndex - 1;
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap;

  return (
    priceAxisX -
    (resolvedCandleGap +
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2 +
      distanceFromNewest * candleStep) *
      clampedZoomScale +
    offset
  );
}

export function getTradingViewNativePointIndexAtX({
  candleGap,
  offset,
  pointCount,
  priceAxisX,
  x,
  zoomScale,
}: {
  candleGap?: number;
  offset: number;
  pointCount: number;
  priceAxisX: number;
  x: number;
  zoomScale: number;
}) {
  'worklet';

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  if (
    pointCount <= 0 ||
    priceAxisX <= 0 ||
    !Number.isFinite(x) ||
    x < 0 ||
    x > priceAxisX
  ) {
    return null;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const candleStep =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap) *
    clampedZoomScale;
  const lastCandleCenter =
    priceAxisX -
    (resolvedCandleGap + TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2) *
      clampedZoomScale +
    offset;
  const distanceFromNewest = Math.round((lastCandleCenter - x) / candleStep);
  const index = pointCount - distanceFromNewest - 1;

  return index >= 0 && index < pointCount ? index : null;
}

export function getTradingViewNativePriceExtrema({
  chartType = 'candlestick',
  endIndex,
  points,
  startIndex,
}: ITradingViewNativeVisiblePointRange & {
  chartType?: ITradingViewNativeChartType;
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativePriceExtrema | null {
  'worklet';

  const clampedStartIndex = Math.min(
    Math.max(Math.floor(startIndex), 0),
    points.length,
  );
  const clampedEndIndex = Math.min(
    Math.max(Math.floor(endIndex), clampedStartIndex),
    points.length,
  );
  let highIndex = -1;
  let highPrice = Number.NEGATIVE_INFINITY;
  let lowIndex = -1;
  let lowPrice = Number.POSITIVE_INFINITY;

  for (let index = clampedStartIndex; index < clampedEndIndex; index += 1) {
    const point = points[index];
    const pointHigh = chartType === 'line' ? point.c : point.h;
    const pointLow = chartType === 'line' ? point.c : point.l;
    if (Number.isFinite(pointLow) && Number.isFinite(pointHigh)) {
      if (pointHigh > highPrice) {
        highIndex = index;
        highPrice = pointHigh;
      }
      if (pointLow < lowPrice) {
        lowIndex = index;
        lowPrice = pointLow;
      }
    }
  }

  if (highIndex < 0 || lowIndex < 0) {
    return null;
  }
  const high = { index: highIndex, price: highPrice };
  return highPrice === lowPrice
    ? { high }
    : {
        high,
        low: { index: lowIndex, price: lowPrice },
      };
}

export function getTradingViewNativePriceRange({
  chartType = 'candlestick',
  endIndex,
  points,
  startIndex,
}: ITradingViewNativeVisiblePointRange & {
  chartType?: ITradingViewNativeChartType;
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativePriceRange | null {
  'worklet';

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
    const pointHigh = chartType === 'line' ? point.c : point.h;
    const pointLow = chartType === 'line' ? point.c : point.l;
    if (Number.isFinite(pointLow) && Number.isFinite(pointHigh)) {
      minPrice = Math.min(minPrice, pointLow);
      maxPrice = Math.max(maxPrice, pointHigh);
    }
  }

  return Number.isFinite(minPrice) && Number.isFinite(maxPrice)
    ? { maxPrice, minPrice }
    : null;
}

export function getTradingViewNativeZoomedViewport({
  anchorX,
  candleGap,
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

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  const currentScale = clampTradingViewNativeZoomScale(currentZoomScale);
  const zoomScale = clampTradingViewNativeZoomScale(nextZoomScale);
  const clampedAnchorX = Math.min(Math.max(anchorX, 0), chartWidth);
  const offset = clampTradingViewNativePanOffset({
    candleGap: resolvedCandleGap,
    chartWidth,
    offset: currentOffset,
    pointCount,
    zoomScale: currentScale,
  });
  const currentContentRight = chartWidth - resolvedCandleGap * currentScale;
  const nextContentRight = chartWidth - resolvedCandleGap * zoomScale;
  const anchorDistance =
    (currentContentRight + offset - clampedAnchorX) / currentScale;
  const nextOffset =
    clampedAnchorX - nextContentRight + anchorDistance * zoomScale;

  return {
    offset: clampTradingViewNativePanOffset({
      candleGap: resolvedCandleGap,
      chartWidth,
      offset: nextOffset,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
