import { StackActions } from '@react-navigation/native';

import {
  navigateFromOverlayToTab,
  rootNavigationRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type IUrlAccountRouteBuildParams = {
  account: INetworkAccount | undefined;
  address: string | undefined;
  networkId: string | undefined;
};

const localStorageKey = '$onekeyPrevSelectedUrlAccount';

export function savePrevUrlAccount({
  address,
  networkId,
}: {
  address: string | undefined;
  networkId: string | undefined;
}) {
  if (!platformEnv.isWeb) {
    return;
  }
  if (address && networkId) {
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({ address, networkId }),
    );
  } else {
    localStorage.setItem(localStorageKey, '');
  }
}

export function getPrevUrlAccount() {
  try {
    if (!platformEnv.isWeb) {
      return;
    }
    const prevAccount = localStorage.getItem(localStorageKey);
    return prevAccount
      ? (JSON.parse(prevAccount) as {
          address: string;
          networkId: string;
        })
      : undefined;
  } catch (_error) {
    return undefined;
  }
}

async function buildUrlNetworkSegment({
  realNetworkId,
  realNetworkIdFallback,
  contextNetworkId,
}: {
  realNetworkId: string;
  realNetworkIdFallback: string;
  contextNetworkId: string;
}) {
  if (networkUtils.isAllNetwork({ networkId: realNetworkId })) {
    // eslint-disable-next-line no-param-reassign
    realNetworkId = realNetworkIdFallback;
  }

  const isAllNetworkContext = networkUtils.isAllNetwork({
    networkId: contextNetworkId,
  });

  if (isAllNetworkContext) {
    const isEvm = networkUtils.isEvmNetwork({ networkId: realNetworkId });
    if (isEvm) {
      return IMPL_EVM;
    }
  }

  const realNetwork = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
    networkId: realNetworkId,
  });
  return realNetwork?.code || realNetworkId || '';
}

// http://localhost:3000/wallet/account/evm--1/0xF907eBC4348b02F4b808Ec84591AAfD281c4422D
// export const urlAccountLandingRewrite = '/wallet/account/:address/:networkId?';
export const urlAccountLandingRewrite = '/url-account/:networkId/:address?'; // visible url
// export const urlAccountPageRewrite = '/url-account/:networkId/:address'; // hidden url
export async function buildUrlAccountLandingRoute({
  account,
  address,
  networkId,
  includingOrigin,
}: IUrlAccountRouteBuildParams & {
  includingOrigin?: boolean;
}) {
  const networkSegment = await buildUrlNetworkSegment({
    realNetworkId: networkId || '',
    realNetworkIdFallback: account?.createAtNetwork || '',
    contextNetworkId: networkId || '',
  });
  const path = `/url-account/${networkSegment || '--'}/${address || '--'}`;
  if (includingOrigin) {
    const origin =
      platformEnv.isWeb && !platformEnv.isDev
        ? globalThis.location.origin
        : WEB_APP_URL;
    return `${origin}${path}`;
  }
  return path;
}

export async function buildUrlAccountFullUrl({
  account,
  network,
}: {
  account: INetworkAccount;
  network: IServerNetwork;
}) {
  return buildUrlAccountLandingRoute({
    account,
    address: account.address,
    networkId: network.id,
    includingOrigin: true,
  });
}

export async function replaceUrlAccountLandingRoute({
  account,
  address,
  networkId,
}: IUrlAccountRouteBuildParams) {
  if (!platformEnv.isWeb) {
    return;
  }
  if (address && networkId) {
    const url = await buildUrlAccountLandingRoute({
      account,
      address,
      networkId,
    });
    globalThis.history.replaceState(null, '', url);
  } else {
    globalThis.history.replaceState(null, '', '/');
  }
  if (accountUtils.isUrlAccountFn({ accountId: account?.id })) {
    savePrevUrlAccount({ address, networkId });
  }
}

// Check if currently in URL account page
export function isCurrentlyInUrlAccountPage(): boolean {
  try {
    const state = rootNavigationRef.current?.getRootState();
    if (!state?.routes) return false;

    // Find the main tab route (first route should be Main)
    const mainRoute = state.routes.find(
      (route) => route.name === ERootRoutes.Main,
    );
    if (!mainRoute?.state?.routes) return false;

    // Find the Home tab route
    const homeTabIndex = mainRoute.state.routes.findIndex(
      (route) => route.name === ETabRoutes.Home,
    );
    if (homeTabIndex === -1) return false;

    const homeTabRoute = mainRoute.state.routes[homeTabIndex];
    if (!homeTabRoute?.state?.routes || mainRoute.state.index !== homeTabIndex)
      return false;

    // Check if current route in Home tab is URL account page
    const currentHomeRouteIndex = homeTabRoute.state.index || 0;
    const currentHomeRoute = homeTabRoute.state.routes[currentHomeRouteIndex];

    return currentHomeRoute?.name === ETabHomeRoutes.TabHomeUrlAccountPage;
  } catch (_error) {
    return false;
  }
}

