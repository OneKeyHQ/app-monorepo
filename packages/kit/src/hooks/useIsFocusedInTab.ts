import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import useNavigation from './useNavigation';

import type { TabRoutes } from '../routes/routesEnum';

export const useIsFocusedInTab = (tabName: TabRoutes) => {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  return useMemo(() => {
    let $isFocused = isFocused;
    if (!isFocused) {
      // getFocusedRouteNameFromRoute(route)
      let tabNav = navigation;
      if (tabNav.getState().type !== 'tab') {
        tabNav = navigation.getParent();
      }
      const { routeNames, index: navIndex } = tabNav.getState();
      $isFocused = (routeNames[navIndex] as string) === tabName;
    }
    return $isFocused;
  }, [isFocused, navigation, tabName]);
};
