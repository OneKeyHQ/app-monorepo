import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../chartConstants';

import {
  type ITradingViewNativeViewportPointRange,
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  getTradingViewNativePanOffsetAfterDataUpdate,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativeViewportForPointRange,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from './chartViewport';

export interface ITradingViewNativeChartRuntimeViewport {
  offset: number;
  zoomScale: number;
}

export interface ITradingViewNativeChartRuntimeCrosshair {
  visible: boolean;
  x: number;
  y: number;
}

export interface ITradingViewNativeChartRuntimeState {
  crosshair: ITradingViewNativeChartRuntimeCrosshair;
  viewport: ITradingViewNativeChartRuntimeViewport;
}

export type ITradingViewNativeChartRuntimeEvent =
  | {
      appendedPointCount: number;
      chartWidth: number;
      pointCount: number;
      type: 'dataUpdated';
    }
  | {
      chartWidth: number;
      hideCrosshair?: boolean;
      offset: number;
      pointCount: number;
      type: 'panMoved';
      zoomScale?: number;
    }
  | {
      chartWidth: number;
      pointCount: number;
      pointRange: ITradingViewNativeViewportPointRange;
      type: 'viewportRequested';
    }
  | {
      anchorX: number;
      baseViewport?: ITradingViewNativeChartRuntimeViewport;
      chartWidth: number;
      hideCrosshair?: boolean;
      nextZoomScale: number;
      pointCount: number;
      type: 'zoomed';
    }
  | {
      chartWidth: number;
      height: number;
      pointCount: number;
      type: 'crosshairMoved';
      x: number;
      y: number;
    }
  | {
      type: 'crosshairHidden';
    };

function getHiddenCrosshair(
  crosshair: ITradingViewNativeChartRuntimeCrosshair,
): ITradingViewNativeChartRuntimeCrosshair {
  'worklet';

  return crosshair.visible ? { ...crosshair, visible: false } : crosshair;
}

export function createTradingViewNativeChartRuntimeState(): ITradingViewNativeChartRuntimeState {
  'worklet';

  return {
    crosshair: { visible: false, x: 0, y: 0 },
    viewport: {
      offset: 0,
      zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    },
  };
}

export function reduceTradingViewNativeChartRuntime(
  state: ITradingViewNativeChartRuntimeState,
  event: ITradingViewNativeChartRuntimeEvent,
): ITradingViewNativeChartRuntimeState {
  'worklet';

  switch (event.type) {
    case 'dataUpdated':
      return {
        crosshair: state.crosshair,
        viewport: {
          ...state.viewport,
          offset: getTradingViewNativePanOffsetAfterDataUpdate({
            appendedPointCount: event.appendedPointCount,
            chartWidth: event.chartWidth,
            currentOffset: state.viewport.offset,
            pointCount: event.pointCount,
            zoomScale: state.viewport.zoomScale,
          }),
        },
      };
    case 'panMoved': {
      const zoomScale = event.zoomScale ?? state.viewport.zoomScale;
      return {
        crosshair: event.hideCrosshair
          ? getHiddenCrosshair(state.crosshair)
          : state.crosshair,
        viewport: {
          offset: clampTradingViewNativePanOffset({
            chartWidth: event.chartWidth,
            offset: event.offset,
            pointCount: event.pointCount,
            zoomScale,
          }),
          zoomScale,
        },
      };
    }
    case 'viewportRequested': {
      const viewport = getTradingViewNativeViewportForPointRange({
        ...event.pointRange,
        chartWidth: event.chartWidth,
        currentZoomScale: state.viewport.zoomScale,
        pointCount: event.pointCount,
      });
      if (!viewport) {
        return {
          crosshair: state.crosshair,
          viewport: state.viewport,
        };
      }
      return {
        crosshair: getHiddenCrosshair(state.crosshair),
        viewport,
      };
    }
    case 'zoomed': {
      const baseViewport = event.baseViewport ?? state.viewport;
      return {
        crosshair: event.hideCrosshair
          ? getHiddenCrosshair(state.crosshair)
          : state.crosshair,
        viewport: getTradingViewNativeZoomedViewport({
          anchorX: event.anchorX,
          chartWidth: event.chartWidth,
          currentOffset: baseViewport.offset,
          currentZoomScale: baseViewport.zoomScale,
          nextZoomScale: event.nextZoomScale,
          pointCount: event.pointCount,
        }),
      };
    }
    case 'crosshairMoved': {
      const priceAxisX = Math.max(
        TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + event.chartWidth,
        0,
      );
      const pointIndex = getTradingViewNativePointIndexAtX({
        offset: state.viewport.offset,
        pointCount: event.pointCount,
        priceAxisX,
        x: event.x,
        zoomScale: state.viewport.zoomScale,
      });
      return {
        crosshair: {
          visible: pointIndex !== null,
          x: event.x,
          y: Math.min(
            Math.max(event.y, 0),
            Math.max(event.height - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT, 0),
          ),
        },
        viewport: state.viewport,
      };
    }
    case 'crosshairHidden':
      return {
        crosshair: getHiddenCrosshair(state.crosshair),
        viewport: state.viewport,
      };
    default:
      event satisfies never;
      return state;
  }
}

export function getTradingViewNativeChartRuntimeVisiblePointRange({
  chartWidth,
  pointCount,
  state,
}: {
  chartWidth: number;
  pointCount: number;
  state: ITradingViewNativeChartRuntimeState;
}): ITradingViewNativeVisiblePointRange {
  'worklet';

  return getTradingViewNativeVisiblePointRange({
    chartWidth,
    offset: state.viewport.offset,
    pointCount,
    zoomScale: state.viewport.zoomScale,
  });
}
