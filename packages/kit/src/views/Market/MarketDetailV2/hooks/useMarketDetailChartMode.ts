import { useCallback } from 'react';

import { useMarketDetailChartModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * Remembers the chart picked on any market detail page, native or
 * TradingView, so leaving the page or restarting the app keeps it.
 */
export function useMarketDetailChartMode() {
  const [{ chartMode }, setChartModePreference] =
    useMarketDetailChartModePersistAtom();

  const toggleChartMode = useCallback(() => {
    void setChartModePreference((current) => ({
      ...current,
      chartMode: current.chartMode === 'native' ? 'tradingView' : 'native',
    }));
  }, [setChartModePreference]);

  return { isTradingViewNative: chartMode === 'native', toggleChartMode };
}
