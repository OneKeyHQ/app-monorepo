import { TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT } from '../chartConstants';

import {
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from './chartRuntime';

describe('TradingViewNative chart runtime', () => {
  it('starts at the newest candles with no active crosshair', () => {
    expect(createTradingViewNativeChartRuntimeState()).toEqual({
      crosshair: { visible: false, x: 0, y: 0 },
      viewport: { offset: 0, zoomScale: 1 },
    });
  });

  it('accepts a chart-width percentage as initial configuration', () => {
    expect(
      createTradingViewNativeChartRuntimeState({
        initialRightOffset: {
          type: 'chartWidthPercentage',
          value: 5,
        },
      }).viewport,
    ).toEqual({
      initialRightOffset: {
        type: 'chartWidthPercentage',
        value: 5,
      },
      initialRightOffsetResolved: true,
      offset: 0,
      zoomScale: 1,
    });
  });

  it('resolves the default from the first measured chart width only', () => {
    const state = createTradingViewNativeChartRuntimeState();
    const measuredState = reduceTradingViewNativeChartRuntime(state, {
      type: 'initialWidthMeasured',
      width: 500,
    });
    const resizedState = reduceTradingViewNativeChartRuntime(measuredState, {
      type: 'initialWidthMeasured',
      width: 1000,
    });

    expect(measuredState.viewport).toEqual({
      initialRightOffset: { type: 'pointCount', value: 2 },
      initialRightOffsetResolved: true,
      offset: 0,
      zoomScale: 1,
    });
    expect(resizedState).toBe(measuredState);
  });

  it('does not reset a user-adjusted viewport to the initial right offset', () => {
    const state = createTradingViewNativeChartRuntimeState({
      initialRightOffset: { type: 'pointCount', value: 2 },
    });
    const pannedState = reduceTradingViewNativeChartRuntime(state, {
      chartWidth: 100,
      hideCrosshair: false,
      offset: 10,
      pointCount: 40,
      type: 'panMoved',
      zoomScale: 1,
    });
    const updatedState = reduceTradingViewNativeChartRuntime(pannedState, {
      appendedPointCount: 1,
      chartWidth: 100,
      pointCount: 41,
      type: 'dataUpdated',
    });

    expect(state.viewport).toEqual({
      initialRightOffset: { type: 'pointCount', value: 2 },
      initialRightOffsetResolved: true,
      offset: 0,
      zoomScale: 1,
    });
    expect(pannedState.viewport).toEqual({
      initialRightOffset: { type: 'pointCount', value: 2 },
      initialRightOffsetResolved: true,
      offset: 10,
      zoomScale: 1,
    });
    expect(updatedState.viewport).toEqual({
      initialRightOffset: { type: 'pointCount', value: 2 },
      initialRightOffsetResolved: true,
      offset: 16,
      zoomScale: 1,
    });
  });

  it('preserves a historical viewport when candles are appended', () => {
    const state = {
      crosshair: { visible: false, x: 0, y: 0 },
      viewport: { offset: 24, zoomScale: 1 },
    };

    const nextState = reduceTradingViewNativeChartRuntime(state, {
      appendedPointCount: 2,
      chartWidth: 100,
      pointCount: 40,
      type: 'dataUpdated',
    });

    expect(nextState.viewport).toEqual({ offset: 36, zoomScale: 1 });
  });

  it('clamps panning and hides the crosshair when requested', () => {
    const state = {
      crosshair: { visible: true, x: 20, y: 30 },
      viewport: { offset: 10, zoomScale: 1 },
    };

    const nextState = reduceTradingViewNativeChartRuntime(state, {
      chartWidth: 100,
      hideCrosshair: true,
      offset: -50,
      pointCount: 40,
      type: 'panMoved',
      zoomScale: 2,
    });

    expect(nextState).toEqual({
      crosshair: { visible: false, x: 20, y: 30 },
      viewport: { offset: 0, zoomScale: 2 },
    });
  });

  it('applies a requested point range and clears the crosshair', () => {
    const state = {
      crosshair: { visible: true, x: 20, y: 30 },
      viewport: { offset: 0, zoomScale: 1 },
    };

    const nextState = reduceTradingViewNativeChartRuntime(state, {
      chartWidth: 240,
      pointCount: 100,
      pointRange: {
        firstIndex: 20,
        fitRange: true,
        lastIndex: 39,
      },
      type: 'viewportRequested',
    });

    expect(nextState.crosshair.visible).toBe(false);
    expect(nextState.viewport.offset).toBeGreaterThan(0);
    expect(nextState.viewport.zoomScale).toBeGreaterThan(1);
  });

  it('uses a stable gesture baseline while applying cumulative zoom', () => {
    const state = {
      crosshair: { visible: false, x: 0, y: 0 },
      viewport: { offset: 30, zoomScale: 2 },
    };
    const baseViewport = { offset: 10, zoomScale: 1 };

    const nextState = reduceTradingViewNativeChartRuntime(state, {
      anchorX: 100,
      baseViewport,
      chartWidth: 240,
      nextZoomScale: 1.5,
      pointCount: 100,
      type: 'zoomed',
    });
    const repeatedState = reduceTradingViewNativeChartRuntime(
      {
        ...state,
        viewport: nextState.viewport,
      },
      {
        anchorX: 100,
        baseViewport,
        chartWidth: 240,
        nextZoomScale: 1.5,
        pointCount: 100,
        type: 'zoomed',
      },
    );

    expect(repeatedState.viewport).toEqual(nextState.viewport);
  });

  it('normalizes crosshair bounds and derives the visible range', () => {
    const chartWidth = 256;
    const height = 240;
    const state = reduceTradingViewNativeChartRuntime(
      createTradingViewNativeChartRuntimeState(),
      {
        chartWidth,
        height,
        pointCount: 100,
        type: 'crosshairMoved',
        x: chartWidth - 1,
        y: height,
      },
    );

    expect(state.crosshair).toEqual({
      visible: true,
      x: chartWidth - 1,
      y: height - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
    });
    const compactState = reduceTradingViewNativeChartRuntime(state, {
      chartWidth,
      height,
      pointCount: 100,
      timeAxisHeight: 20,
      type: 'crosshairMoved',
      x: chartWidth - 1,
      y: height,
    });
    expect(compactState.crosshair.y).toBe(220);
    expect(
      getTradingViewNativeChartRuntimeVisiblePointRange({
        chartWidth,
        pointCount: 100,
        state,
      }),
    ).toEqual({
      endIndex: 100,
      startIndex: 57,
    });
  });
});
