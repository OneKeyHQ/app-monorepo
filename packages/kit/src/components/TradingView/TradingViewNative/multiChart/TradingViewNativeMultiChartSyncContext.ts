import { createContext } from 'react';

import type { ITradingViewNativeCrosshairSyncChannel } from './crosshairSync';
import type { ITradingViewNativeIntervalSync } from './intervalSync';
import type { ITradingViewNativeViewportSyncChannel } from './viewportSync';

export interface ITradingViewNativeMultiChartViewportSync {
  channel: ITradingViewNativeViewportSyncChannel;
  /** Also match the span of time in view, not only where it ends. */
  fitRange: boolean;
}

export interface ITradingViewNativeMultiChartSyncScope {
  /**
   * The first panel: a split view that opens with the interval, time or date
   * range synced starts from its chart.
   */
  isMain: boolean;
  /** The panel the chart is in. */
  panelId: string;
  /**
   * Tells the grid the interval the chart inside is on, synced or not, and
   * `undefined` as the chart goes. The grid starts interval syncing from the
   * selected panel's.
   */
  reportInterval: (interval: string | undefined) => void;
  /** The instrument of the chart mounted inside. */
  instrumentKey: string;
  // Each is null while the split view does not sync that part.
  crosshair: ITradingViewNativeCrosshairSyncChannel | null;
  interval: ITradingViewNativeIntervalSync | null;
  viewport: ITradingViewNativeMultiChartViewportSync | null;
}

// Set around every panel of a split view, with what that panel shares with
// the others.
export const TradingViewNativeMultiChartSyncContext =
  createContext<ITradingViewNativeMultiChartSyncScope | null>(null);
