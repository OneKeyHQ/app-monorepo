import { createContext } from 'react';

import type { useTradingViewNativeIndicatorSettings } from '../useTradingViewNativeSettings';

export interface ITradingViewNativeMultiChartPanelScope {
  /** Scopes the chart's interval and pane preferences to this panel. */
  panelId: string;
  indicatorSettingsState: ReturnType<
    typeof useTradingViewNativeIndicatorSettings
  >;
}

// Set around every extra split-view panel. A chart mounted inside keeps its own
// interval, indicators and pane heights instead of the namespace-wide ones.
export const TradingViewNativeMultiChartPanelContext =
  createContext<ITradingViewNativeMultiChartPanelScope | null>(null);