export function getHomeTabStackLength(): number {
  try {
    const state = rootNavigationRef.current?.getRootState();
    if (!state?.routes) return 0;

    const mainRoute = state.routes.find(
      (route) => route.name === ERootRoutes.Main,
    );
    if (!mainRoute?.state?.routes) return 0;

    const homeTabRoute = mainRoute.state.routes.find(
      (route) => route.name === ETabRoutes.Home,
    );
    return homeTabRoute?.state?.routes?.length ?? 0;
  } catch (_error) {
    return 0;
  }
}

export const urlAccountNavigation = {
  pushHomePage(navigation: IAppNavigation) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      // StackActions.replace(ETabHomeRoutes.TabHome),
      StackActions.push(ETabHomeRoutes.TabHome),
    );
  },
  replaceHomePage(navigation: IAppNavigation, params?: object) {
    navigation.dispatch(
      // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
      StackActions.replace(ETabHomeRoutes.TabHome, params),
    );
  },
  async pushUrlAccountPage(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
      contextNetworkId?: string;
    },
  ) {
    const networkSegment = await buildUrlNetworkSegment({
      realNetworkId: params.networkId || '',
      realNetworkIdFallback: params.networkId || '',
      contextNetworkId: params.contextNetworkId || '',
    });
    // Use navigateFromOverlayToTab to atomically remove overlay routes
    // (FullScreenPush/ActionCenter) and switch tab. This avoids the native
    // UITabBarController window-nil race where RNSScreenStack retries
    // exhaust on stacks inside detached tab views.
    defaultLogger.app.router.switchTab(ETabRoutes.Home);
    await navigateFromOverlayToTab({
      targetTab: ETabRoutes.Home,
      switchTab: (tab) => navigation.switchTab(tab),
    });
    defaultLogger.app.router.switchTabDone(ETabRoutes.Home);
    const navState = rootNavigationRef.current?.getRootState();
    const focusedRoute = navState?.routes?.[navState?.index ?? 0];
    const mainRoute = focusedRoute?.state;
    const focusedTab = mainRoute?.routes?.[mainRoute?.index ?? 0];
    const tabStack = focusedTab?.state;
    defaultLogger.app.router.navState({
      action: 'pushUrlAccountPage:afterWait',
      focusedTab: focusedTab?.name,
      stackDepth: tabStack?.routes?.length,
      topRoute: tabStack?.routes?.[tabStack?.routes?.length - 1]?.name,
    });
    rootNavigationRef.current?.dispatch(
      StackActions.push(ETabHomeRoutes.TabHomeUrlAccountPage, {
        address: params.address,
        networkId: networkSegment,
      }),
    );
    const navStateAfter = rootNavigationRef.current?.getRootState();
    const focusedRouteAfter =
      navStateAfter?.routes?.[navStateAfter?.index ?? 0];
    const mainRouteAfter = focusedRouteAfter?.state;
    const focusedTabAfter =
      mainRouteAfter?.routes?.[mainRouteAfter?.index ?? 0];
    const tabStackAfter = focusedTabAfter?.state;
    defaultLogger.app.router.navState({
      action: 'pushUrlAccountPage:afterDispatch',
      focusedTab: focusedTabAfter?.name,
      stackDepth: tabStackAfter?.routes?.length,
      topRoute:
        tabStackAfter?.routes?.[tabStackAfter?.routes?.length - 1]?.name,
    });
  },
  async pushOrReplaceUrlAccountPage(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
      contextNetworkId?: string;
    },
  ) {
    const networkSegment = await buildUrlNetworkSegment({
      realNetworkId: params.networkId || '',
      realNetworkIdFallback: params.networkId || '',
      contextNetworkId: params.contextNetworkId || '',
    });
    // If not in URL account page, switch to Home tab and push
    defaultLogger.app.router.switchTab(ETabRoutes.Home);
    navigation.switchTab(ETabRoutes.Home);
    defaultLogger.app.router.switchTabDone(ETabRoutes.Home);
    rootNavigationRef.current?.navigate(ETabRoutes.Home, {
      screen: ETabHomeRoutes.TabHome,
    });
    await timerUtils.wait(100);
    defaultLogger.app.router.pushRoute({
      action: 'replaceUrlAccountPage',
      address: params.address,
      routeName: ETabHomeRoutes.TabHomeUrlAccountPage,
    });
    rootNavigationRef.current?.dispatch(
      StackActions.replace(ETabHomeRoutes.TabHomeUrlAccountPage, {
        address: params.address,
        networkId: networkSegment,
      }),
    );
  },
  pushUrlAccountPageLanding(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
    },
  ) {
    navigation.dispatch(
      StackActions.push(ETabHomeRoutes.TabHomeUrlAccountLanding, params),
    );
  },
  async pushUrlAccountPageFromDeeplink(
    navigation: IAppNavigation,
    params: {
      address: string | undefined;
      networkId: string | undefined;
    },
  ) {
    defaultLogger.app.router.pushRoute({
      action: 'deeplink:navigateToTabHome',
      address: params.address,
    });
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHome,
      },
    });
    await timerUtils.wait(100);
    defaultLogger.app.router.pushRoute({
      action: 'deeplink:navigateToUrlAccountPage',
      address: params.address,
      routeName: ETabHomeRoutes.TabHomeUrlAccountPage,
    });
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHomeUrlAccountPage,
        params,
      },
    });
  },
};
