import { useContext, useEffect, useMemo, useRef } from 'react';

import { noop } from 'lodash';

import type { ITabNavigatorConfig } from '@onekeyhq/components';
import {
  EPortalContainerConstantName,
  Portal,
  Stack,
  TabStackNavigator,
  useIsSplitView,
  useMedia,
  useSplitMainView,
  useSplitSubView,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { Footer } from '../../components/Footer';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
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
  const isTabletMainView = useSplitMainView();
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
  const isLandscape = useIsSplitView();
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop;
  const isFocused = useIsIOSTabNavigatorFocused();
  const { gtMd } = useMedia();
  const isTabletDetailView = useSplitSubView();

  useGlobalShortcuts();
  useCheckTabsChangedInDev(config);

  // Progressively preload tabs during idle time, driven by device performance tier.
  // Tabs are lazy-loaded on all platforms; this ensures key tabs are
  // pre-rendered in the background before the user navigates to them.
  // IMPORTANT: Must use `target` to send the PRELOAD action directly to the
  // Tab Navigator. Without `target`, the action goes to the focused Stack first,
  // and StackRouter's PRELOAD handler blindly creates preloadedRoutes for
  // unknown route names, causing StackView to crash.
  // Also do NOT pass params — mismatched params cause TabRouter to regenerate
  // route keys via nanoid(), which unmounts/remounts screens.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { startTabPreload } = await import('./startTabPreload');
      if (!cancelled) {
        cleanup = startTabPreload();
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Calibrate performance tier after UI is visible (async, result used on next launch)
  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const { calibrateDevicePerformanceTier } =
          await import('@onekeyhq/shared/src/performance/devicePerformanceTier');
        await calibrateDevicePerformanceTier();
      })();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

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
