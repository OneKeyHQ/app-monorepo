import type { RefObject } from 'react';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import type { ITradingViewNativeChartRuntime } from './native/chartRuntime';
import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
  ITradingViewNativePriceSelection,
  ITradingViewNativeReferenceLineAction,
} from './types';
import type {
  ITradingViewNativeIndicatorSeries,
  ITradingViewNativeSubIndicator,
} from './utils/chartIndicators';
import type {
  ITradingViewNativeViewportRequest,
  ITradingViewNativeVisiblePointRange,
} from './utils/chartViewport';
import type { ITradingViewNativeSubIndicatorRenderPane } from './utils/subIndicatorRender';
import type { SharedValue } from 'react-native-reanimated';

export interface ITradingViewNativeChartProps {
  drawingStorageKey?: string;
  enableDrawings?: boolean;
  /** Owned by the data controller so native presentation changes retain the viewport. */
  runtimeRef?: RefObject<{
    runtime: SharedValue<ITradingViewNativeChartRuntime>;
    decayOffset: SharedValue<number>;
  } | null>;
  candleIntervalSeconds: number;
  chartComponents: readonly ITradingViewNativeChartLeafComponent[];
  onReferenceLineAction?: (
    action: ITradingViewNativeReferenceLineAction,
  ) => Promise<void>;
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  currentPriceLabel: string;
  priceDecimalPlaces?: number;
  onPriceSelect?: (selection: ITradingViewNativePriceSelection) => void;
  priceSelectionLabel?: string;
  onInteractionChange?: (isInteracting: boolean) => void;
  extendTimeAxisBorderToCanvasEdge?: boolean;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  indicatorSeriesSettingsKey: string;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  isSwitchingInterval: boolean;
  isMobileLayout?: boolean;
  resizesWithSubIndicatorPanes?: boolean;
  locale: string;
  priceAxisFontSize?: number;
  priceAxisTickCount?: number;
  showLegend?: boolean;
  timeAxisFontSize?: number;
  timeAxisHeight?: number;
  timeAxisBorderWidth?: number;
  onChartWidthChange?: (width: number) => void;
  onSubIndicatorSettingsPress: (
    indicator: ITradingViewNativeSubIndicator,
  ) => void;
  onViewportRequestApplied?: (requestId: number) => void;
  onVisiblePointRangeChange?: (
    range: ITradingViewNativeVisiblePointRange,
  ) => void;
  candleLabels: ITradingViewNativeCandleLabels;
  points: IMarketTokenKLineDataPoint[];
  subIndicatorPanes?: readonly ITradingViewNativeSubIndicatorRenderPane[];
  testID?: string;
  viewportRequest?: ITradingViewNativeViewportRequest | null;
}
