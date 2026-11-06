import { TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE } from '../chartConstants';

import { clampTradingViewNativePanOffset } from './chartViewport';

import type {
  ITradingViewNativeChartRuntimeEvent,
  ITradingViewNativeChartRuntimeViewport,
} from './chartRuntime';

const NAVIGATION_ZOOM_STEP = 0.2;
const NAVIGATION_SCROLL_CHART_WIDTH_RATIO = 0.2;
const NAVIGATION_HOT_ZONE_HEIGHT = 180;
const NAVIGATION_HOT_ZONE_WIDTH_RATIO = 0.5;
const NAVIGATION_HOT_ZONE_HORIZONTAL_PADDING = 24;
const NAVIGATION_RESET_OFFSET_EPSILON = 0.5;
const NAVIGATION_RESET_ZOOM_EPSILON = 1e-6;

// 25% larger than the price scale A/L buttons, which share the same colors.
export const TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE = 25;
export const TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP = 6;
export const TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS = 5;
export const TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE = 18;
export const TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP = 12;

export type ITradingViewNativeNavigationAction =
  | 'zoomOut'
  | 'zoomIn'
  | 'scrollLeft'
  | 'scrollRight'
  | 'reset';

export const TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS: readonly ITradingViewNativeNavigationAction[] =
  ['zoomOut', 'zoomIn', 'scrollLeft', 'scrollRight'];

export const TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS: readonly ITradingViewNativeNavigationAction[] =
  [...TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS, 'reset'];

/**
 * Whether the reset action would change the view: the main price axis is
 * pinned, or the viewport moved away from the default zoom at the newest
 * candles.
 */
export function isTradingViewNativeNavigationResetAvailable({
  chartWidth,
  isAutoScale,
  pointCount,
  viewport,
}: {
  chartWidth: number;
  isAutoScale: boolean;
  pointCount: number;
  viewport: ITradingViewNativeChartRuntimeViewport;
}) {
  'worklet';

  if (!isAutoScale) {
    return true;
  }
  if (
    Math.abs(viewport.zoomScale - TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE) >
    NAVIGATION_RESET_ZOOM_EPSILON
  ) {
    return true;
  }
  // Match the reducer's clamped reset target so a no-op reset never shows.
  const resetOffset = clampTradingViewNativePanOffset({
    chartWidth,
    initialRightOffset: viewport.initialRightOffset,
    offset: 0,
    pointCount,
    zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  });
  return (
    Math.abs(viewport.offset - resetOffset) > NAVIGATION_RESET_OFFSET_EPSILON
  );
}

/**
 * The navigation bar only appears while the pointer is in the bottom-center
 * area around it, so it does not cover candles elsewhere on the chart.
 */
export function isTradingViewNativeNavigationHotZone({
  chartWidth,
  height,
  timeAxisHeight,
  x,
  y,
}: {
  chartWidth: number;
  height: number;
  timeAxisHeight: number;
  x: number;
  y: number;
}) {
  if (chartWidth <= 0 || height <= 0) {
    return false;
  }
  const actionCount = TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS.length;
  const controlsWidth =
    actionCount * TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE +
    (actionCount - 1) * TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP;
  const hotZoneWidth = Math.min(
    Math.max(
      chartWidth * NAVIGATION_HOT_ZONE_WIDTH_RATIO,
      controlsWidth + NAVIGATION_HOT_ZONE_HORIZONTAL_PADDING * 2,
    ),
    chartWidth,
  );
  const hotZoneTop = height - timeAxisHeight - NAVIGATION_HOT_ZONE_HEIGHT;
  return (
    Math.abs(x - chartWidth / 2) <= hotZoneWidth / 2 &&
    y >= hotZoneTop &&
    y <= height
  );
}

export function getTradingViewNativeNavigationEvent({
  action,
  chartWidth,
  pointCount,
  viewport,
}: {
  action: ITradingViewNativeNavigationAction;
  chartWidth: number;
  pointCount: number;
  viewport: ITradingViewNativeChartRuntimeViewport;
}): ITradingViewNativeChartRuntimeEvent | null {
  'worklet';

  if (!Number.isFinite(chartWidth) || chartWidth <= 0 || pointCount <= 0) {
    return null;
  }

  switch (action) {
    case 'zoomIn':
    case 'zoomOut':
      return {
        // Anchor at the right edge like TradingView, keeping the newest candles in place.
        anchorX: chartWidth,
        chartWidth,
        hideCrosshair: true,
        nextZoomScale:
          action === 'zoomIn'
            ? viewport.zoomScale * (1 + NAVIGATION_ZOOM_STEP)
            : viewport.zoomScale / (1 + NAVIGATION_ZOOM_STEP),
        pointCount,
        type: 'zoomed',
      };
    case 'scrollLeft':
    case 'scrollRight': {
      // A larger offset reveals older candles on the left.
      const direction = action === 'scrollLeft' ? 1 : -1;
      return {
        chartWidth,
        hideCrosshair: true,
        offset:
          viewport.offset +
          direction * chartWidth * NAVIGATION_SCROLL_CHART_WIDTH_RATIO,
        pointCount,
        type: 'panMoved',
      };
    }
    case 'reset':
      return {
        chartWidth,
        hideCrosshair: true,
        offset: 0,
        pointCount,
        type: 'panMoved',
        zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
      };
    default:
      return null;
  }
}
