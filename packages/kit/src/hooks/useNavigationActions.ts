import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import {
  CommonActions,
  DrawerActions,
  TabActions,
} from '@react-navigation/native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { ManageNetworkRoutes } from '../routes/routesEnum';
import { ModalRoutes, RootRoutes, TabRoutes } from '../routes/types';
import reducerAccountSelector, {
  EAccountSelectorMode,
} from '../store/reducers/reducerAccountSelector';

import { useAppSelector } from './redux';
import { getAppNavigation } from './useAppNavigation';

const { updateDesktopWalletSelectorVisible, updateAccountSelectorMode } =
  reducerAccountSelector.actions;
export function useNavigationActions() {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const { dispatch } = backgroundApiProxy;
  const { isDesktopWalletSelectorVisible } = useAppSelector(
    (s) => s.accountSelector,
  );
  const openAccountSelector = useCallback(
    ({ mode }: { mode?: EAccountSelectorMode }) => {
      dispatch(updateAccountSelectorMode(mode || EAccountSelectorMode.Wallet));
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageNetwork,
        params: {
          screen: ManageNetworkRoutes.NetworkAccountSelector,
        },
      });
    },
    [dispatch, navigation],
  );

  const closeWalletSelector = useCallback(() => {
    if (isVertical) {
      navigation.dispatch(DrawerActions.closeDrawer());
    } else {
      dispatch(updateDesktopWalletSelectorVisible(false));
    }
  }, [dispatch, isVertical, navigation]);

  const openWalletSelector = useCallback(() => {
    if (isVertical) {
      navigation.dispatch(DrawerActions.openDrawer());
    } else {
      dispatch(updateDesktopWalletSelectorVisible(true));
    }
  }, [dispatch, isVertical, navigation]);

  const toggleWalletSelector = useCallback(() => {
    setTimeout(() => {
      // TODO move to useNavigationActions
      if (isVertical) {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        navigation?.toggleDrawer?.();
      } else {
        const nextVisible = !isDesktopWalletSelectorVisible;
        dispatch(updateDesktopWalletSelectorVisible(nextVisible));
      }
    });
  }, [dispatch, isDesktopWalletSelectorVisible, isVertical, navigation]);

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
      // const inst = navigation.getParent() || navigation;
      // TODO why need goBack here? may recalling some logic when navigation back to previous route.
      // inst.goBack();

      // replace not working
      // navigation.dispatch(StackActions.replace(TabRoutes.Home));

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
      closeWalletSelector,
      openWalletSelector,
      toggleWalletSelector,
      resetToRoot,
      resetToWelcome,
      openRootHome,
      openAccountSelector,
    }),
    [
      openAccountSelector,
      closeWalletSelector,
      openWalletSelector,
      toggleWalletSelector,
      resetToRoot,
      resetToWelcome,
      openRootHome,
    ],
  );
}
