import {
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
} from '../chartConstants';

import {
  getTradingViewNativeCandleSlotAtTime,
  getTradingViewNativeCandleTimestampAtOffset,
} from './candleTime';
import {
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeCandleX,
} from './chartViewport';

import type { ITradingViewNativeChartRuntimeViewport } from './chartRuntime';
import type { ITradingViewNativeCandleTimeMode } from '../types';

/**
 * What a chart shows, in terms a chart with other candles can line up with:
 * the times at the edges of its plot and where they sit. A time moves through
 * its candle in step with the pixels, so the times follow a pan or zoom
 * smoothly instead of jumping by a candle whenever one crosses an edge.
 */
export interface ITradingViewNativeSyncedViewport {
  /**
   * The time at the right edge of the plot, or where the newest candle ends
   * when the plot reaches past it.
   */
  toTime: number;
  /** Space right of `toTime`, as a share of the plot width. */
  rightGap: number;
  /**
   * The time at the left edge of the plot, or where the oldest candle opens
   * when the plot reaches past it.
   */
  fromTime: number;
  /** Distance between the two times, as a share of the plot width. */
  span: number;
}

interface IViewportGeometry {
  candleIntervalSeconds: number;
  candleTimeMode?: ITradingViewNativeCandleTimeMode;
  /** Width of the plot, without the price axis. */
  chartWidth: number;
  points: readonly { t: number }[];
  viewport: ITradingViewNativeChartRuntimeViewport;
}

type ICandleTimeline = Pick<
  IViewportGeometry,
  'candleIntervalSeconds' | 'candleTimeMode' | 'points'
>;

// A position counts candles: a candle's centre sits at its index, and it
// spans half a candle to either side. Past both ends of the data, positions
// go on in candles of the interval.

/** When the candle at `index` closes. A gap after it does not stretch it. */
function getCandleCloseTime(
  { candleIntervalSeconds, candleTimeMode, points }: ICandleTimeline,
  index: number,
  openTime: number,
) {
  const nextOpenTime = getTradingViewNativeCandleTimestampAtOffset({
    timestamp: openTime,
    candleIntervalSeconds,
    candleTimeMode,
    offset: 1,
  });
  const next = index >= 0 ? points[index + 1] : undefined;
  return next ? Math.min(nextOpenTime, next.t) : nextOpenTime;
}

function getTimeAtCandlePosition(timeline: ICandleTimeline, position: number) {
  const { candleIntervalSeconds, candleTimeMode, points } = timeline;
  const index = Math.floor(position + 0.5);
  const anchorIndex = Math.min(Math.max(index, 0), points.length - 1);
  const openTime = getTradingViewNativeCandleTimestampAtOffset({
    timestamp: points[anchorIndex].t,
    candleIntervalSeconds,
    candleTimeMode,
    offset: index - anchorIndex,
  });
  const closeTime = getCandleCloseTime(timeline, index, openTime);
  return openTime + (position + 0.5 - index) * (closeTime - openTime);
}

/**
 * Where `time` lies among the candles. A time inside a gap in the data lies
 * where the candle before the gap ends.
 */
function getCandlePositionAtTime(timeline: ICandleTimeline, time: number) {
  const slot = getTradingViewNativeCandleSlotAtTime({ ...timeline, time });
  if (!slot) return null;
  const closeTime = getCandleCloseTime(timeline, slot.index, slot.timestamp);
  const share =
    closeTime > slot.timestamp
      ? Math.min(
          Math.max((time - slot.timestamp) / (closeTime - slot.timestamp), 0),
          1,
        )
      : 0;
  return slot.index - 0.5 + share;
}

export function getTradingViewNativeSyncedViewport({
  candleIntervalSeconds,
  candleTimeMode,
  chartWidth,
  points,
  viewport,
}: IViewportGeometry): ITradingViewNativeSyncedViewport | null {
  const pointCount = points.length;
  if (!pointCount || !(chartWidth > 0)) return null;
  const timeline = { candleIntervalSeconds, candleTimeMode, points };
  const zoomScale = clampTradingViewNativeZoomScale(viewport.zoomScale);
  const candleStep = TRADING_VIEW_NATIVE_CANDLE_STEP * zoomScale;
  const plotLeft = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING;
  const plotRight = plotLeft + chartWidth;
  const oldestX = getTradingViewNativeCandleX({
    index: 0,
    initialRightOffset: viewport.initialRightOffset,
    offset: viewport.offset,
    pointCount,
    priceAxisX: plotRight,
    zoomScale,
  });
  // The edges of the plot, kept to the candles: no time is given for the
  // room past either end of the data.
  const toPosition = Math.min(
    (plotRight - oldestX) / candleStep,
    pointCount - 0.5,
  );
  const fromPosition = Math.min(
    Math.max((plotLeft - oldestX) / candleStep, -0.5),
    toPosition,
  );
  return {
    toTime: getTimeAtCandlePosition(timeline, toPosition),
    rightGap: (plotRight - (oldestX + toPosition * candleStep)) / chartWidth,
    fromTime: getTimeAtCandlePosition(timeline, fromPosition),
    span: ((toPosition - fromPosition) * candleStep) / chartWidth,
  };
}

/**
 * The viewport that lines a chart up with `followed`: `toTime` gets the same
 * place at the right. With `fitRange` the zoom changes too, so `fromTime` gets
 * the same place at the left. Both move through this chart's candles in step
 * with the followed chart, whatever their intervals.
 */
export function getTradingViewNativeFollowedViewport({
  candleIntervalSeconds,
  candleTimeMode,
  chartWidth,
  fitRange,
  followed,
  points,
  viewport,
}: IViewportGeometry & {
  fitRange: boolean;
  followed: ITradingViewNativeSyncedViewport;
}): Pick<
  ITradingViewNativeChartRuntimeViewport,
  'offset' | 'zoomScale'
> | null {
  const pointCount = points.length;
  const timeline = { candleIntervalSeconds, candleTimeMode, points };
  const followedToPosition = getCandlePositionAtTime(timeline, followed.toTime);
  if (followedToPosition === null || !(chartWidth > 0)) return null;
  // A time still to come is "now" for this chart: the end of its newest
  // candle.
  const toPosition = Math.min(followedToPosition, pointCount - 0.5);
  let zoomScale = clampTradingViewNativeZoomScale(viewport.zoomScale);
  if (fitRange) {
    // Counted before the loaded candles too, so the zoom is right before the
    // history it calls for has arrived.
    const candleCount =
      toPosition -
      (getCandlePositionAtTime(timeline, followed.fromTime) ?? Infinity);
    if (candleCount > 0 && followed.span > 0) {
      zoomScale = clampTradingViewNativeZoomScale(
        (followed.span * chartWidth) /
          (candleCount * TRADING_VIEW_NATIVE_CANDLE_STEP),
      );
    }
  }
  const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
  // A time before the loaded candles goes to where the oldest one opens: the
  // chart loads further history from there.
  const anchorPosition = Math.max(toPosition, -0.5);
  const anchorX =
    getTradingViewNativeCandleX({
      index: 0,
      initialRightOffset: viewport.initialRightOffset,
      offset: 0,
      pointCount,
      priceAxisX: plotRight,
      zoomScale,
    }) +
    anchorPosition * TRADING_VIEW_NATIVE_CANDLE_STEP * zoomScale;
  return {
    offset: clampTradingViewNativePanOffset({
      chartWidth,
      initialRightOffset: viewport.initialRightOffset,
      offset: plotRight - followed.rightGap * chartWidth - anchorX,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
