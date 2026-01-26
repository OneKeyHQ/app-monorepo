import { useContext, useEffect, useMemo, useRef } from 'react';

import { noop } from 'lodash';

import type { ITabNavigatorConfig } from '@onekeyhq/components';
import {
  EPortalContainerConstantName,
  Portal,
  Stack,
  TabStackNavigator,
  useIsTabletDetailView,
  useIsTabletMainView,
  useMedia,
  useOrientation,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { Footer } from '../../components/Footer';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';
import { BottomMenu } from '../../provider/Container/PortalBodyContainer/BottomMenu';
import { WebPageTabBar } from '../../provider/Container/PortalBodyContainer/WebPageTabBar';
import { TabFreezeOnBlurContext } from '../../provider/Container/TabFreezeOnBlurContainer';

import { tabExtraConfig, useTabRouterConfig } from './router';

// prevent pushModal from using unreleased Navigation instances during iOS modal animation by temporary exclusion,
const useIsIOSTabNavigatorFocused =
  platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad
    ? () => {
        const isFocused = useRouteIsFocused();
        return isFocused;
      }
    : () => true;

// When using navigation.preload, the web layer will re-render the interface with sidebar,
// which may cause duplicate Portal rendering. Use isRendered to prevent duplicate Portal rendering.
let isRendered = false;
function InPageTabContainer() {
  const isRenderedRef = useRef(isRendered);
  const isTabletMainView = useIsTabletMainView();
  if (isRenderedRef.current || isTabletMainView) {
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
          console.warn(
            'tabs changed, please check the config. This may cause infinite rendering loops in react navigation tab navigator',
          );
        }
        previousConfig.current = keys;
      }, [config]);
    }
  : () => {};

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const isLandscape = useOrientation();
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop;
  const isFocused = useIsIOSTabNavigatorFocused();
  const { gtMd } = useMedia();
  const isTabletDetailView = useIsTabletDetailView();

  useCheckTabsChangedInDev(config);

  return (
    <>
      <TabStackNavigator<ETabRoutes>
        config={config}
        extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
        showTabBar={!(isTabletDetailView && isLandscape)}
        bottomMenu={<BottomMenu />}
        webPageTabBar={<WebPageTabBar />}
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
