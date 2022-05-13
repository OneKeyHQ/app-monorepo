import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { CommonActions, DrawerActions } from '@react-navigation/native';

import { RootRoutes } from '../routes/types';

export function useNavigationActions() {
  const navigation = useNavigation();

  const closeDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.closeDrawer());
  }, [navigation]);

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const resetToRoot = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: RootRoutes.Root }],
      }),
    );
  }, [navigation]);

  const resetToWelcome = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: RootRoutes.Welcome }],
      }),
    );
  }, [navigation]);
  return useMemo(
    () => ({ closeDrawer, openDrawer, resetToRoot, resetToWelcome }),
    [closeDrawer, openDrawer, resetToRoot, resetToWelcome],
  );
}
