import type { MutableRefObject, RefObject } from 'react';
import {
  createContext,
  createRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  CommonActions,
  DarkTheme,
  DefaultTheme,
  NavigationContainer as RNNavigationContainer,
} from '@react-navigation/native';
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';

import { useSplitMainView } from '@onekeyhq/components/src/hooks/useSplitView';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import { navigationIntegration } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  EFullScreenPushRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import mmkvStorageInstance from '@onekeyhq/shared/src/storage/instance/mmkvStorageInstance';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useSettingConfig } from '../../../hocs/Provider/hooks/useProviderValue';

import type { NavigationContainerRef } from '@react-navigation/native';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;

export const tabletMainViewNavigationRef =
  createRef<NavigationContainerRef<any>>();
export const rootNavigationRef = createRef<NavigationContainerRef<any>>();
// for background open modal
appGlobals.$navigationRef = rootNavigationRef as MutableRefObject<
  NavigationContainerRef<any>
>;
appGlobals.$tabletMainViewNavigationRef =
  tabletMainViewNavigationRef as MutableRefObject<NavigationContainerRef<any>>;

export type IRouterChangeEvent = INavigationContainerProps['onStateChange'];
const RouterEventContext = createContext<
  MutableRefObject<IRouterChangeEvent[]>
>({
  current: [],
});

export const useRouterEventsRef = () => useContext(RouterEventContext);
export const RouterEventProvider = RouterEventContext.Provider;

