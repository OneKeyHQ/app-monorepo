import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import { getTradingViewNativePrimarySeriesModel } from './chartType';

import type {
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
} from '../types';

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

function getTradingViewNativeRightOffsetWidth({
  candleGap,
  chartWidth,
  initialRightOffset,
  zoomScale,
}: {
  candleGap: number;
  chartWidth: number;
  initialRightOffset: ITradingViewNativeInitialRightOffset | undefined;
  zoomScale: number;
}) {
  'worklet';

  if (initialRightOffset?.type === 'chartWidthPercentage') {
    const percentage = Number.isFinite(initialRightOffset.value)
      ? Math.min(Math.max(initialRightOffset.value, 0), 100)
      : 0;
    return (Math.max(chartWidth, 0) * percentage) / 100;
  }
  const pointCount =
    initialRightOffset?.type === 'pointCount' &&
    Number.isFinite(initialRightOffset.value)
      ? Math.max(Math.floor(initialRightOffset.value), 0)
      : 0;
  return (
    pointCount * (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + candleGap) * zoomScale
  );
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
  initialRightOffset,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
  const rightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
    zoomScale: clampedZoomScale,
  });
  const visibleWidth = Math.max(
    chartWidth - resolvedCandleGap * clampedZoomScale,
    0,
  );

  return Math.max(dataWidth + rightOffsetWidth - visibleWidth, 0);
}

export function clampTradingViewNativePanOffset({
  candleGap,
  chartWidth,
  initialRightOffset,
  offset,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
      initialRightOffset,
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
  initialRightOffset,
  lastIndex,
  pointCount,
}: ITradingViewNativeViewportPointRange & {
  candleGap?: number;
  chartWidth: number;
  currentZoomScale: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
  const rightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
    zoomScale,
  });
  const targetOffset =
    chartWidth / 2 -
    chartWidth +
    (resolvedCandleGap +
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2 +
      distanceFromNewest * candleStep) *
      zoomScale +
    rightOffsetWidth;

  return {
    offset: clampTradingViewNativePanOffset({
      candleGap: resolvedCandleGap,
      chartWidth,
      initialRightOffset,
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
  initialRightOffset,
  pointCount,
  zoomScale,
}: {
  appendedPointCount: number;
  candleGap?: number;
  chartWidth: number;
  currentOffset: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  const resolvedCandleGap = candleGap ?? TRADING_VIEW_NATIVE_CANDLE_GAP;
  const clampedOffset = clampTradingViewNativePanOffset({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
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
    initialRightOffset,
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
  initialRightOffset,
  offset,
  pointCount,
  zoomScale,
}: {
  candleGap?: number;
  chartWidth: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
    initialRightOffset,
    offset,
    pointCount,
    zoomScale: clampedZoomScale,
  });
  const candleStep =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + resolvedCandleGap) *
    clampedZoomScale;
  const halfCandleBodyWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * clampedZoomScale) / 2;
  const rightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
    zoomScale: clampedZoomScale,
  });
  const lastCandleCenter =
    chartWidth -
    (resolvedCandleGap + TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2) *
      clampedZoomScale +
    clampedOffset -
    rightOffsetWidth;
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
  initialRightOffset,
  offset,
  pointCount,
  priceAxisX,
  zoomScale,
}: {
  candleGap?: number;
  index: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
  const rightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth: Math.max(
      priceAxisX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
      0,
    ),
    initialRightOffset,
    zoomScale: clampedZoomScale,
  });

  return (
    priceAxisX -
    (resolvedCandleGap +
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2 +
      distanceFromNewest * candleStep) *
      clampedZoomScale +
    offset -
    rightOffsetWidth
  );
}

export function getTradingViewNativePointIndexAtX({
  candleGap,
  initialRightOffset,
  offset,
  pointCount,
  priceAxisX,
  x,
  zoomScale,
}: {
  candleGap?: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
  const rightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth: Math.max(
      priceAxisX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
      0,
    ),
    initialRightOffset,
    zoomScale: clampedZoomScale,
  });
  const lastCandleCenter =
    priceAxisX -
    (resolvedCandleGap + TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH / 2) *
      clampedZoomScale +
    offset -
    rightOffsetWidth;
  const distanceFromNewest = Math.round((lastCandleCenter - x) / candleStep);
  const index = pointCount - distanceFromNewest - 1;

  return index >= 0 && index < pointCount ? index : null;
}

export function getTradingViewNativePriceExtrema({
  endIndex,
  points,
  startIndex,
}: ITradingViewNativeVisiblePointRange & {
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
    if (Number.isFinite(point.l) && Number.isFinite(point.h)) {
      if (point.h > highPrice) {
        highIndex = index;
        highPrice = point.h;
      }
      if (point.l < lowPrice) {
        lowIndex = index;
        lowPrice = point.l;
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
  const { priceSource } = getTradingViewNativePrimarySeriesModel(chartType);

  for (let index = clampedStartIndex; index < clampedEndIndex; index += 1) {
    const point = points[index];
    const pointHigh = priceSource === 'close' ? point.c : point.h;
    const pointLow = priceSource === 'close' ? point.c : point.l;
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
  initialRightOffset,
  nextZoomScale,
  pointCount,
}: {
  anchorX: number;
  candleGap?: number;
  chartWidth: number;
  currentOffset: number;
  currentZoomScale: number;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
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
    initialRightOffset,
    offset: currentOffset,
    pointCount,
    zoomScale: currentScale,
  });
  const currentRightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
    zoomScale: currentScale,
  });
  const nextRightOffsetWidth = getTradingViewNativeRightOffsetWidth({
    candleGap: resolvedCandleGap,
    chartWidth,
    initialRightOffset,
    zoomScale,
  });
  const currentContentRight =
    chartWidth - resolvedCandleGap * currentScale - currentRightOffsetWidth;
  const nextContentRight =
    chartWidth - resolvedCandleGap * zoomScale - nextRightOffsetWidth;
  const anchorDistance =
    (currentContentRight + offset - clampedAnchorX) / currentScale;
  const nextOffset =
    clampedAnchorX - nextContentRight + anchorDistance * zoomScale;

  return {
    offset: clampTradingViewNativePanOffset({
      candleGap: resolvedCandleGap,
      chartWidth,
      initialRightOffset,
      offset: nextOffset,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
