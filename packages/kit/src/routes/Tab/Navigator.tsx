import { useContext, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { noop } from 'lodash';

import type { ITabNavigatorConfig } from '@onekeyhq/components';
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
  route: string | undefined,
  screen: string | undefined,
  timeout: number,
) => {
  setTimeout(() => {
    if (route && screen) {
      navigation.preload(ERootRoutes.Main, {
        screen: route,
        params: {
          screen,
        },
      });
    } else {
      navigation.preload(ERootRoutes.Main);
    }
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
    (timeout += gap),
  );
  preloadTab(navigation, undefined, undefined, (timeout += gap));
};

let runOnce = false;
const usePreloadTabs =
  platformEnv.isDev || platformEnv.isNative
    ? () => {}
    : () => {
        const navigation = useNavigation();
        useEffect(() => {
          if (runOnce) {
            return;
          }
          runOnce = true;
          setTimeout(async () => {
            await Promise.race([
              new Promise<void>((resolve) => setTimeout(resolve, 1200)),
              whenAppUnlocked(),
            ]);
            preloadTabs(navigation as NavigationProp<any>);
          });
        }, [navigation]);
      };

// When using navigation.preload, the web layer will re-render the interface with sidebar,
// which may cause duplicate Portal rendering. Use isRendered to prevent duplicate Portal rendering.
let isRendered = false;
function InPageTabContainer() {
  const isRenderedRef = useRef(isRendered);
  if (isRenderedRef.current) {
    return null;
  }
  isRendered = true;
  return (
    <Portal.Container
      name={EPortalContainerConstantName.IN_PAGE_TAB_CONTAINER}
    />
  );
}

const useCheckTabsChangedInDev = platformEnv.isDev
  ? (config: ITabNavigatorConfig<ETabRoutes>[]) => {
      const previousConfig = useRef(config.map((item) => item.name));
      useEffect(() => {
        const keys = config.map((item) => item.name);
        if (
          keys.length !== previousConfig.current.length ||
          keys.every((item) => !previousConfig.current.includes(item))
        ) {
          // @react-navigation/core/src/useNavigationBuilder.tsx 532L
          // eslint-disable-next-line no-restricted-syntax
          throw new Error(
            'tabs changed, please check the config. This may cause infinite rendering loops in react navigation tab navigator',
          );
        }
        previousConfig.current = keys;
      }, [config]);
    }
  : () => {};

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;
  const isFocused = useIsIOSTabNavigatorFocused();
  const { gtMd } = useMedia();

  useCheckTabsChangedInDev(config);
  usePreloadTabs();

  return (
    <>
      <TabStackNavigator<ETabRoutes>
        config={config}
        extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
      />
      {platformEnv.isWebDappMode && gtMd ? <Footer /> : null}
      <InPageTabContainer />
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
