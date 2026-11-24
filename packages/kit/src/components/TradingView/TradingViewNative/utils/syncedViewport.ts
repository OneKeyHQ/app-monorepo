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
 * the times of the newest and oldest candles in view and where they sit.
 */
export interface ITradingViewNativeSyncedViewport {
  /** Last second covered by the newest candle in view. */
  toTime: number;
  /** Space right of that candle's centre, as a share of the plot width. */
  rightGap: number;
  /** Open time of the oldest candle in view. */
  fromTime: number;
  /** Distance between the two candles' centres, as a share of the plot width. */
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

export function getTradingViewNativeSyncedViewport({
  candleIntervalSeconds,
  candleTimeMode,
  chartWidth,
  points,
  viewport,
}: IViewportGeometry): ITradingViewNativeSyncedViewport | null {
  const pointCount = points.length;
  if (!pointCount || !(chartWidth > 0)) return null;
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
  // The candles whose centres are in view; at least the one nearest to it.
  const newestIndex = Math.min(
    Math.max(Math.floor((plotRight - oldestX) / candleStep), 0),
    pointCount - 1,
  );
  const oldestIndex = Math.min(
    Math.max(Math.ceil((plotLeft - oldestX) / candleStep), 0),
    newestIndex,
  );
  const nextCandleTime =
    points[newestIndex + 1]?.t ??
    getTradingViewNativeCandleTimestampAtOffset({
      timestamp: points[newestIndex].t,
      candleIntervalSeconds,
      candleTimeMode,
      offset: 1,
    });
  return {
    toTime: nextCandleTime - 1,
    rightGap: (plotRight - (oldestX + newestIndex * candleStep)) / chartWidth,
    fromTime: points[oldestIndex].t,
    span: ((newestIndex - oldestIndex) * candleStep) / chartWidth,
  };
}

/**
 * The viewport that lines a chart up with `followed`: its candle holding
 * `toTime` gets the same place at the right. With `fitRange` the zoom changes
 * too, so the candle holding `fromTime` gets the same place at the left.
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
  const newestSlot = getTradingViewNativeCandleSlotAtTime({
    candleIntervalSeconds,
    candleTimeMode,
    points,
    time: followed.toTime,
  });
  if (!newestSlot || !(chartWidth > 0)) return null;
  // A candle still to come is "now" for this chart.
  const newestSlotIndex = Math.min(newestSlot.index, pointCount - 1);
  let zoomScale = clampTradingViewNativeZoomScale(viewport.zoomScale);
  if (fitRange) {
    const oldestSlot = getTradingViewNativeCandleSlotAtTime({
      candleIntervalSeconds,
      candleTimeMode,
      points,
      time: followed.fromTime,
    });
    // Counted before the loaded candles too, so the zoom is right before the
    // history it calls for has arrived. A span inside one candle of this
    // chart leaves the zoom alone.
    const candleCount = newestSlotIndex - (oldestSlot?.index ?? Infinity);
    if (candleCount > 0 && followed.span > 0) {
      zoomScale = clampTradingViewNativeZoomScale(
        (followed.span * chartWidth) /
          (candleCount * TRADING_VIEW_NATIVE_CANDLE_STEP),
      );
    }
  }
  const plotRight = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
  // A time before the loaded candles goes to the oldest one: the chart loads
  // further history from there.
  const newestIndex = Math.max(newestSlotIndex, 0);
  const newestX = getTradingViewNativeCandleX({
    index: newestIndex,
    initialRightOffset: viewport.initialRightOffset,
    offset: 0,
    pointCount,
    priceAxisX: plotRight,
    zoomScale,
  });
  return {
    offset: clampTradingViewNativePanOffset({
      chartWidth,
      initialRightOffset: viewport.initialRightOffset,
      offset: plotRight - followed.rightGap * chartWidth - newestX,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
