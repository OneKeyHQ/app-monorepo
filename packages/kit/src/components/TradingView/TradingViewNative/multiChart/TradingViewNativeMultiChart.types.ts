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
  /** Every panel shows the selected panel's token, the host's own source. */
  isSymbolSynced: boolean;
  source: ITradingViewNativeSource;
  /** Layout picker for the selected panel's controls; null for the others. */
  layoutControl: ReactNode;
  /**
   * Selects the panel with another token, e.g. one picked in its header: the
   * host switches to it once, and that switch decides the selection like a
   * press on the panel would.
   */
  selectSource: (source: ITradingViewNativeSource) => void;
}

export interface ITradingViewNativeMultiChartProps {
  /** Persisted by the host, so each module keeps its own split view. */
  layout: ITradingViewNativeMultiChartLayout;
  /**
   * Names the saved layout. Grids of one key, e.g. one unmounted and the next
   * mounted, share the writes it has not caught up with yet, so a late write
   * of a grid that is gone, such as a selection the host answers then, builds
   * on them and on the writes of a grid mounted since. Without a key, a grid
   * gone writes from the latest saved layout.
   */
  layoutKey?: string;
  onLayoutChange: (
    update: (
      current: ITradingViewNativeMultiChartLayout,
    ) => ITradingViewNativeMultiChartLayout,
  ) => unknown;
  /** The host's source, shown by the selected panel. */
  activeSource: ITradingViewNativeSource;
  /**
   * The panel selected on this page, which the host keeps beside its source.
   * For a saved layout other pages share, e.g. extension tabs, each with a
   * source of its own: the panel another page selects is not the one this
   * page's source is in. The grid sets it from the saved layout once, e.g.
   * after a reload, and from then on with each selection it saves. Without
   * it, the selection is the saved layout's.
   */
  selectedPanelId?: string;
  onSelectedPanelIdChange?: (panelId: string) => void;
  /**
   * The user selected a panel showing `source`; the host switches to it.
   * Resolves whether it did. A selection the host turns down returns to the
   * panel selected before, and is saved only once the host has followed.
   *
   * Also called with the source the host already shows while an earlier
   * switch is still on its way; the host then has to drop that switch.
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
