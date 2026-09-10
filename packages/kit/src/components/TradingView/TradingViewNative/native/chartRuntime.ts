import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE } from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import { getTradingViewNativeGestureStartOffsetAfterDataUpdate } from '../utils/chartViewport';

import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
  ITradingViewNativePriceScaleMode,
} from '../types';
import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativePriceRange } from '../utils/chartViewport';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export interface ITradingViewNativeChartSize {
  height: number;
  width: number;
}

export interface ITradingViewNativeChartRuntime extends ITradingViewNativeChartRuntimeState {
  candleIntervalSeconds: number;
  chartComponents: readonly ITradingViewNativeChartLeafComponent[];
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  currentPriceLabel: string;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  panGesture: {
    startOffset: number;
    translationX: number;
  };
  pinchGesture: {
    anchorX: number;
    currentScale: number;
    isActive: boolean;
    scaleBaseline: number;
    startOffset: number;
    startZoomScale: number;
  };
  pinnedPriceRange: ITradingViewNativePriceRange | null;
  priceAxisScaleGesture: {
    chartHeight: number;
    startScale: number;
    startY: number;
  };
  priceRangeScale: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  points: IMarketTokenKLineDataPoint[];
  size: ITradingViewNativeChartSize;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisScaleGesture: {
    chartWidth: number;
    currentX: number;
    isActive: boolean;
    startOffset: number;
    startX: number;
    startZoomScale: number;
  };
}

export function resizeTradingViewNativeChartRuntime(
  runtime: ITradingViewNativeChartRuntime,
  size: ITradingViewNativeChartSize,
  priceAxisWidth: number,
): ITradingViewNativeChartRuntime {
  'worklet';

  if (
    size.width <= 0 ||
    size.height <= 0 ||
    (runtime.size.width === size.width && runtime.size.height === size.height)
  ) {
    return runtime;
  }

  const measuredRuntime = {
    ...runtime,
    ...reduceTradingViewNativeChartRuntime(runtime, {
      type: 'initialWidthMeasured',
      width: size.width,
    }),
  };
  const nextState = reduceTradingViewNativeChartRuntime(measuredRuntime, {
    appendedPointCount: 0,
    chartWidth: getTradingViewNativeChartWidth(size.width, priceAxisWidth),
    pointCount: runtime.points.length,
    type: 'dataUpdated',
  });
  const offsetDelta = nextState.viewport.offset - runtime.viewport.offset;

  // Resizing preserves the data arrays already owned by the UI runtime.
  return {
    ...runtime,
    ...nextState,
    crosshair: { ...runtime.crosshair, visible: false },
    size,
    panGesture: {
      ...runtime.panGesture,
      startOffset: runtime.panGesture.startOffset + offsetDelta,
    },
    pinchGesture: {
      ...runtime.pinchGesture,
      startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
        currentZoomScale: runtime.viewport.zoomScale,
        offsetDelta,
        startOffset: runtime.pinchGesture.startOffset,
        startZoomScale: runtime.pinchGesture.startZoomScale,
      }),
    },
    timeAxisScaleGesture: {
      ...runtime.timeAxisScaleGesture,
      startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
        currentZoomScale: runtime.viewport.zoomScale,
        offsetDelta,
        startOffset: runtime.timeAxisScaleGesture.startOffset,
        startZoomScale: runtime.timeAxisScaleGesture.startZoomScale,
      }),
    },
  };
}

export function createTradingViewNativeChartRuntime({
  candleIntervalSeconds,
  chartComponents,
  chartSettings,
  chartType,
  currentPriceLabel,
  hasVolume,
  indicatorSeries,
  initialRightOffset,
  points,
  subIndicatorPanes,
}: {
  candleIntervalSeconds: number;
  chartComponents: readonly ITradingViewNativeChartLeafComponent[];
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  currentPriceLabel: string;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  points: IMarketTokenKLineDataPoint[];
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}): ITradingViewNativeChartRuntime {
  return {
    ...createTradingViewNativeChartRuntimeState({ initialRightOffset }),
    candleIntervalSeconds,
    chartComponents,
    chartSettings,
    chartType,
    currentPriceLabel,
    hasVolume,
    indicatorSeries,
    panGesture: {
      startOffset: 0,
      translationX: 0,
    },
    pinchGesture: {
      anchorX: 0,
      currentScale: 1,
      isActive: false,
      scaleBaseline: 1,
      startOffset: 0,
      startZoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    },
    pinnedPriceRange: null,
    priceAxisScaleGesture: {
      chartHeight: 0,
      startScale: 1,
      startY: 0,
    },
    priceRangeScale: 1,
    priceScaleMode: 'linear',
    points,
    size: { height: 0, width: 0 },
    subIndicatorPanes,
    timeAxisScaleGesture: {
      chartWidth: 0,
      currentX: 0,
      isActive: false,
      startOffset: 0,
      startX: 0,
      startZoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    },
  };
}
