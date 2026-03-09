import { type NavigationState, StackActions } from '@react-navigation/native';

import { rootNavigationRef, switchTab } from '@onekeyhq/components';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

const NetworkNameToIdMap: Record<string, string> = {
  ethereum: getNetworkIdsMap().eth,
  btc: getNetworkIdsMap().btc,
  sui: getNetworkIdsMap().sui,
  solana: getNetworkIdsMap().sol,
  aptos: getNetworkIdsMap().apt,
  cosmos: getNetworkIdsMap().cosmoshub,
  sbtc: getNetworkIdsMap().sbtc,
  bsc: getNetworkIdsMap().bsc,
  base: getNetworkIdsMap().base,
};

const NetworkIdToNameMap: Record<string, string> = Object.fromEntries(
  Object.entries(NetworkNameToIdMap).map(([name, id]) => [id, name]),
);

export const EarnNetworkUtils = {
  // convert network name to network id
  getNetworkIdByName(networkName: string): string | undefined {
    return NetworkNameToIdMap[networkName.toLowerCase()];
  },

  // convert network id to network name
  getNetworkNameById(networkId: string): string | undefined {
    return NetworkIdToNameMap[networkId];
  },

  // generate share link network param
  getShareNetworkParam(networkId: string): string {
    return this.getNetworkNameById(networkId) || 'unknown';
  },
};

export async function safePushToEarnRoute(
  navigation: IAppNavigation,
  route: ETabEarnRoutes,
  params?: any,
) {
  const shouldSwitchToEarnMode =
    route === ETabEarnRoutes.EarnHome ||
    route === ETabEarnRoutes.EarnProtocols ||
    route === ETabEarnRoutes.EarnProtocolDetails ||
    route === ETabEarnRoutes.EarnProtocolDetailsShare;
  if (shouldSwitchToEarnMode) {
    appEventBus.emit(EAppEventBusNames.SwitchEarnMode, { mode: 'earn' });
  }

  const targetTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Earn;

  const rootNavigation = rootNavigationRef.current;
  const findTargetStack = (state?: NavigationState) => {
    if (!state) return undefined;
    // Find tab navigator state under Main
    const mainRoute = state.routes.find(
      (item) => item.name === ERootRoutes.Main,
    );
    const mainState = (mainRoute as { state?: NavigationState })?.state;
    if (!mainState) return undefined;

    // Find the target tab route
    const tabRoute = mainState.routes.find((item) => item.name === targetTab);
    if (!tabRoute) return undefined;

    // Stack navigator inside the tab
    const tabState = (tabRoute as { state?: NavigationState })?.state;
    // Prefer inner stack key; fall back to tab route key
    const targetKey = tabState?.key ?? tabRoute.key;
    return { targetKey, tabState };
  };

  if (platformEnv.isNative) {
    void timerUtils.wait(150).then(() => {
      appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
        tab: ETranslations.global_earn,
      });
    });

    // EarnHome is not registered in the Discovery tab's stack navigator on
    // native, so navigating to it would fail. Switching to the Earn sub-tab
    // via the event above is sufficient to show the Earn home view.
    if (route === ETabEarnRoutes.EarnHome) {
      navigation.switchTab(targetTab);
      return;
    }

    // Pre-query the Discovery tab's stack state. All tab states are available
    // since lazy: false, so this works before any tab switch.
    const preQueryState = rootNavigation
      ? findTargetStack(rootNavigation.getRootState?.())
      : undefined;
    const targetKey = preQueryState?.targetKey;

    if (rootNavigation && targetKey) {
      // Push the route onto the Discovery stack BEFORE switching tabs.
      // StackActions.push with target dispatches directly to the child stack
      // navigator without updating the tab navigator's selectedPage. By
      // pushing first and switching tab after, the two state changes are
      // separated: the push updates only the Discovery stack, then switchTab
      // updates only the tab selection. This avoids the iOS Release issue
      // where simultaneous selectedPage + children changes caused the native
      // tab bar to drop the selectedPage update.
      const { tabState } = preQueryState;
      const topRoute = tabState?.routes?.[tabState.index || 0];
      if (topRoute?.name === route) {
        const action = StackActions.replace(route, params);
        // @ts-expect-error target is added at runtime for navigator selection
        action.target = targetKey;
        rootNavigation.dispatch(action);
      } else {
        const action = StackActions.push(route, params);
        // @ts-expect-error target is added at runtime for navigator selection
        action.target = targetKey;
        rootNavigation.dispatch(action);
      }
      navigation.switchTab(targetTab);
    } else {
      navigation.switchTab(targetTab);
      (rootNavigation ?? navigation).navigate(ERootRoutes.Main, {
        screen: targetTab,
        params: {
          screen: route,
          params,
        },
      });
    }
    return;
  }

  navigation.switchTab(targetTab);

  await timerUtils.wait(0);

  if (!rootNavigation) {
    navigation.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: route,
        params,
      },
    });
    return;
  }

  const targetStack = findTargetStack(rootNavigation.getRootState?.());
  const targetKey = targetStack?.targetKey;
  const tabState = targetStack?.tabState;
  const topRoute = tabState?.routes?.[tabState.index || 0];

  if (targetKey) {
    if (topRoute?.name === route) {
      const action = StackActions.replace(route, params);
      // @ts-expect-error target is added at runtime for navigator selection
      action.target = targetKey;
      rootNavigation.dispatch(action);
      return;
    }

    const action = StackActions.push(route, params);
    // @ts-expect-error target is added at runtime for navigator selection
    action.target = targetKey;
    rootNavigation.dispatch(action);
  } else {
    // Fallback: navigate as before (may reuse route)
    rootNavigation.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: route,
        params,
      },
    });
  }
}

