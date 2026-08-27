import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useTradingViewUrl } from '../components/TradingView/hooks/useTradingViewUrl';
import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { useThemeVariant } from '../hooks/useThemeVariant';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

async function runImmediatePreload(
  name: string,
  preload: () => Promise<unknown>,
) {
  try {
    await preload();
  } catch (error) {
    defaultLogger.app.error.log(
      `[TradingViewEmbedPreload] ${name} failed: ${String(error)}`,
    );
  }
}

export function TradingViewEmbedGlobalPreloadRuntime() {
  const theme = useThemeVariant();
  const { baseUrl, finalUrl } = useTradingViewUrl({ theme });

  useEffect(() => {
    let isLocalRuntime = false;
    try {
      isLocalRuntime = LOCAL_HOSTNAMES.has(new URL(baseUrl).hostname);
    } catch (error) {
      defaultLogger.app.error.log(
        `[TradingViewEmbedPreload] Invalid runtime URL: ${String(error)}`,
      );
    }
    const immediatePreloads = [
      runImmediatePreload('LegacyTradingViewStorageMigration', () =>
        migrateLegacyTradingViewStorage(finalUrl),
      ),
      runImmediatePreload('TradingViewEmbedModule', () =>
        loadTradingViewEmbedModule(finalUrl),
      ),
      runImmediatePreload('MarketTradingView', preloadMarketTradingView),
      ...(isLocalRuntime
        ? [
            runImmediatePreload('TradingViewEmbedBootstrapAssets', () =>
              preloadTradingViewEmbedBootstrapAssets(finalUrl),
            ),
          ]
        : []),
    ];

    void Promise.all(immediatePreloads);
  }, [baseUrl, finalUrl]);

  return null;
}
