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

export interface ITradingViewNativeMultiChartDrawingTools {
  /**
   * Where the chart's tools go: one column at the left of the grid, the
   * selected panel's. Null for the other panels, which show none.
   */
  container: HTMLElement | null;
  /** One collapse state for the column, whichever chart's tools it shows. */
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  /**
   * The width the panel's chart gains when the column collapses: what its
   * tracks take of the column, and nothing while they are held at the minimum
   * panel width. Its price scale counts it in, as a single chart counts its
   * own tools in, so the candles that collapsing reveals never rescale it.
   */
  getCollapseGain: () => number;
}

export interface ITradingViewNativeMultiChartControlsSlot {
  /**
   * Places the chart's controls row. The grid shows one row above all panels,
   * the selected panel's, so the other panels leave theirs out.
   */
  renderControls: (controls: ReactNode) => ReactNode;
  drawingTools: ITradingViewNativeMultiChartDrawingTools;
}

// Set around every split-view panel, the first one included.
export const TradingViewNativeMultiChartControlsContext =
  createContext<ITradingViewNativeMultiChartControlsSlot | null>(null);
