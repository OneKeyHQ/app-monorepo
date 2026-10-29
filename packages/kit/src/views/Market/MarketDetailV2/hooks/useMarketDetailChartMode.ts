import { useCallback, useRef, useState } from 'react';

import {
  type IMarketDetailChartModePersistAtom,
  marketDetailChartModePersistAtom,
  useMarketDetailChartModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

type IMarketDetailChartMode = IMarketDetailChartModePersistAtom['chartMode'];

/**
 * Remembers the chart picked on any market detail page, native or
 * TradingView, so leaving the page or restarting the app keeps it.
 */
export function useMarketDetailChartMode() {
  const [{ chartMode: savedChartMode }] = useMarketDetailChartModePersistAtom();
  // A switch shows at once and stays on this page even if saving it fails,
  // e.g. Travel Mode refuses the write. A newly saved value replaces it.
  const [pageChoice, setPageChoice] = useState<{
    chartMode: IMarketDetailChartMode;
    savedChartMode: IMarketDetailChartMode;
  }>();
  if (pageChoice && pageChoice.savedChartMode !== savedChartMode) {
    setPageChoice(undefined);
  }
  const chartMode =
    pageChoice?.savedChartMode === savedChartMode
      ? pageChoice.chartMode
      : savedChartMode;
  const latestRef = useRef({ chartMode, savedChartMode });
  latestRef.current = { chartMode, savedChartMode };

  const toggleChartMode = useCallback(() => {
    const latest = latestRef.current;
    const nextChartMode: IMarketDetailChartMode =
      latest.chartMode === 'native' ? 'tradingView' : 'native';
    latestRef.current = { ...latest, chartMode: nextChartMode };
    setPageChoice({
      chartMode: nextChartMode,
      savedChartMode: latest.savedChartMode,
    });
    const saveChartMode = async () => {
      try {
        await marketDetailChartModePersistAtom.set((current) => ({
          ...current,
          chartMode: nextChartMode,
        }));
      } catch (error) {
        defaultLogger.app.error.log(
          `Market detail chart mode save failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };
    void saveChartMode();
  }, []);

  return { isTradingViewNative: chartMode === 'native', toggleChartMode };
}
