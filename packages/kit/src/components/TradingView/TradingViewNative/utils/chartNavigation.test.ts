import {
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE,
} from '../chartConstants';

import {
  getTradingViewNativeNavigationEvent,
  isTradingViewNativeNavigationHotZone,
} from './chartNavigation';
import {
  createTradingViewNativeChartRuntimeState,
  reduceTradingViewNativeChartRuntime,
} from './chartRuntime';

import type { ITradingViewNativeNavigationAction } from './chartNavigation';
import type { ITradingViewNativeChartRuntimeState } from './chartRuntime';

const CHART_WIDTH = 400;
const POINT_COUNT = 500;

function navigate(
  state: ITradingViewNativeChartRuntimeState,
  action: ITradingViewNativeNavigationAction,
) {
  const event = getTradingViewNativeNavigationEvent({
    action,
    chartWidth: CHART_WIDTH,
    pointCount: POINT_COUNT,
    viewport: state.viewport,
  });
  return event ? reduceTradingViewNativeChartRuntime(state, event) : state;
}

describe('TradingViewNative chart navigation', () => {
  it('zooms in and out around the newest candles', () => {
    const initial = createTradingViewNativeChartRuntimeState();
    const zoomedIn = navigate(initial, 'zoomIn');
    expect(zoomedIn.viewport.zoomScale).toBeGreaterThan(
      initial.viewport.zoomScale,
    );
    expect(zoomedIn.viewport.offset).toBeCloseTo(initial.viewport.offset);

    const restored = navigate(zoomedIn, 'zoomOut');
    expect(restored.viewport.zoomScale).toBeCloseTo(initial.viewport.zoomScale);
  });

  it('keeps zoom within the supported range', () => {
    let state = createTradingViewNativeChartRuntimeState();
    for (let index = 0; index < 20; index += 1) {
      state = navigate(state, 'zoomIn');
    }
    expect(state.viewport.zoomScale).toBe(TRADING_VIEW_NATIVE_MAX_ZOOM_SCALE);
  });

  it('scrolls toward older candles and back', () => {
    const initial = createTradingViewNativeChartRuntimeState();
    const scrolledLeft = navigate(initial, 'scrollLeft');
    expect(scrolledLeft.viewport.offset).toBeGreaterThan(
      initial.viewport.offset,
    );
    const scrolledBack = navigate(scrolledLeft, 'scrollRight');
    expect(scrolledBack.viewport.offset).toBeCloseTo(initial.viewport.offset);
  });

  it('resets the viewport to the default zoom at the newest candles', () => {
    let state = createTradingViewNativeChartRuntimeState();
    state = navigate(
      navigate(navigate(state, 'zoomIn'), 'scrollLeft'),
      'reset',
    );
    expect(state.viewport.offset).toBe(0);
    expect(state.viewport.zoomScale).toBe(
      TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    );
  });

  it('ignores navigation before the chart is measured or has data', () => {
    const { viewport } = createTradingViewNativeChartRuntimeState();
    expect(
      getTradingViewNativeNavigationEvent({
        action: 'zoomIn',
        chartWidth: 0,
        pointCount: POINT_COUNT,
        viewport,
      }),
    ).toBeNull();
    expect(
      getTradingViewNativeNavigationEvent({
        action: 'reset',
        chartWidth: CHART_WIDTH,
        pointCount: 0,
        viewport,
      }),
    ).toBeNull();
  });

  describe('hot zone', () => {
    const layout = { chartWidth: 800, height: 400, timeAxisHeight: 24 };

    it('shows the controls in the bottom-center area', () => {
      expect(
        isTradingViewNativeNavigationHotZone({ ...layout, x: 400, y: 340 }),
      ).toBe(true);
      expect(
        isTradingViewNativeNavigationHotZone({ ...layout, x: 220, y: 300 }),
      ).toBe(true);
    });

    it('hides the controls near the top or side edges', () => {
      expect(
        isTradingViewNativeNavigationHotZone({ ...layout, x: 400, y: 100 }),
      ).toBe(false);
      expect(
        isTradingViewNativeNavigationHotZone({ ...layout, x: 40, y: 340 }),
      ).toBe(false);
      expect(
        isTradingViewNativeNavigationHotZone({ ...layout, x: 760, y: 340 }),
      ).toBe(false);
    });

    it('keeps the controls reachable on narrow charts', () => {
      expect(
        isTradingViewNativeNavigationHotZone({
          chartWidth: 200,
          height: 400,
          timeAxisHeight: 24,
          x: 30,
          y: 340,
        }),
      ).toBe(true);
    });

    it('ignores unmeasured charts', () => {
      expect(
        isTradingViewNativeNavigationHotZone({
          chartWidth: 0,
          height: 400,
          timeAxisHeight: 24,
          x: 0,
          y: 340,
        }),
      ).toBe(false);
    });
  });
});
