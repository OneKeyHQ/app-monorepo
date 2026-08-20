import { TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT } from '../chartConstants';

import { getTradingViewNativeSubIndicatorPaneStackHeight } from './subIndicatorRender';

export interface ITradingViewNativeFullscreenInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function normalizeLayoutValue(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function getTradingViewNativeLandscapeFullscreenLayout({
  height,
  insets,
  width,
}: {
  height: number;
  insets: ITradingViewNativeFullscreenInsets;
  width: number;
}) {
  const normalizedWidth = normalizeLayoutValue(width);
  const normalizedHeight = normalizeLayoutValue(height);
  const fullscreenWidth = Math.max(normalizedWidth, normalizedHeight);
  const fullscreenHeight = Math.min(normalizedWidth, normalizedHeight);
  const normalizedInsets = {
    bottom: normalizeLayoutValue(insets.bottom),
    left: normalizeLayoutValue(insets.left),
    right: normalizeLayoutValue(insets.right),
    top: normalizeLayoutValue(insets.top),
  };

  return {
    contentHeight: Math.max(
      fullscreenHeight - normalizedInsets.top - normalizedInsets.bottom,
      0,
    ),
    contentWidth: Math.max(
      fullscreenWidth - normalizedInsets.left - normalizedInsets.right,
      0,
    ),
    fullscreenHeight,
    fullscreenWidth,
    insets: normalizedInsets,
  };
}

export function getTradingViewNativeFullscreenButtonBottom({
  chartHeight,
  paneCount,
}: {
  chartHeight: number;
  paneCount: number;
}) {
  return (
    TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT +
    getTradingViewNativeSubIndicatorPaneStackHeight({
      height: chartHeight,
      paneCount,
    }) +
    8
  );
}
