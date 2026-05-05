import { useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Page,
  popToMainRoute,
  popToTabRootScreen,
  resetAboveMainRoute,
  rootNavigationRef,
  switchTab,
  switchTabAsync,
  tabletMainViewNavigationRef,
  useSplitMainView,
} from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/layouts/Navigation';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { isSpanning } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes, IModalParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';

const getModalRoute = () => {
  const state = rootNavigationRef.current?.getState();
  const currentIndex = state?.index || 0;
  const routes = state?.routes || [];
  const currentRoute = routes[currentIndex];
  if (currentRoute?.name === ERootRoutes.Modal) {
    return currentRoute;
  }
  return null;
};

const getScreenName = (modalRoute: ReturnType<typeof getModalRoute>) => {
  return (
    (
      modalRoute?.params as {
        screen: string;
      }
    )?.screen || modalRoute?.state?.routes?.[modalRoute.state?.index || 0]?.name
  );
};

export type IAppNavigation = ReturnType<typeof useAppNavigation>;

/*
navigate by full route path:

 navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHomeUrlAccountPage,
        params,
      },
    });
    
*/

/* 
replace
import { StackActions } from '@react-navigation/native';

 navigation.dispatch(
  StackActions.replace(ERootRoutes.Main, {
    screen: ETabRoutes.Developer,
    params: {
      screen: ETabDeveloperRoutes.TabDeveloper,
    },
  }),
);

*/

let lastPushAbleNavigation:
  | ReturnType<
      typeof useNavigation<IPageNavigationProp<any> | IModalNavigationProp<any>>
    >
  | undefined;

const PUSH_MODAL_LOCK_DURATION_MS = 300;
const PENDING_MODAL_TARGET_TIMEOUT_MS = 1000;

type IPendingModalTarget = {
  modalType: ERootRoutes.Modal | ERootRoutes.iOSFullScreen;
  route: string;
  screen?: string;
  paramsKey?: string;
};

type INavigationRouteWithNestedState = {
  name?: string;
  params?: unknown;
  state?: {
    index?: number;
    routes?: Array<{
      name?: string;
      params?: unknown;
      state?: {
        index?: number;
        routes?: Array<{
          name?: string;
        }>;
      };
    }>;
  };
};

let pendingModalTargetKey: string | undefined;
let pendingModalTargetTimer: ReturnType<typeof setTimeout> | undefined;
let pendingModalTargetUnsubscribe: (() => void) | undefined;

const buildPendingModalTargetKey = ({
  modalType,
  route,
  screen,
  paramsKey,
}: IPendingModalTarget) =>
  `${modalType}::${route}::${screen ?? ''}::${paramsKey ?? ''}`;

const getNestedRouteScreenName = (route?: INavigationRouteWithNestedState) => {
  const params = route?.params as { screen?: string } | undefined;
  if (params?.screen) {
    return params.screen;
  }
  const activeChildRoute = route?.state?.routes?.[route.state?.index ?? 0];
  if (!activeChildRoute) {
    return undefined;
  }
  const activeChildParams = activeChildRoute.params as
    | { screen?: string }
    | undefined;
  const nestedRouteName =
    activeChildRoute.state?.routes?.[activeChildRoute.state?.index ?? 0]?.name;
  return activeChildParams?.screen ?? nestedRouteName ?? activeChildRoute.name;
};

const getRootRouteModalTarget = (
  route?: INavigationRouteWithNestedState,
): IPendingModalTarget | undefined => {
  if (
    route?.name !== ERootRoutes.Modal &&
    route?.name !== ERootRoutes.iOSFullScreen
  ) {
    return undefined;
  }

  const params = route.params as
    | {
        screen?: string;
        params?: {
          screen?: string;
        };
      }
    | undefined;
  const activeChildRoute = route.state?.routes?.[route.state?.index ?? 0];
  const modalRoute = params?.screen ?? activeChildRoute?.name;

  if (!modalRoute) {
    return undefined;
  }

  return {
    modalType: route.name,
    route: modalRoute,
    screen:
      params?.params?.screen ?? getNestedRouteScreenName(activeChildRoute),
  };
};

const isSamePendingModalTarget = (
  routeTarget: IPendingModalTarget | undefined,
  target: IPendingModalTarget,
) =>
  routeTarget?.modalType === target.modalType &&
  routeTarget.route === target.route &&
  routeTarget.screen === target.screen;

const clearPendingModalTarget = () => {
  if (pendingModalTargetTimer) {
    clearTimeout(pendingModalTargetTimer);
  }
  pendingModalTargetUnsubscribe?.();
  pendingModalTargetKey = undefined;
  pendingModalTargetTimer = undefined;
  pendingModalTargetUnsubscribe = undefined;
};

