import { useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/native';
import { debounce } from 'lodash';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Hook to track market page entry analytics
 * Records different entry ways: from route params, direct link, or others
 */
export function useMarketEnterAnalytics(params?: {
  isLazyLoad?: boolean;
}): void {
  const route = useRoute();
  const { isLazyLoad = false } = params ?? {};
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isLazyLoad && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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
  }, [isLazyLoad, route.params, route?.path]);
}

export function useMarketHomePageEnterAnalytics() {
  useEffect(() => {
    const listener = debounce((payload: { from: EEnterWay }) => {
      defaultLogger.dex.enter.dexEnter({
        enterWay: payload.from,
      });
    }, 50);
    appEventBus.on(EAppEventBusNames.MarketHomePageEnter, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.MarketHomePageEnter, listener);
    };
  }, []);
  useMarketEnterAnalytics({ isLazyLoad: true });
}
