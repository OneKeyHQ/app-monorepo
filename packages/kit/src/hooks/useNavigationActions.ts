import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import {
  CommonActions,
  DrawerActions,
  TabActions,
} from '@react-navigation/native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { ManageNetworkModalRoutes } from '../routes/routesEnum';
import { ModalRoutes, RootRoutes, TabRoutes } from '../routes/types';
import reducerAccountSelector, {
  EAccountSelectorMode,
} from '../store/reducers/reducerAccountSelector';
import { SendModalRoutes } from '../views/Send/types';

import { useAppSelector } from './redux';
import { getAppNavigation } from './useAppNavigation';

const { updateDesktopWalletSelectorVisible, updateAccountSelectorMode } =
  reducerAccountSelector.actions;
export function useNavigationActions() {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const { dispatch } = backgroundApiProxy;
  const isDesktopWalletSelectorVisible = useAppSelector(
    (s) => s.accountSelector.isDesktopWalletSelectorVisible,
  );
  const openAccountSelector = useCallback(
    ({ mode }: { mode?: EAccountSelectorMode }) => {
      dispatch(updateAccountSelectorMode(mode || EAccountSelectorMode.Wallet));
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageNetwork,
        params: {
          screen: ManageNetworkModalRoutes.NetworkAccountSelector,
        },
      });
    },
    [dispatch, navigation],
  );
  const openNetworkSelector = useCallback(
    ({
      mode,
      networkImpl,
    }: {
      mode?: EAccountSelectorMode;
      networkImpl?: string;
    }) => {
      dispatch(updateAccountSelectorMode(mode || EAccountSelectorMode.Wallet));
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageNetwork,
        params: {
          screen: ManageNetworkModalRoutes.NetworkSelector,
          params: {
            networkImpl,
          },
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
          routes: [{ name: RootRoutes.Main }],
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

  const sendToken = useCallback(
    ({ accountId, networkId }: { accountId: string; networkId: string }) => {
      const skipSelectTokenNetwork: string[] = [
        OnekeyNetwork.btc,
        OnekeyNetwork.doge,
        OnekeyNetwork.ltc,
      ];
      if (skipSelectTokenNetwork.includes(networkId)) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.PreSendAddress,
            params: {
              accountId,
              networkId,
              from: '',
              to: '',
              amount: '',
              token: '',
            },
          },
        });
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.PreSendToken,
            params: {
              accountId,
              networkId,
              from: '',
              to: '',
              amount: '',
            },
          },
        });
      }
    },
    [navigation],
  );

  return useMemo(
    () => ({
      closeWalletSelector,
      openWalletSelector,
      toggleWalletSelector,
      resetToRoot,
      resetToWelcome,
      openRootHome,
      openAccountSelector,
      openNetworkSelector,
      sendToken,
    }),
    [
      openAccountSelector,
      openNetworkSelector,
      closeWalletSelector,
      openWalletSelector,
      toggleWalletSelector,
      resetToRoot,
      resetToWelcome,
      openRootHome,
      sendToken,
    ],
  );
}