export const useOnRouterChange = (callback: IRouterChangeEvent) => {
  const routerRef = useContext(RouterEventContext);
  useEffect(() => {
    routerRef.current.push(callback);
    if (rootNavigationRef.current) {
      callback?.(rootNavigationRef.current?.getState());
    }
    return () => {
      routerRef.current = routerRef.current.filter((i) => i !== callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const useUpdateRootViewBackgroundColor = (
  color: string,
  themeVariant: 'light' | 'dark',
  themeSetting?: 'light' | 'dark' | 'system',
) => {
  useEffect(() => {
    updateRootViewBackgroundColor(color, themeVariant, themeSetting);
  }, [color, themeVariant, themeSetting]);
};

const useNativeDevTools =
  platformEnv.isNative && platformEnv.isDev
    ? ({ ref }: { ref: RefObject<NavigationContainerRef<any>> }) => {
        useReactNavigationDevTools({ ref });
        useNetworkActivityDevTools();
        useMMKVDevTools({
          storages: [mmkvStorageInstance],
        });
      }
    : () => {};

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  const isTabletMainView = useSplitMainView();
  const handleReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(
      isTabletMainView ? tabletMainViewNavigationRef : rootNavigationRef,
    );
  }, [isTabletMainView]);
  const { theme: themeName, themeSetting } = useSettingConfig();
  const theme = useTheme();

  useUpdateRootViewBackgroundColor(theme.bgApp.val, themeName, themeSetting);

  const themeOptions = useMemo(() => {
    return {
      fonts: DefaultTheme.fonts,
      dark: themeName === 'dark',
      colors: {
        ...(themeName === 'dark' ? DarkTheme : DefaultTheme).colors,
        background: theme.bgApp.val,
        card: theme.bgApp.val,
        border: theme.bgApp.val,
      },
    };
  }, [theme.bgApp.val, themeName]);

  useNativeDevTools({
    ref: rootNavigationRef as RefObject<NavigationContainerRef<any>>,
  });

  return (
    <RNNavigationContainer
      {...props}
      theme={themeOptions}
      ref={isTabletMainView ? tabletMainViewNavigationRef : rootNavigationRef}
      onReady={handleReady}
    />
  );
}

const getActiveTabFromRef = (
  ref: typeof rootNavigationRef,
): string | undefined => {
  const s = ref.current?.getRootState();
  if (!s) return undefined;
  const main = s.routes?.find((r) => r.name === ERootRoutes.Main);
  const idx = main?.state?.index ?? 0;
  return main?.state?.routes?.[idx]?.name;
};

const hasOverlayAboveMain = (ref: typeof rootNavigationRef): boolean => {
  const s = ref.current?.getRootState();
  if (!s) return false;
  const topRoute = s.routes?.[s.index ?? 0];
  return topRoute?.name !== ERootRoutes.Main;
};

export const switchTab = (route: ETabRoutes) => {
  // Skip per-ref navigate if already on the target tab to avoid unnecessary
  // navigate(pop:true) which triggers RNSScreenStack retry storms on iOS
  // when the tab's inner stack has pages that get popped and orphaned.
  // But if any overlay route is currently above Main, we still need one
  // navigate(pop:true) to refocus Main and avoid leaving overlay on top.
  const rootActiveTab = getActiveTabFromRef(rootNavigationRef);
  const rootHasOverlay = hasOverlayAboveMain(rootNavigationRef);

  defaultLogger.app.router.switchTab(route);

  setTimeout(() => {
    const tabletActiveTab = getActiveTabFromRef(tabletMainViewNavigationRef);
    const tabletHasOverlay = hasOverlayAboveMain(tabletMainViewNavigationRef);
    if (
      tabletActiveTab !== undefined &&
      (tabletHasOverlay || tabletActiveTab !== route)
    ) {
      tabletMainViewNavigationRef.current?.navigate(
        ERootRoutes.Main,
        {
          screen: route,
        },
        {
          pop: true,
        },
      );
    }
  });
  if (rootHasOverlay || rootActiveTab !== route) {
    rootNavigationRef.current?.navigate(
      ERootRoutes.Main,
      {
        screen: route,
      },
      {
        pop: true,
      },
    );
  }

  defaultLogger.app.router.switchTabDone(route);
};

export const popModalPages = async (maxRetryTimes = 10) => {
  if (maxRetryTimes <= 0) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  const currentRoute = rootState?.routes?.[rootState.index];
  if (currentRoute?.name !== ERootRoutes.Modal) {
    return;
  }
  const routeCountBefore = rootState?.routes?.length ?? 0;
  if (rootNavigationRef.current?.canGoBack?.()) {
    rootNavigationRef.current?.goBack();
  }
  await timerUtils.wait(350);
  const newState = rootNavigationRef.current?.getRootState();
  if ((newState?.routes?.length ?? 0) >= routeCountBefore) {
    return;
  }
  await popModalPages(maxRetryTimes - 1);
};

/**
 * Synchronously pop modal pages without delay for native platforms.
 * On native platforms with native bottom tabs, avoid deferring navigation
 * dispatch to a macrotask via timerUtils.wait(). Use goBack() directly
 * so the navigation stays within the touch event context, preventing iOS
 * from requiring an additional touch to flush the bridge call.
 */
export const popModalPagesOnNative = (maxRetryTimes = 10) => {
  if (maxRetryTimes <= 0) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  const currentRoute = rootState?.routes?.[rootState.index];
  if (currentRoute?.name !== ERootRoutes.Modal) {
    return;
  }
  if (rootNavigationRef.current?.canGoBack?.()) {
    rootNavigationRef.current?.goBack();
    popModalPagesOnNative(maxRetryTimes - 1);
  }
};

/**
 * Atomically remove all routes above the Main route (Modal, FullScreenPush, etc.)
 * using CommonActions.reset. No transition animation, but avoids the native
 * UITabBarController window-nil race condition where RNSScreenStack retries
 * exhaust when goBack() is called on a stack inside a detached tab view.
 *
 * Prefer this over sequential goBack() calls when you need to dismiss multiple
 * overlay routes and the intermediate animation is not important.
 */
export function resetAboveMainRoute() {
  const state = rootNavigationRef.current?.getRootState();
  if (!state) {
    return;
  }
  const mainRoutes = state.routes.filter(
    (route) => route.name === ERootRoutes.Main,
  );
  if (mainRoutes.length === 0 || mainRoutes.length === state.routes.length) {
    return;
  }
  rootNavigationRef.current?.dispatch(
    CommonActions.reset({
      ...state,
      routes: mainRoutes,
      index: mainRoutes.length - 1,
    }),
  );
}

/**
 * Atomically remove ScanQrCodeModal and ActionCenter (FullScreenPush) routes
 * from the navigation state via CommonActions.reset, preserving all other
 * routes (e.g. onboarding). This avoids the goBack() animated dismiss that
 * causes RNSScreenStack window=NIL and blocks Fabric commits on the
 * underlying page.
 */
export function resetScanModalRoute() {
  const state = rootNavigationRef.current?.getRootState();
  if (!state) {
    return;
  }
  const filteredRoutes = state.routes.filter((route) => {
    const screenName =
      (route.params as { screen?: string })?.screen ||
      route.state?.routes?.[route.state?.index || 0]?.name;
    // Remove ScanQrCodeModal routes
    if (
      route.name === ERootRoutes.Modal &&
      screenName === EModalRoutes.ScanQrCodeModal
    ) {
      return false;
    }
    // Remove ActionCenter routes only (not other FullScreenPush pages)
    if (
      route.name === ERootRoutes.FullScreenPush &&
      screenName === EFullScreenPushRoutes.ActionCenter
    ) {
      return false;
    }
    return true;
  });
  if (filteredRoutes.length === state.routes.length) {
    return;
  }
  rootNavigationRef.current?.dispatch(
    CommonActions.reset({
      ...state,
      routes: filteredRoutes,
      index: filteredRoutes.length - 1,
    }),
  );
}

export const popToMainRoute = async () => {
  resetAboveMainRoute();
  await timerUtils.wait(100);
};

function isScanModalCurrentRoute(): boolean {
  const rootState = rootNavigationRef.current?.getRootState();
  const currentRoute = rootState?.routes?.[rootState.index];
  if (currentRoute?.name !== ERootRoutes.Modal) {
    return false;
  }
  const screenName =
    (currentRoute?.params as { screen?: string })?.screen ||
    currentRoute?.state?.routes?.[currentRoute?.state?.index || 0]?.name;
  return screenName === EModalRoutes.ScanQrCodeModal;
}

/**
 * Resolves when the scan modal is no longer the current route (or after timeout).
 * Use after popScanModalPages() to proceed as soon as the stack has updated
 * instead of a fixed 350ms, so the next push can run earlier (OK-50182).
 */
export const waitForScanModalClosed = (options?: {
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<void> => {
  const pollIntervalMs = options?.pollIntervalMs ?? 50;
  const timeoutMs = options?.timeoutMs ?? 400;
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (!isScanModalCurrentRoute()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        resolve();
        return;
      }
      setTimeout(check, pollIntervalMs);
    };
    check();
  });
};

export const popScanModalPages = async (maxRetryTimes = 99) => {
  if (maxRetryTimes <= 0) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  const currentRoute = rootState?.routes?.[rootState.index];
  if (currentRoute?.name !== ERootRoutes.Modal) {
    return;
  }
  const screenName =
    (currentRoute?.params as { screen?: string })?.screen ||
    currentRoute?.state?.routes?.[currentRoute?.state?.index || 0]?.name;
  if (screenName !== EModalRoutes.ScanQrCodeModal) {
    return;
  }
  if (rootNavigationRef.current?.canGoBack?.()) {
    rootNavigationRef.current?.goBack();
  }
  await timerUtils.wait(350);
  await popScanModalPages(maxRetryTimes - 1);
};

export const popActionCenterPages = async (maxRetryTimes = 99) => {
  if (maxRetryTimes <= 0) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  const currentRoute = rootState?.routes?.[rootState.index];
  if (currentRoute?.name !== ERootRoutes.FullScreenPush) {
    return;
  }
  if (rootNavigationRef.current?.canGoBack?.()) {
    rootNavigationRef.current?.goBack();
  }
  await timerUtils.wait(350);
  await popActionCenterPages(maxRetryTimes - 1);
};

/**
 * Atomically replace all overlay routes with a target route in a single
 * CommonActions.reset dispatch. This avoids the race condition where
 * resetAboveMainRoute() triggers a native modal dismiss animation, and a
 * subsequent navigate() gets popped when the dismiss completes.
 *
 * State transition: [Main, Modal, ...] → [Main, targetRoute]
 */
export const resetToRoute = (
  routeName: string,
  params?: Record<string, unknown>,
) => {
  const state = rootNavigationRef.current?.getRootState();
  if (!state) {
    return;
  }
  const mainRoutes = state.routes.filter(
    (route) => route.name === ERootRoutes.Main,
  );
  if (mainRoutes.length === 0) {
    return;
  }
  const targetRoute = { name: routeName, params };
  rootNavigationRef.current?.dispatch(
    CommonActions.reset({
      ...state,
      routes: [...mainRoutes, targetRoute],
      index: mainRoutes.length,
    }),
  );
};

/**
 * Safely navigate from an overlay route (Modal/FullScreenPush) to a tab page.
 *
 * When using native UITabBarController, calling goBack() on overlay routes
 * can trigger RNSScreenStack updates on stacks inside detached tab views,
 * where window=NIL causes the update to fail after 50 retries (~5 seconds).
 *
 * This utility atomically removes all overlay routes via reset, switches
 * to the target tab, and waits for the navigator to settle before returning.
 *
 * Usage:
 *   await navigateFromOverlayToTab({
 *     targetTab: ETabRoutes.Home,
 *     switchTab: (tab) => navigation.switchTab(tab),
 *   });
 *   // Now safe to push/navigate within the target tab
 */
export const navigateFromOverlayToTab = async (options: {
  targetTab: ETabRoutes;
  switchTab: (tab: ETabRoutes) => void;
}) => {
  resetAboveMainRoute();
  options.switchTab(options.targetTab);
  // Wait for navigator to fully reconcile after reset + tab switch
  await timerUtils.wait(100);
};

export const popToTabRootScreen = async () => {
  const rootState = rootNavigationRef.current?.getRootState();
  const tabRoute = rootState?.routes?.[rootState.index];
  if (!tabRoute?.state) {
    return;
  }
  if (tabRoute?.state?.index !== undefined) {
    if (rootNavigationRef.current?.canGoBack()) {
      rootNavigationRef.current?.goBack();
      await timerUtils.wait(150);
      await popToTabRootScreen();
    }
  }
};
