import { useCallback } from 'react';

import { useNavigation as useReactNavigation } from '@react-navigation/native';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

export function useMarketDetailBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useReactNavigation();

  const handleBackPress = useCallback(() => {
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

    // Otherwise, navigate directly to Market home
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.TabMarket,
      },
    });
  }, [navigation, reactNavigation]);

  return { handleBackPress };
}
