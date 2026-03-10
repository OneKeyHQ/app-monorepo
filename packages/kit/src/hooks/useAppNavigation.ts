import { useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Page,
  popToMainRoute,
  popToTabRootScreen,
  rootNavigationRef,
  switchTab,
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

      let rootNavigation = navigationInstance;
      while (rootNavigation?.getParent()) {
        rootNavigation = rootNavigation.getParent();
      }

      const routeLength = rootNavigation?.getState?.()?.routes?.length ?? 1;
      const existPageIndex = rootNavigation?.getState?.()?.routes?.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (rootRoute) => params?.screen === rootRoute?.params?.params?.screen,
      );
      if (existPageIndex !== -1 && existPageIndex === routeLength - 1) {
        return;
      }

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
      switchTab,
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
