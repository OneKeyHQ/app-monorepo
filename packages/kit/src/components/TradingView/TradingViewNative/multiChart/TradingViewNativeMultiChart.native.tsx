import { TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID } from './multiChartLayout';

import type { ITradingViewNativeMultiChartProps } from './TradingViewNativeMultiChart.types';

// Split view is a web, extension and desktop feature. iOS and Android keep the
// single chart and ignore any layout saved by another platform.
export function TradingViewNativeMultiChart({
  activeSource,
  renderPanel,
}: ITradingViewNativeMultiChartProps) {
  return renderPanel({
    id: TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID,
    index: 0,
    isMain: true,
    isActive: true,
    isSplit: false,
    isSymbolSynced: false,
    source: activeSource,
    layoutControl: null,
  });
}
