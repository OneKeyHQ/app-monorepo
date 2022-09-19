import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import {
  CommonActions,
  DrawerActions,
  TabActions,
} from '@react-navigation/native';

import { ModalRoutes, RootRoutes, TabRoutes } from '../routes/types';
import { ManageNetworkRoutes } from '../views/ManageNetworks/types';

import { getAppNavigation } from './useAppNavigation';

export function useNavigationActions() {
  const navigation = useNavigation();

  const openAccountSelector = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageNetwork,
      params: {
        screen: ManageNetworkRoutes.NetworkAccountSelector,
      },
    });
  }, [navigation]);

  const closeDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.closeDrawer());
  }, [navigation]);

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const resetToRoot = useCallback(() => {
    /** next frame */
    setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: RootRoutes.Root }],
        }),
      );
    });
  }, [navigation]);

  const openRootHome = useCallback(() => {
    const root = getAppNavigation()
      .getRootState()
      .routes.find((route) => route.name === 'root');

    if (root) {
      const inst = navigation.getParent() || navigation;
      inst.goBack();
      // @ts-expect-error
      navigation.navigate(TabRoutes.Home);
      navigation.dispatch(TabActions.jumpTo(TabRoutes.Home, {}));
      return;
    }

    resetToRoot();
  }, [navigation, resetToRoot]);

  const resetToWelcome = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: RootRoutes.Onboarding }],
      }),
    );
  }, [navigation]);
  return useMemo(
    () => ({
      closeDrawer,
      openDrawer,
      resetToRoot,
      resetToWelcome,
      openRootHome,
      openAccountSelector,
    }),
    [
      openAccountSelector,
      closeDrawer,
      openDrawer,
      resetToRoot,
      resetToWelcome,
      openRootHome,
    ],
  );
}
