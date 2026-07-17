import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativeZoomedViewport,
} from './chartConstants';

describe('TradingViewNative chart layout', () => {
  it('keeps a fixed candle width and gap', () => {
    expect(TRADING_VIEW_NATIVE_CANDLE_STEP).toBe(
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + TRADING_VIEW_NATIVE_CANDLE_GAP,
    );
  });

  it('clamps horizontal panning to the available candle data', () => {
    const chartWidth = 100;
    const pointCount = 20;
    const maxOffset = getTradingViewNativeMaxPanOffset({
      chartWidth,
      pointCount,
      zoomScale: 1,
    });

    expect(maxOffset).toBe(60);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: -20,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(0);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: 30,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(30);
    expect(
      clampTradingViewNativePanOffset({
        chartWidth,
        offset: 100,
        pointCount,
        zoomScale: 1,
      }),
    ).toBe(maxOffset);
  });

  it('keeps zoom within the supported range', () => {
    expect(clampTradingViewNativeZoomScale(0.1)).toBe(
      TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
    );
    expect(clampTradingViewNativeZoomScale(10)).toBe(
      TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
    );
  });

  it('keeps the candle under the zoom anchor in place', () => {
    const chartWidth = 100;
    const anchorX = 50;
    const currentContentRight = chartWidth - TRADING_VIEW_NATIVE_CANDLE_GAP;
    const anchorDistance = currentContentRight - anchorX;
    const viewport = getTradingViewNativeZoomedViewport({
      anchorX,
      chartWidth,
      currentOffset: 0,
      currentZoomScale: 1,
      nextZoomScale: 2,
      pointCount: 20,
    });
    const nextContentRight =
      chartWidth -
      TRADING_VIEW_NATIVE_CANDLE_GAP * viewport.zoomScale +
      viewport.offset;

    expect(nextContentRight - anchorDistance * viewport.zoomScale).toBe(
      anchorX,
    );
  });
});