const trackPendingModalTarget = (target: IPendingModalTarget) => {
  clearPendingModalTarget();

  const pendingKey = buildPendingModalTargetKey(target);
  pendingModalTargetKey = pendingKey;

  const checkAndClear = () => {
    if (pendingModalTargetKey !== pendingKey) {
      return;
    }
    const rootState = rootNavigationRef.current?.getState();
    const currentRootRoute = rootState?.routes?.[rootState.index ?? 0];
    const currentTarget = getRootRouteModalTarget(currentRootRoute);
    if (isSamePendingModalTarget(currentTarget, target)) {
      clearPendingModalTarget();
    }
  };

  // React Navigation's NavigationContainerRef types don't expose 'state' as a typed event name
  pendingModalTargetUnsubscribe = rootNavigationRef.current?.addListener?.(
    'state' as any,
    checkAndClear,
  );

  // Timeout fallback: clear pending state even if state listener never fires
  pendingModalTargetTimer = setTimeout(
    clearPendingModalTarget,
    PENDING_MODAL_TARGET_TIMEOUT_MS,
  );
};

function useAppNavigation<
  P extends IPageNavigationProp<any> | IModalNavigationProp<any> =
    IPageNavigationProp<any>,
>() {
  // rootNavigationRef
  const navigation = useNavigation<P>();
  const navigationRef = useRef(navigation);
  const isTabletMainView = useSplitMainView();
  const pushModalLockRef = useRef(false);

  if (navigationRef.current !== navigation) {
    navigationRef.current = navigation;
  }

  const popStack = useCallback(() => {
    navigationRef.current.getParent()?.goBack?.();
  }, []);

  const pop = useCallback(() => {
    if (navigationRef.current.canGoBack?.()) {
      navigationRef.current.goBack?.();
    } else {
      popStack();
    }
  }, [popStack]);

  const pushModalPage = useCallback(
    <T extends EModalRoutes>(
      modalType: ERootRoutes.Modal | ERootRoutes.iOSFullScreen,
      route: T,
      params?: {
        screen: keyof IModalParamList[T];
        params?: IModalParamList[T][keyof IModalParamList[T]];
      },
    ) => {
      const navigationInstance = navigationRef.current;
      const target: IPendingModalTarget = {
        modalType,
        route,
        screen: typeof params?.screen === 'string' ? params.screen : undefined,
        paramsKey: params?.params ? JSON.stringify(params.params) : undefined,
      };

      let rootNavigation = navigationInstance;
      while (rootNavigation?.getParent()) {
        rootNavigation = rootNavigation.getParent();
      }

      const rootState = rootNavigation?.getState?.();
      const routeLength = rootState?.routes?.length ?? 1;
      const existPageIndex =
        rootState?.routes?.findIndex((rootRoute) =>
          isSamePendingModalTarget(getRootRouteModalTarget(rootRoute), target),
        ) ?? -1;
      if (existPageIndex !== -1 && existPageIndex === routeLength - 1) {
        return;
      }

      if (pendingModalTargetKey === buildPendingModalTargetKey(target)) {
        return;
      }

      trackPendingModalTarget(target);

      // TODO:
      // prevent pushModal from using unreleased Navigation instances during iOS modal animation by temporary exclusion,
      //  with plan to migrate to rootNavigationRef
      // eslint-disable-next-line no-extra-boolean-cast
      if (!!navigationInstance.push) {
        lastPushAbleNavigation = navigationInstance;
        navigationInstance.push(modalType, {
          screen: route,
          params,
        });
        return;
      }
      // This is a workaround for the root navigation not being able to access the child navigation
      if (lastPushAbleNavigation) {
        lastPushAbleNavigation.push(modalType, {
          screen: route,
          params,
        });
        return;
      }

      // If there is no stack route, use navigate to create a router stack.
      navigationInstance.navigate(modalType, {
        screen: route,
        params,
      });
    },
    [],
  );

  const pushModal = useCallback(
    <T extends EModalRoutes>(
      route: T,
      params?: {
        screen: keyof IModalParamList[T];
        params?: IModalParamList[T][keyof IModalParamList[T]];
      },
    ) => {
      if (pushModalLockRef.current) return;
      pushModalLockRef.current = true;
      setTimeout(() => {
        pushModalLockRef.current = false;
      }, PUSH_MODAL_LOCK_DURATION_MS);

      if (isTabletMainView) {
        appEventBus.emit(EAppEventBusNames.PushModalPageInTabletDetailView, {
          route,
          params,
        });
      } else {
        pushModalPage(ERootRoutes.Modal, route, params as any);
      }
    },
    [isTabletMainView, pushModalPage],
  );

  const pushFullModal = useCallback(
    <T extends EModalRoutes>(
      route: T,
      params?: {
        screen: keyof IModalParamList[T];
        params?: IModalParamList[T][keyof IModalParamList[T]];
      },
    ) => {
      if (pushModalLockRef.current) return;
      pushModalLockRef.current = true;
      setTimeout(() => {
        pushModalLockRef.current = false;
      }, PUSH_MODAL_LOCK_DURATION_MS);

      pushModalPage(ERootRoutes.iOSFullScreen, route, params as any);
    },
    [pushModalPage],
  );

  const { reload } = Page.Header.usePageHeaderReloadOptions();
  const setOptions = useCallback(
    (options: Partial<IStackNavigationOptions>) => {
      const reloadOptions = reload(options);
      navigationRef.current.setOptions(reloadOptions);
    },
    [reload],
  );

  const setParams: typeof navigationRef.current.setParams = useCallback(
    (params) => {
      navigationRef.current.setParams(params);
    },
    [],
  );

  const reset: typeof navigationRef.current.reset = useCallback((state) => {
    navigationRef.current.reset(state);
  }, []);

  const dispatch: typeof navigationRef.current.dispatch = useCallback(
    (action) => {
      navigationRef.current.dispatch(action);
    },
    [],
  );

  const push: typeof navigationRef.current.push = useCallback(
    (...args) => {
      if (isSpanning()) {
        // Get current tab route index from tabletMainViewNavigationRef
        const tabletState = tabletMainViewNavigationRef.current?.getState();
        const tabletMainRoute = tabletState?.routes?.find(
          (route) => route.name === ERootRoutes.Main,
        );
        const tabletTabRoutes = tabletMainRoute?.state?.routes;
        const tabletTabIndex = tabletMainRoute?.state?.index ?? 0;
        const tabletTabRoute = tabletTabRoutes?.[tabletTabIndex]?.name as
          | ETabRoutes
          | undefined;

        // Get current tab route index from rootNavigationRef
        const rootState = rootNavigationRef.current?.getState();
        const rootMainRoute = rootState?.routes?.find(
          (route) => route.name === ERootRoutes.Main,
        );
        const rootTabRoutes = rootMainRoute?.state?.routes;
        const rootTabIndex = rootMainRoute?.state?.index ?? 0;
        const rootTabRoute = rootTabRoutes?.[rootTabIndex]?.name as
          | ETabRoutes
          | undefined;

        // Sync rootNavigationRef to the same tab if they are different
        if (tabletTabRoute && tabletTabRoute !== rootTabRoute) {
          switchTab(tabletTabRoute);
        }
      }
      if (isTabletMainView) {
        appEventBus.emit(EAppEventBusNames.PushPageInTabletDetailView, args);
        return;
      }
      const modalRoute = getModalRoute();
      if (modalRoute) {
        const isSettingsModal =
          modalRoute.state?.routes?.[modalRoute.state?.index || 0]?.name ===
          EModalRoutes.SettingModal;
        if (!isSettingsModal) {
          const parentState = navigation.getParent()?.getState();
          const currentScreenModal = getScreenName(modalRoute);
          const screenModal = getScreenName({
            state: parentState,
            key: '',
            name: '',
          });
          if (currentScreenModal !== screenModal) {
            navigationRef.current.navigate(ERootRoutes.Modal, {
              screen: currentScreenModal,
              params: {
                screen: args[0],
                params: args[1],
              },
            });
            return;
          }
        }
      }
      navigationRef.current.navigate(...args);
    },
    [isTabletMainView, navigation],
  );

  const replace: typeof navigationRef.current.replace = useCallback(
    (...args) => {
      navigationRef.current.replace(...args);
    },
    [],
  );

  const navigate: typeof navigationRef.current.navigate = useCallback(
    (...args: any) => {
      const [screen, params, options = { pop: true }] = args;

      // When navigating to Main with pop:true while an overlay is present,
      // serialize the overlay dismiss and tab switch. The default pop:true
      // uses navigate(Main, {pop:true}) which overlaps modal dismiss + tab
      // switch + Main re-attach in one UIKit tick, creating orphan
      // RNSScreenStack instances on iOS that accumulate and freeze the UI.
      if (
        platformEnv.isNativeIOS &&
        screen === ERootRoutes.Main &&
        options?.pop
      ) {
        const rootState = rootNavigationRef.current?.getRootState();
        const topRoute = rootState?.routes?.[rootState?.index ?? 0];
        const hasOverlay = topRoute?.name !== ERootRoutes.Main;
        if (hasOverlay) {
          resetAboveMainRoute();
          setTimeout(() => {
            navigationRef.current.navigate(screen, params);
          }, 100);
          return;
        }
      }

      navigationRef.current.navigate(screen, params, options);
    },
    [],
  );

  const popToTop: typeof navigationRef.current.popToTop = useCallback(() => {
    navigationRef.current.popToTop();
  }, []);

  return useMemo(
    () => ({
      dispatch,
      navigate,
      pop,
      popStack,
      replace,
      push,
      pushFullModal,
      pushModal,
      reset,
      setParams,
      setOptions,
      /** @deprecated Use `switchTabAsync` instead */
      switchTab,
      switchTabAsync,
      popToTop,
      popToMainRoute,
      popToTabRootScreen,
    }),
    [
      dispatch,
      navigate,
      pop,
      popStack,
      popToTop,
      push,
      pushFullModal,
      pushModal,
      replace,
      reset,
      setParams,
      setOptions,
    ],
  );
}

export default useAppNavigation;
