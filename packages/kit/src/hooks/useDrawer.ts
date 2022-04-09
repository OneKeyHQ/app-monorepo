import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { DrawerActions } from '@react-navigation/native';

export function useDrawer() {
  const navigation = useNavigation();
  const closeDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.closeDrawer());
  }, [navigation]);
  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);
  return { closeDrawer, openDrawer };
}
