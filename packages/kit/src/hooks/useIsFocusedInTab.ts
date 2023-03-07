import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { isAtAppRootTab } from '../utils/routeUtils';

import type { TabRoutes } from '../routes/routesEnum';

export const useIsFocusedInTab = (tabName: TabRoutes) => {
  const isFocused = useIsFocused();
  return useMemo(() => {
    let $isFocused = isFocused;
    if (!isFocused) {
      $isFocused = isAtAppRootTab(tabName);
    }
    return $isFocused;
  }, [isFocused, tabName]);
};
