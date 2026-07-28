import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MARKET_WEB_DEFERRED_FEATURES_DELAY_MS = 6000;

export function useMarketWebDeferredFeaturesReady(enabled = true) {
  const shouldDefer =
    platformEnv.isWeb && process.env.NODE_ENV === 'production' && enabled;
  const [ready, setReady] = useState(!shouldDefer);

  useEffect(() => {
    if (!shouldDefer) {
      setReady(true);
      return undefined;
    }

    setReady(false);
    const timer = setTimeout(
      () => setReady(true),
      MARKET_WEB_DEFERRED_FEATURES_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [shouldDefer]);

  return ready;
}
