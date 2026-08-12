import { useEffect } from 'react';

import { useTradingViewUrl } from '../components/TradingView/hooks/useTradingViewUrl';
import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

import { preloadTasksOnIdle } from './preloadComponents';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

export function TradingViewEmbedGlobalPreloadRuntime() {
  const { baseUrl, finalUrl } = useTradingViewUrl();

  useEffect(() => {
    const isLocalRuntime = LOCAL_HOSTNAMES.has(new URL(baseUrl).hostname);
    return preloadTasksOnIdle(
      [
        {
          name: 'TradingViewEmbedModule',
          preload: () =>
            Promise.all([
              loadTradingViewEmbedModule(finalUrl),
              migrateLegacyTradingViewStorage(finalUrl),
            ]),
        },
        {
          name: 'MarketTradingView',
          preload: preloadMarketTradingView,
        },
        ...(isLocalRuntime
          ? [
              {
                name: 'TradingViewEmbedBootstrapAssets',
                preload: () => preloadTradingViewEmbedBootstrapAssets(finalUrl),
              },
            ]
          : []),
      ],
      'TradingViewEmbedPreload',
    );
  }, [baseUrl, finalUrl]);

  return null;
}
