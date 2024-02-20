import { useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/layouts/Navigation';

import { ERootRoutes } from '../routes/enum';

import type { EModalRoutes, IModalParamList } from '../routes/Modal/type';
import type { ETabRoutes, ITabStackParamList } from '../routes/Tab/type';

function useAppNavigation<
  P extends
    | IPageNavigationProp<any>
    | IModalNavigationProp<any> = IPageNavigationProp<any>,
>() {
  const navigation = useNavigation<P>();
  const navigationRef = useRef(navigation);

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

  const switchTab = useCallback(
    <T extends ETabRoutes>(
      route: T,
      params?: {
        screen: keyof ITabStackParamList[T];
        params?: ITabStackParamList[T][keyof ITabStackParamList[T]];
      },
    ) => {
      navigationRef.current.navigate(ERootRoutes.Main, {
        screen: route,
        params,
      });
    },
    [],
  );

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
      // eslint-disable-next-line no-extra-boolean-cast
      if (!!navigationInstance.push) {
        navigationInstance.push(modalType, {
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
      pushModalPage(ERootRoutes.Modal, route, params);
    },
    [pushModalPage],
  );

  const pushFullModal = useCallback(
    <T extends EModalRoutes>(
      route: T,
      params?: {
        screen: keyof IModalParamList[T];
        params?: IModalParamList[T][keyof IModalParamList[T]];
      },
    ) => {
      pushModalPage(ERootRoutes.iOSFullScreen, route, params);
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

  const reset: typeof navigationRef.current.reset = useCallback((state) => {
    navigationRef.current.reset(state);
  }, []);

  const dispatch: typeof navigationRef.current.dispatch = useCallback(
    (action) => {
      navigationRef.current.dispatch(action);
    },
    [],
  );

  const push: typeof navigationRef.current.push = useCallback((...args) => {
    navigationRef.current.push(...args);
  }, []);

  const navigate: typeof navigationRef.current.navigate = useCallback(
    (...args: any) => {
      navigationRef.current.navigate(...args);
    },
    [],
  );

  return useMemo(
    () => ({
      dispatch,
      navigate,
      pop,
      popStack,
      push,
      pushFullModal,
      pushModal,
      reset,
      setOptions,
      switchTab,
    }),
    [
      dispatch,
      navigate,
      pop,
      popStack,
      push,
      pushFullModal,
      pushModal,
      reset,
      setOptions,
      switchTab,
    ],
  );
}

export default useAppNavigation;
