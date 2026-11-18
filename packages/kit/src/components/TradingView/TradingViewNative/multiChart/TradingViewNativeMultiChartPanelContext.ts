import { createContext } from 'react';
import type { ReactNode } from 'react';

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

export interface ITradingViewNativeMultiChartControlsSlot {
  /**
   * Places the chart's controls row. The grid shows one row above all panels,
   * the selected panel's, so the other panels leave theirs out.
   */
  renderControls: (controls: ReactNode) => ReactNode;
}

// Set around every split-view panel, the first one included.
export const TradingViewNativeMultiChartControlsContext =
  createContext<ITradingViewNativeMultiChartControlsSlot | null>(null);
