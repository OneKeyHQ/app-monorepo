import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useTradingViewUrl } from '../components/TradingView/hooks/useTradingViewUrl';
import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { useThemeVariant } from '../hooks/useThemeVariant';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

const loadMarketTradingViewPreloadRuntime = () =>
  import(
    /* webpackChunkName: "market-detail-v2-tradingview" */ '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView'
  );

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
    const preloadEmbedRuntime = async () => {
      await Promise.all([
        runImmediatePreload('LegacyTradingViewStorageMigration', () =>
          migrateLegacyTradingViewStorage(finalUrl),
        ),
        runImmediatePreload('TradingViewEmbedModule', () =>
          loadTradingViewEmbedModule(finalUrl),
        ),
        ...(isLocalRuntime
          ? [
              runImmediatePreload('TradingViewEmbedBootstrapAssets', () =>
                preloadTradingViewEmbedBootstrapAssets(finalUrl),
              ),
            ]
          : []),
      ]);
    };

    void Promise.all([
      runImmediatePreload('TradingViewEmbedRuntime', preloadEmbedRuntime),
      runImmediatePreload('MarketTradingView', async () => {
        const { preloadMarketTradingView } =
          await loadMarketTradingViewPreloadRuntime();
        await preloadMarketTradingView();
      }),
    ]);
  }, [baseUrl, finalUrl]);

  return null;
}
