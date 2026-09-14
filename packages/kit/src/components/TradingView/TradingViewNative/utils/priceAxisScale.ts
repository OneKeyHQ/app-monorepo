import { TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING } from '../chartConstants';

import { getTradingViewNativeChartWidth } from './chartLayout';
import { getTradingViewNativeSubIndicatorPaneStackLayout } from './subIndicatorRender/layout';

// Keep scaling stable near the bottom edge where the inverted Y coordinate approaches zero.
const PRICE_AXIS_SCALE_MARGIN_RATIO = 0.2;
const MIN_PRICE_RANGE_SCALE = 0.1;
const MAX_PRICE_RANGE_SCALE = 10;

export function getTradingViewNativeMainPriceAxisLayout({
  height,
  paneCount,
  timeAxisHeight,
}: {
  height: number;
  paneCount: number;
  timeAxisHeight?: number;
}) {
  'worklet';

  const normalizedHeight = Number.isFinite(height) ? Math.max(height, 0) : 0;
  const paneStackLayout = getTradingViewNativeSubIndicatorPaneStackLayout({
    height: normalizedHeight,
    paneCount,
    timeAxisHeight,
  });
  return {
    bottomInset: normalizedHeight - paneStackLayout.top,
    height: paneStackLayout.top,
  };
}

export function clampTradingViewNativePriceRangeScale(scale: number) {
  'worklet';

  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.min(
    Math.max(scale, MIN_PRICE_RANGE_SCALE),
    MAX_PRICE_RANGE_SCALE,
  );
}

export function getTradingViewNativePriceRangeScaleAfterDrag({
  chartHeight,
  currentY,
  startScale,
  startY,
}: {
  chartHeight: number;
  currentY: number;
  startScale: number;
  startY: number;
}) {
  'worklet';

  const normalizedStartScale =
    clampTradingViewNativePriceRangeScale(startScale);
  if (
    !Number.isFinite(chartHeight) ||
    chartHeight <= 0 ||
    !Number.isFinite(currentY) ||
    !Number.isFinite(startY)
  ) {
    return normalizedStartScale;
  }

  const normalizedStartY = Math.min(Math.max(startY, 0), chartHeight);
  const startPoint = chartHeight - normalizedStartY;
  const currentPoint = Math.max(chartHeight - currentY, 0);
  const scaleMargin = chartHeight * PRICE_AXIS_SCALE_MARGIN_RATIO;
  const relativeScale =
    (startPoint + scaleMargin) / (currentPoint + scaleMargin);

  return clampTradingViewNativePriceRangeScale(
    normalizedStartScale * relativeScale,
  );
}

export function isTradingViewNativePriceAxisTouch({
  priceAxisHeight,
  priceAxisWidth,
  width,
  x,
  y,
}: {
  priceAxisHeight: number;
  priceAxisWidth: number;
  width: number;
  x: number;
  y: number;
}) {
  'worklet';

  if (
    !Number.isFinite(priceAxisHeight) ||
    !Number.isFinite(priceAxisWidth) ||
    !Number.isFinite(width) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    priceAxisHeight <= 0 ||
    priceAxisWidth <= 0 ||
    width <= 0
  ) {
    return false;
  }

  const priceAxisX =
    TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING +
    getTradingViewNativeChartWidth(width, priceAxisWidth);
  return x >= priceAxisX && x <= width && y >= 0 && y < priceAxisHeight;
}

export function isTradingViewNativeMainPriceAxisTouch({
  height,
  paneCount,
  priceAxisWidth,
  timeAxisHeight,
  width,
  x,
  y,
}: {
  height: number;
  paneCount: number;
  priceAxisWidth: number;
  timeAxisHeight?: number;
  width: number;
  x: number;
  y: number;
}) {
  'worklet';

  return isTradingViewNativePriceAxisTouch({
    priceAxisHeight: getTradingViewNativeMainPriceAxisLayout({
      height,
      paneCount,
      timeAxisHeight,
    }).height,
    priceAxisWidth,
    width,
    x,
    y,
  });
}