export const EarnNavigation = {
  // navigate from deep link (compatible with old format)
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      networkId,
      symbol,
      provider,
      vault,
    }: {
      networkId: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    await safePushToEarnRoute(navigation, ETabEarnRoutes.EarnProtocolDetails, {
      networkId,
      symbol,
      provider,
      vault,
    });
  },

  /**
   * @deprecated
   * @description: Will be removed
   */
  generateShareLink({
    networkId,
    symbol,
    provider,
    vault,
    isDevMode = false,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    isDevMode?: boolean;
  }): string {
    let origin = WEB_APP_URL;
    if (platformEnv.isWeb) {
      origin = globalThis.location.origin;
    }
    if (!platformEnv.isWeb && isDevMode) {
      origin = WEB_APP_URL_DEV;
    }

    const networkName = EarnNetworkUtils.getShareNetworkParam(networkId);
    const baseUrl = `/defi/${networkName}/${symbol.toLowerCase()}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    if (vault) {
      queryParams.append('vault', vault);
    }

    const queryString = queryParams.toString();
    return queryString
      ? `${origin}${baseUrl}?${queryString}`
      : `${origin}${baseUrl}`;
  },

  // generate earn share link (for EarnProtocolDetails page)
  generateEarnShareLink({
    networkId,
    symbol,
    provider,
    vault,
    isDevMode = false,
  }: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
    isDevMode?: boolean;
  }): string {
    let origin = WEB_APP_URL;
    if (platformEnv.isWeb) {
      origin = globalThis.location.origin;
    }
    if (!platformEnv.isWeb && isDevMode) {
      origin = WEB_APP_URL_DEV;
    }

    const networkName = EarnNetworkUtils.getShareNetworkParam(networkId);
    // Keep original symbol casing for unknown tokens (e.g. Pendle PT-sUSDe-29MAY2025);
    // normalizeToEarnSymbol handles known symbols on parse regardless of casing.
    const baseUrl = `/earn/${networkName}/${symbol}/${provider.toLowerCase()}`;
    const queryParams = new URLSearchParams();

    if (vault) {
      queryParams.append('vault', vault);
    }

    const queryString = queryParams.toString();
    return queryString
      ? `${origin}${baseUrl}?${queryString}`
      : `${origin}${baseUrl}`;
  },

  async popToEarnHome(
    navigation: IAppNavigation,
    params?: {
      tab?: 'assets' | 'portfolio' | 'faqs';
    },
  ) {
    if (platformEnv.isNative) {
      await navigation.popToMainRoute();
      switchTab(ETabRoutes.Discovery);
      appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
        tab: ETranslations.global_earn,
      });
      navigation.popToTop();
      appEventBus.emit(EAppEventBusNames.SwitchEarnMode, { mode: 'earn' });
      // Delay SwitchEarnTab to allow EarnMainTabs to mount and register
      // its listener after popToMainRoute triggers a re-render. Since we
      // already awaited popToMainRoute above, we are no longer in the
      // synchronous touch event context, so timers will flush normally.
      await timerUtils.wait(150);
      appEventBus.emit(EAppEventBusNames.SwitchEarnTab, {
        tab: params?.tab ?? 'assets',
      });
      return;
    }

    switchTab(ETabRoutes.Earn);
    await timerUtils.wait(50);
    navigation.popToTop();
    await timerUtils.wait(80);
    appEventBus.emit(EAppEventBusNames.SwitchEarnMode, { mode: 'earn' });
    appEventBus.emit(EAppEventBusNames.SwitchEarnTab, {
      tab: params?.tab ?? 'assets',
    });
    await timerUtils.wait(0);
  },

  pushToEarnProtocols(
    navigation: IAppNavigation,
    params: {
      symbol: string;
      filterNetworkId?: string;
      logoURI?: string;
      defaultCategory?: 'simpleEarn' | 'fixedRate';
    },
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnProtocols, params);
  },

  async pushToEarnProtocolDetails(
    navigation: IAppNavigation,
    params: {
      networkId: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnProtocolDetails, {
      networkId: params.networkId,
      symbol: params.symbol,
      provider: params.provider,
      vault: params.vault,
    });
  },

  pushToEarnProtocolDetailsShare(
    navigation: IAppNavigation,
    params: {
      network: string;
      symbol: string;
      provider: string;
      vault?: string;
    },
  ) {
    void safePushToEarnRoute(
      navigation,
      ETabEarnRoutes.EarnProtocolDetailsShare,
      params,
    );
  },
};
