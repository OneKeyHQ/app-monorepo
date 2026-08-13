import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useTradingViewUrl } from '../components/TradingView/hooks/useTradingViewUrl';
import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

import { preloadTasksOnIdle } from './preloadComponents';

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
  const { baseUrl, finalUrl } = useTradingViewUrl();

  useEffect(() => {
    let cancelled = false;
    let cleanupIdlePreload: (() => void) | undefined;
    const isLocalRuntime = LOCAL_HOSTNAMES.has(new URL(baseUrl).hostname);
    const immediatePreloads = [
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

    void Promise.all(immediatePreloads).then(() => {
      if (cancelled) {
        return;
      }
      cleanupIdlePreload = preloadTasksOnIdle(
        [
          {
            name: 'LegacyTradingViewStorageMigration',
            preload: () => migrateLegacyTradingViewStorage(finalUrl),
          },
        ],
        'TradingViewEmbedPreload',
      );
    });

    return () => {
      cancelled = true;
      cleanupIdlePreload?.();
    };
  }, [baseUrl, finalUrl]);

  return null;
}
