import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE } from '../chartConstants';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
} from '../utils/chartRuntime';

import type {
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
  ITradingViewNativePriceScaleMode,
} from '../types';
import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export interface ITradingViewNativeChartSize {
  height: number;
  width: number;
}

export interface ITradingViewNativeChartRuntime extends ITradingViewNativeChartRuntimeState {
  candleIntervalSeconds: number;
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
}

export function createTradingViewNativeChartRuntime({
  candleIntervalSeconds,
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
  };
}
