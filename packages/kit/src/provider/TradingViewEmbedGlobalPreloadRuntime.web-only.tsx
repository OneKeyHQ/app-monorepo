import { useEffect } from 'react';

import { useTradingViewUrl } from '../components/TradingView/hooks/useTradingViewUrl';
import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

const PRELOAD_IDLE_TIMEOUT_MS = 3000;

export function TradingViewEmbedGlobalPreloadRuntime() {
  const { baseUrl, finalUrl } = useTradingViewUrl();

  useEffect(() => {
    void preloadMarketTradingView().catch(() => undefined);

    const idleHandle = requestIdleCallback(
      () => {
        const preloadPromises: Promise<unknown>[] = [
          loadTradingViewEmbedModule(baseUrl),
        ];
        if (!navigator.serviceWorker?.controller) {
          preloadPromises.push(
            preloadTradingViewEmbedBootstrapAssets(finalUrl),
          );
        }
        void Promise.all(preloadPromises).catch(() => undefined);
      },
      { timeout: PRELOAD_IDLE_TIMEOUT_MS },
    );

    return () => {
      cancelIdleCallback(idleHandle);
    };
  }, [baseUrl, finalUrl]);

  return null;
}
