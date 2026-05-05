import { useCallback } from 'react';

import { useNavigation as useReactNavigation } from '@react-navigation/native';

import { useSplitSubView } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

export function useBulkSendBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useReactNavigation();
  const isTabletDetailView = useSplitSubView();

  const handleBackPress = useCallback(() => {
    if (isTabletDetailView) {
      navigation.pop();
      return;
    }

    const state = reactNavigation.getState();

    if (state && state.routes && state.index > 0) {
      const routes = state.routes;
      const currentIndex = state.index;
      const previousRoute = routes[currentIndex - 1];

      if (previousRoute?.name === ETabHomeRoutes.TabHome) {
        navigation.pop();
        return;
      }
    }

    navigation.pop();
  }, [reactNavigation, navigation, isTabletDetailView]);

  return { handleBackPress };
}
