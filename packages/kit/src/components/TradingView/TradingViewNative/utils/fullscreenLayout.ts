import { getTradingViewNativeMainPriceAxisLayout } from './priceAxisScale';

const ANDROID_LARGE_WINDOW_MIN_DIMENSION = 600;

export interface ITradingViewNativeFullscreenInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function normalizeLayoutValue(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function shouldHideTradingViewNativeStatusBar({
  height,
  isAndroid,
  isFullscreen,
  isSpanningWindow,
  width,
}: {
  height: number;
  isAndroid: boolean;
  isFullscreen: boolean;
  isSpanningWindow: boolean;
  width: number;
}) {
  if (!isAndroid || !isFullscreen || isSpanningWindow) {
    return false;
  }

  // The shortest edge keeps the window class stable when fullscreen rotates.
  const minWindowDimension = Math.min(width, height);
  return (
    Number.isFinite(minWindowDimension) &&
    minWindowDimension > 0 &&
    minWindowDimension < ANDROID_LARGE_WINDOW_MIN_DIMENSION
  );
}

export function getTradingViewNativeFullscreenLayout({
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
  const fullscreenWidth = normalizedWidth;
  const fullscreenHeight = normalizedHeight;
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
  timeAxisHeight,
}: {
  chartHeight: number;
  paneCount: number;
  timeAxisHeight?: number;
}) {
  return (
    getTradingViewNativeMainPriceAxisLayout({
      height: chartHeight,
      paneCount,
      timeAxisHeight,
    }).bottomInset + 8
  );
}
