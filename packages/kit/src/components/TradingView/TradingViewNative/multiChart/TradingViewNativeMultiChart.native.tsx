import { TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID } from './multiChartLayout';

import type { ITradingViewNativeMultiChartProps } from './TradingViewNativeMultiChart.types';

function ignoreSourceChange() {}

// Split view is a web, extension and desktop feature. iOS and Android keep the
// single chart and ignore any layout saved by another platform.
export function TradingViewNativeMultiChart({
  mainSource,
  renderPanel,
}: ITradingViewNativeMultiChartProps) {
  return renderPanel({
    id: TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID,
    index: 0,
    isMain: true,
    isSplit: false,
    isSymbolSynced: false,
    source: mainSource,
    layoutControl: null,
    setSource: ignoreSourceChange,
  });
}
