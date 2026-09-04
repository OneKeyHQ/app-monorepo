import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
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

export interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  chartComponents: readonly ITradingViewNativeChartLeafComponent[];
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  currentPriceLabel: string;
  extendTimeAxisBorderToCanvasEdge?: boolean;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  indicatorSeriesSettingsKey: string;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  isSwitchingInterval: boolean;
  isMobileLayout?: boolean;
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
