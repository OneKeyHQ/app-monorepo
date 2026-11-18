import type { ReactNode } from 'react';

import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

export interface ITradingViewNativeMultiChartPanel {
  id: string;
  index: number;
  /**
   * The first panel: it keeps the host's own interval and indicators wherever
   * the selection is.
   */
  isMain: boolean;
  /**
   * The selected panel: it shows the host's own source, and its controls row
   * is the one the grid shows above all panels.
   */
  isActive: boolean;
  /** More than one chart is on screen. */
  isSplit: boolean;
  /**
   * Every panel shows the selected panel's token, the host's own source. A pick
   * in any panel should then change the host's source instead of calling
   * `setSource`.
   */
  isSymbolSynced: boolean;
  source: ITradingViewNativeSource;
  /** Layout picker for the selected panel's controls; null for the others. */
  layoutControl: ReactNode;
  /**
   * Changes the token of a panel that is not selected. The selected panel
   * follows the host.
   */
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
  /** The host's source, shown by the selected panel. */
  activeSource: ITradingViewNativeSource;
  /**
   * The user selected a panel showing `source`; the host switches to it.
   * Resolves whether it did. A selection the host turns down returns to the
   * panel selected before.
   */
  onSelectPanel: (source: ITradingViewNativeSource) => Promise<boolean>;
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
