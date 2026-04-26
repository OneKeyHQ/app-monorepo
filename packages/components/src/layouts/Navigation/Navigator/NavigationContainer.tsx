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
  __DEV__ && platformEnv.isNative
    ? ({ ref }: { ref: RefObject<NavigationContainerRef<any>> }) => {
        const {
          useReactNavigationDevTools,
        } = require('@rozenite/react-navigation-plugin');
        const {
          useNetworkActivityDevTools,
        } = require('@rozenite/network-activity-plugin');
        const { useMMKVDevTools } = require('@rozenite/mmkv-plugin');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        useReactNavigationDevTools({ ref });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        useNetworkActivityDevTools();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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

/**
 * @deprecated
 * @description Prefer `switchTabAsync` for new code. This synchronous version
 * uses navigate(Main, {pop:true}) when an overlay is present, which combines
 * modal dismiss + tab switch + Main re-attach into one UIKit tick and can
 * create orphan RNSScreenStack instances on iOS (causing UI freeze).
 */
export const switchTab = (route: ETabRoutes) => {
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

/**
 * Async version of switchTab that serializes overlay dismiss and tab switch.
 *
 * When an overlay (Modal/FullScreenPush) is above Main, this function:
 * 1. Atomically removes all overlay routes via resetAboveMainRoute()
 * 2. Waits 100ms for UIKit to settle (dismiss animation + view re-attach)
 * 3. Navigates to the target tab
 *
 * This avoids the iOS RNSScreenStack orphan race that occurs when
 * navigate(Main, {pop:true}) overlaps modal dismiss + tab switch + Main
 * re-attach in a single UIKit transition tick. The orphans accumulate
 * across repeated modal open/close cycles and eventually freeze the UI.
 *
 * Use this in flows that open a modal, then dismiss + switch tab
 * (e.g. UniversalSearch → pick DApp → Discovery tab).
 */
export const switchTabAsync = async (route: ETabRoutes): Promise<void> => {
  const rootActiveTab = getActiveTabFromRef(rootNavigationRef);
  const rootHasOverlay = hasOverlayAboveMain(rootNavigationRef);

  defaultLogger.app.router.switchTab(route);

  // Tablet/split-view: mirror the tab switch on the tablet navigator
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

  if (rootHasOverlay) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    resetAboveMainRoute();
    await timerUtils.wait(100);
  }

  if (rootActiveTab !== route) {
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: route,
    });
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

/**
 * Atomically remove every root Modal route whose inner screen matches
 * `modalName` via CommonActions.reset, preserving every other route
 * (parent modals, tabs, FullScreenPush overlays).
 *
 * Use this to close a Modal from ANY caller context. Prefer this over
 * resetAboveMainRoute() when the target modal can be pushed from inside
 * another modal — atomic reset above Main would wipe parent overlays too.
 *
 * Prefer this over navigation.popStack() / navigation.pop() to skip the
 * native animated dismiss that leaves detached-tab RNSScreenStacks with
 * window=NIL and triggers the ~5s (50×100ms) retry storm on iOS.
 */
export function resetModalRouteByName(modalName: EModalRoutes) {
  const state = rootNavigationRef.current?.getRootState();
  if (!state) {
    return;
  }
  const filteredRoutes = state.routes.filter((route) => {
    const screenName =
      (route.params as { screen?: string })?.screen ||
      route.state?.routes?.[route.state?.index || 0]?.name;
    return !(route.name === ERootRoutes.Modal && screenName === modalName);
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

/** Thin wrapper — see resetModalRouteByName. */
export function resetChainSelectorModal() {
  resetModalRouteByName(EModalRoutes.ChainSelectorModal);
}

/** Thin wrapper — see resetModalRouteByName. */
export function resetPrimeModal() {
  resetModalRouteByName(EModalRoutes.PrimeModal);
}

/** Thin wrapper — see resetModalRouteByName. */
export function resetOnboardingModal() {
  resetModalRouteByName(EModalRoutes.OnboardingModal);
}

/** Thin wrapper — see resetModalRouteByName. */
export function resetAccountManagerStacksModal() {
  resetModalRouteByName(EModalRoutes.AccountManagerStacks);
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
 * Always uses switchTabAsync internally (ignores any provided switchTab callback)
 * to ensure overlay dismiss + tab switch are properly serialized.
 */
export const navigateFromOverlayToTab = async (options: {
  targetTab: ETabRoutes;
  /** @deprecated Ignored — always uses switchTabAsync internally */
  switchTab?: (tab: ETabRoutes) => void | Promise<void>;
}) => {
  await switchTabAsync(options.targetTab);
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
