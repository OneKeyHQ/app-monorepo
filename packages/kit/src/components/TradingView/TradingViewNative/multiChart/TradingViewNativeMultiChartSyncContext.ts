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
  /** The first panel: the others start from its interval and viewport. */
  isMain: boolean;
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
