import type { ReactNode } from 'react';

import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

export interface ITradingViewNativeMultiChartPanel {
  id: string;
  index: number;
  /** The first panel: it shows the host's own source and keeps its features. */
  isMain: boolean;
  /** More than one chart is on screen. */
  isSplit: boolean;
  source: ITradingViewNativeSource;
  /** Layout picker. The host places it in the first panel's controls. */
  layoutControl: ReactNode;
  /** Changes an extra panel's token. The first panel follows the host. */
  setSource: (source: ITradingViewNativeSource) => void;
}

export interface ITradingViewNativeMultiChartProps {
  /** Persisted by the host, so each module keeps its own split view. */
  layout: ITradingViewNativeMultiChartLayout;
  onLayoutChange: (
    update: (
      current: ITradingViewNativeMultiChartLayout,
    ) => ITradingViewNativeMultiChartLayout,
  ) => unknown;
  mainSource: ITradingViewNativeSource;
  /** Indicators a newly opened panel starts from. */
  defaultIndicatorSettings: ITradingViewNativeIndicatorSettings;
  /** Token for a newly opened panel; `usedSources` are already on screen. */
  getDefaultPanelSource: (params: {
    usedSources: readonly ITradingViewNativeSource[];
  }) => ITradingViewNativeSource;
  /** Renders the chart of one panel, normally a `TradingViewNative`. */
  renderPanel: (panel: ITradingViewNativeMultiChartPanel) => ReactNode;
  testID?: string;
}
