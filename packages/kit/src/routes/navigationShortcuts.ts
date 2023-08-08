import { useCallback, useMemo } from 'react';

import {
  CommonActions,
  DrawerActions,
  TabActions,
} from '@react-navigation/native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../hooks';
import { getAppNavigation } from '../hooks/useAppNavigation';
import reducerAccountSelector, {
  EAccountSelectorMode,
} from '../store/reducers/reducerAccountSelector';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { selectIsDesktopWalletSelectorVisible } from '../store/selectors';

import {
  HomeRoutes,
  MainRoutes,
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
  TabRoutes,
} from './routesEnum';
import { buildAppRootTabName } from './routesUtils';

const { updateDesktopWalletSelectorVisible, updateAccountSelectorMode } =
  reducerAccountSelector.actions;

/*

window.$$navigationShortcuts.navigateToTokenDetail({
  accountId:"hd-1--m/44'/60'/0'/0/0",
  networkId: 'evm--56',
  tokenId: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
});

 */

function navigateToTokenDetail({
  accountId,
  networkId,
  tokenId,
  walletId,
}: {
  accountId: string;
  networkId: string;
  tokenId: string; // tokenIdOnNetwork
  walletId: string;
}) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Home,
      params: {
        screen: HomeRoutes.ScreenTokenDetail,
        params: {
          walletId,
          accountId,
          networkId,
          tokenAddress: tokenId,
        },
      },
    },
  });
}

function navigateToMarketDetail({ marketTokenId }: { marketTokenId: string }) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Market,
      params: {
        screen: HomeRoutes.MarketDetail,
        params: {
          marketTokenId,
        },
      },
    },
  });
}

function navigateToAppRootTab(tabName: TabRoutes) {
  const navigation = getAppNavigation();
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: tabName,
      params: {
        screen: buildAppRootTabName(tabName) as any,
      },
    },
  });
}

function navigateToHome() {
  navigateToAppRootTab(TabRoutes.Home);
}

function navigateToSwap() {
  navigateToAppRootTab(TabRoutes.Swap);
}

function navigateToMarket() {
  navigateToAppRootTab(TabRoutes.Market);
}

function navigateToNFT() {
  navigateToAppRootTab(TabRoutes.NFT);
}

function navigateToDiscover() {
  navigateToAppRootTab(TabRoutes.Discover);
}

function navigateToMe() {
  navigateToAppRootTab(TabRoutes.Me);
}

function navigateToDeveloper() {
  navigateToAppRootTab(TabRoutes.Developer);
}

// TODO background check, not allowed in background
export const navigationShortcuts = {
  navigateToAppRootTab,
  navigateToHome,
  navigateToDiscover,
  navigateToMarket,
  navigateToSwap,
  navigateToDeveloper,
  navigateToNFT,
  navigateToMe,
  navigateToTokenDetail,
  navigateToMarketDetail,
};

export function useNavigationActions() {
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const isDesktopWalletSelectorVisible = useAppSelector(
    selectIsDesktopWalletSelectorVisible,
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
      allowSelectAllNetworks,
    }: {
      mode?: EAccountSelectorMode;
      networkImpl?: string;
      allowSelectAllNetworks?: boolean;
    }) => {
      dispatch(updateAccountSelectorMode(mode || EAccountSelectorMode.Wallet));
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageNetwork,
        params: {
          screen: ManageNetworkModalRoutes.NetworkSelector,
          params: {
            networkImpl,
            allowSelectAllNetworks,
          },
        },
      });
    },
    [dispatch, navigation],
  );

  const openDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const closeDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.closeDrawer());
  }, [navigation]);

  const closeWalletSelector = useCallback(() => {
    if (isVertical) {
      closeDrawer();
    } else {
      dispatch(updateDesktopWalletSelectorVisible(false));
    }
  }, [closeDrawer, dispatch, isVertical]);

  const openWalletSelector = useCallback(() => {
    if (isVertical) {
      openDrawer();
    } else {
      dispatch(updateDesktopWalletSelectorVisible(true));
    }
  }, [dispatch, isVertical, openDrawer]);

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
        OnekeyNetwork.bch,
        OnekeyNetwork.lightning,
        OnekeyNetwork.tlightning,
        OnekeyNetwork.tbtc,
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
      navigationShortcuts,
      closeWalletSelector,
      openWalletSelector,
      toggleWalletSelector,
      resetToRoot,
      resetToWelcome,
      openRootHome,
      openAccountSelector,
      openNetworkSelector,
      sendToken,
      openDrawer,
      closeDrawer,
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
      openDrawer,
      closeDrawer,
    ],
  );
}

if (process.env.NODE_ENV !== 'production') {
  global.$$navigationShortcuts = navigationShortcuts;
}
