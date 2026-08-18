import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getNativeMarketTradingViewWarmupGeneration,
  requestNativeMarketTradingViewWarmup,
} from '../../MarketDetailV2/components/NativePersistentMarketTradingView/nativeMarketTradingViewHostStore';
import { hydrateMarketTradingViewPreferences } from '../../MarketDetailV2/utils/marketTradingViewResolutionPreference';
import { getNativeMarketTradingViewPreloadPolicy } from '../../MarketDetailV2/utils/nativeMarketTradingViewPreloadPolicy';

export function NativeMarketTradingViewWarmup({
  enabled,
}: {
  enabled: boolean;
}) {
  useEffect(() => {
    const preloadPolicy = getNativeMarketTradingViewPreloadPolicy();
    if (!platformEnv.isNativeIOS || !enabled || !preloadPolicy.enabled) {
      return undefined;
    }

    let cancelled = false;
    const warmupGeneration = getNativeMarketTradingViewWarmupGeneration();
    const preferenceHydrationPromise = hydrateMarketTradingViewPreferences();
    const timer = setTimeout(() => {
      void preferenceHydrationPromise.then(() => {
        if (!cancelled) {
          requestNativeMarketTradingViewWarmup(warmupGeneration);
        }
      });
    }, preloadPolicy.delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  return null;
}
