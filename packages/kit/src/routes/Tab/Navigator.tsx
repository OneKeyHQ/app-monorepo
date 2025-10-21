import { useContext, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { noop } from 'lodash';

import {
  EPortalContainerConstantName,
  Portal,
  Stack,
  TabStackNavigator,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import { Footer } from '../../components/Footer';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';
import { TabFreezeOnBlurContext } from '../../provider/Container/TabFreezeOnBlurContainer';
import { whenAppUnlocked } from '../../utils/passwordUtils';

import { tabExtraConfig, useTabRouterConfig } from './router';

import type { NavigationProp } from '@react-navigation/native';

// prevent pushModal from using unreleased Navigation instances during iOS modal animation by temporary exclusion,
const useIsIOSTabNavigatorFocused =
  platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad
    ? () => {
        const isFocused = useRouteIsFocused();
        return isFocused;
      }
    : () => true;

const preloadTab = (
  navigation: NavigationProp<any>,
  route: string,
  screen: string,
  timeout: number,
) => {
  setTimeout(() => {
    navigation.preload(ERootRoutes.Main, {
      screen: route,
      params: {
        screen,
      },
    });
  }, timeout);
};

const preloadTabs = (navigation: NavigationProp<any>) => {
  let timeout = 100;
  const gap = 150;
  preloadTab(
    navigation,
    ETabRoutes.Market,
    ETabMarketRoutes.TabMarket,
    timeout,
  );
  preloadTab(
    navigation,
    ETabRoutes.Earn,
    ETabEarnRoutes.EarnHome,
    (timeout += gap),
  );
  preloadTab(
    navigation,
    ETabRoutes.Swap,
    ETabSwapRoutes.TabSwap,
    (timeout += gap),
  );
  preloadTab(navigation, ETabRoutes.Perp, ETabRoutes.Perp, (timeout += gap));
  preloadTab(
    navigation,
    ETabRoutes.Discovery,
    ETabDiscoveryRoutes.TabDiscovery,
    (timeout += gap),
  );
  preloadTab(
    navigation,
    ETabRoutes.Home,
    ETabHomeRoutes.TabHome,
    (timeout += 2500),
  );
};

const usePreloadTabs =
  platformEnv.isDev || platformEnv.isNative
    ? () => {}
    : () => {
        const navigation = useNavigation();
        useEffect(() => {
          setTimeout(async () => {
            await Promise.race([
              new Promise<void>((resolve) => setTimeout(resolve, 1200)),
              whenAppUnlocked(),
            ]);
            preloadTabs(navigation as NavigationProp<any>);
          });
        }, [navigation]);
      };

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;
  const isFocused = useIsIOSTabNavigatorFocused();
  const { gtMd } = useMedia();

  usePreloadTabs();

  return (
    <>
      <TabStackNavigator<ETabRoutes>
        config={config}
        extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
      />
      {platformEnv.isWeb && gtMd ? <Footer /> : null}
      <Portal.Container
        name={EPortalContainerConstantName.IN_PAGE_TAB_CONTAINER}
      />
      {!isFocused ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          onPress={noop}
        />
      ) : null}
    </>
  );
}
