import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../chartConstants';

import { getTradingViewNativeChartWidth } from './chartLayout';
import { clampTradingViewNativeZoomScale } from './chartViewport';

const TIME_AXIS_SCALE_SENSITIVITY = 2;

export function getTradingViewNativeTimeAxisZoomScaleAfterDrag({
  chartWidth,
  currentX,
  startX,
  startZoomScale,
}: {
  chartWidth: number;
  currentX: number;
  startX: number;
  startZoomScale: number;
}) {
  'worklet';

  const normalizedStartZoomScale = clampTradingViewNativeZoomScale(
    Number.isFinite(startZoomScale)
      ? startZoomScale
      : TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  );
  if (
    !Number.isFinite(chartWidth) ||
    chartWidth <= 0 ||
    !Number.isFinite(currentX) ||
    !Number.isFinite(startX)
  ) {
    return normalizedStartZoomScale;
  }

  const dragRatio = (startX - currentX) / chartWidth;
  const relativeScale = Math.exp(dragRatio * TIME_AXIS_SCALE_SENSITIVITY);

  return clampTradingViewNativeZoomScale(
    normalizedStartZoomScale * relativeScale,
  );
}

export function isTradingViewNativeTimeAxisTouch({
  height,
  priceAxisWidth,
  timeAxisHeight,
  width,
  x,
  y,
}: {
  height: number;
  priceAxisWidth: number;
  timeAxisHeight?: number;
  width: number;
  x: number;
  y: number;
}) {
  'worklet';

  if (
    !Number.isFinite(height) ||
    !Number.isFinite(priceAxisWidth) ||
    !Number.isFinite(width) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    height <= 0 ||
    width <= 0
  ) {
    return false;
  }

  const chartWidth = getTradingViewNativeChartWidth(width, priceAxisWidth);
  const axisStartX = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING;
  const axisEndX = axisStartX + chartWidth;
  const resolvedTimeAxisHeight =
    typeof timeAxisHeight === 'number' && Number.isFinite(timeAxisHeight)
      ? Math.max(timeAxisHeight, 0)
      : TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  const axisStartY = Math.max(height - resolvedTimeAxisHeight, 0);

  return (
    chartWidth > 0 &&
    x >= axisStartX &&
    x < axisEndX &&
    y >= axisStartY &&
    y <= height
  );
}
