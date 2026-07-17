export const TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH = 5;
export const TRADING_VIEW_NATIVE_CANDLE_GAP = 3;
export const TRADING_VIEW_NATIVE_CANDLE_STEP =
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + TRADING_VIEW_NATIVE_CANDLE_GAP;
export const TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH = 1;
export const TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE = 1;
export const TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE = 0.5;
export const TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE = 3;

export function clampTradingViewNativeZoomScale(scale: number) {
  'worklet';

  return Math.min(
    Math.max(scale, TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE),
    TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  );
}

export function getTradingViewNativeMaxPanOffset({
  chartWidth,
  pointCount,
  zoomScale,
}: {
  chartWidth: number;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  if (chartWidth <= 0 || pointCount <= 0) {
    return 0;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const dataWidth =
    (TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH +
      (pointCount - 1) * TRADING_VIEW_NATIVE_CANDLE_STEP) *
    clampedZoomScale;
  const visibleWidth = Math.max(
    chartWidth - TRADING_VIEW_NATIVE_CANDLE_GAP * clampedZoomScale,
    0,
  );

  return Math.max(dataWidth - visibleWidth, 0);
}

export function clampTradingViewNativePanOffset({
  chartWidth,
  offset,
  pointCount,
  zoomScale,
}: {
  chartWidth: number;
  offset: number;
  pointCount: number;
  zoomScale: number;
}) {
  'worklet';

  return Math.min(
    Math.max(offset, 0),
    getTradingViewNativeMaxPanOffset({
      chartWidth,
      pointCount,
      zoomScale,
    }),
  );
}

export function getTradingViewNativeZoomedViewport({
  anchorX,
  chartWidth,
  currentOffset,
  currentZoomScale,
  nextZoomScale,
  pointCount,
}: {
  anchorX: number;
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
    chartWidth,
    offset: currentOffset,
    pointCount,
    zoomScale: currentScale,
  });
  const currentContentRight =
    chartWidth - TRADING_VIEW_NATIVE_CANDLE_GAP * currentScale;
  const nextContentRight =
    chartWidth - TRADING_VIEW_NATIVE_CANDLE_GAP * zoomScale;
  const anchorDistance =
    (currentContentRight + offset - clampedAnchorX) / currentScale;
  const nextOffset =
    clampedAnchorX - nextContentRight + anchorDistance * zoomScale;

  return {
    offset: clampTradingViewNativePanOffset({
      chartWidth,
      offset: nextOffset,
      pointCount,
      zoomScale,
    }),
    zoomScale,
  };
}
