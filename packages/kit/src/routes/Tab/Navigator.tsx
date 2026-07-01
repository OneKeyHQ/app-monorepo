import { useContext, useEffect, useMemo, useRef } from 'react';

import { CommonActions } from '@react-navigation/native';
import { noop } from 'lodash';

import type { ITabNavigatorConfig } from '@onekeyhq/components';
import {
  EPortalContainerConstantName,
  Portal,
  Stack,
  TabStackNavigator,
  rootNavigationRef,
  useIsSplitView,
  useMedia,
  useSplitMainView,
  useSplitSubView,
} from '@onekeyhq/components';
import { getDevicePerformanceTier } from '@onekeyhq/shared/src/performance/devicePerformanceTier';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { Footer } from '../../components/Footer';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';
import { BottomMenu } from '../../provider/Container/PortalBodyContainer/BottomMenu';
import { WebPageTabBar } from '../../provider/Container/PortalBodyContainer/WebPageTabBar';
import { TabFreezeOnBlurContext } from '../../provider/Container/TabFreezeOnBlurContainer';

import { defaultPreloadEntry, tabPreloadConfig } from './preloadConfig';
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
    const tier = getDevicePerformanceTier();

    const { queue: preloadQueue, intervalMs: PRELOAD_INTERVAL_MS } =
      tabPreloadConfig[tier] ?? defaultPreloadEntry;

    if (preloadQueue.length === 0) return;
    let index = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;
    let cancelled = false;

    // Space steps out by PRELOAD_INTERVAL_MS, then run each preload inside
    // requestIdleCallback (every step, not just the first).
    // NOTE: this only yields to a genuinely idle main thread on web/desktop,
    // where requestIdleCallback is the real Chromium API. On native it is the
    // setTimeout(..., 1ms) shim (see shared/src/polyfills/requestIdleCallbackShim),
    // which has no idle awareness; there each step is deferred and paced by the
    // interval timer, not gated on actual main-thread idleness.
    function scheduleNext() {
      timerId = setTimeout(() => {
        idleHandle = requestIdleCallback(preloadNext);
      }, PRELOAD_INTERVAL_MS);
    }

    function preloadNext() {
      if (cancelled || index >= preloadQueue.length) return;

      const rootState = rootNavigationRef.current?.getRootState();
      const mainRoute = rootState?.routes?.find(
        (r) => r.name === ERootRoutes.Main,
      );
      const tabStateKey = mainRoute?.state?.key;

      if (!tabStateKey) {
        scheduleNext();
        return;
      }

      try {
        rootNavigationRef.current?.dispatch({
          ...CommonActions.preload(preloadQueue[index]),
          target: tabStateKey,
        });
      } catch {
        // Tab might not exist in current config (e.g. perp disabled).
      }
      index += 1;
      scheduleNext();
    }

    idleHandle = requestIdleCallback(preloadNext);

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
      if (timerId !== undefined) clearTimeout(timerId);
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
