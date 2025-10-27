import { useEffect } from 'react';

import { useRoute } from '@react-navigation/native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Hook to track market page entry analytics
 * Records different entry ways: from route params, direct link, or others
 */
export function useMarketEnterAnalytics(): void {
  const route = useRoute();

  useEffect(() => {
    const routeParams = route.params as { from?: EEnterWay } | undefined;

    if (routeParams?.from) {
      // Entry from route params (e.g., from tab, search)
      defaultLogger.dex.enter.dexEnter({
        enterWay: routeParams.from,
      });
    } else if (platformEnv.isWeb && route?.path?.includes?.('/market')) {
      // Direct link entry on web platform
      defaultLogger.dex.enter.dexEnter({
        enterWay: EEnterWay.Link,
      });
    } else {
      // Other entry methods
      defaultLogger.dex.enter.dexEnter({
        enterWay: EEnterWay.Others,
      });
    }
  }, [route.params, route.path]);
}
