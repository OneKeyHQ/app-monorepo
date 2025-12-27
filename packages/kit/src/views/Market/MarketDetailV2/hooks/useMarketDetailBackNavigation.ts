import { useCallback } from 'react';

import {
  useNavigation as useReactNavigation,
  useRoute,
} from '@react-navigation/native';

import { Toast, useIsTabletDetailView } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

export function useMarketDetailBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useReactNavigation();
  const route = useRoute();
  const params = route.params as { from?: EEnterWay } | undefined;
  const isTabletDetailView = useIsTabletDetailView();

  const handleBackPress = useCallback(() => {
    // In tablet split view mode, always use pop for back navigation
    if (isTabletDetailView) {
      navigation.pop();
      return;
    }

    if (
      platformEnv.isNative &&
      (params?.from === EEnterWay.Search)
    ) {
      navigation.pop();
      navigation.switchTab(ETabRoutes.Discovery);
      return;
    }

    // Check if the previous route is Market home
    const state = reactNavigation.getState();

    if (state && state.routes && state.index > 0) {
      const routes = state.routes;
      const currentIndex = state.index;
      const previousRoute = routes[currentIndex - 1];

      // If previous route is Market home, use pop for smooth navigation
      if (previousRoute?.name === ETabMarketRoutes.TabMarket) {
        navigation.pop();
        return;
      }
    }

    navigation.pop();
  }, [params, reactNavigation, navigation, isTabletDetailView]);

  return { handleBackPress };
}
