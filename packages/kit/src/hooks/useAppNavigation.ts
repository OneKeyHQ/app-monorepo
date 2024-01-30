import { useCallback } from 'react';

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

  const popStack = useCallback(() => {
    navigation.getParent()?.goBack?.();
  }, [navigation]);

  const pop = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack?.();
    } else {
      popStack();
    }
  }, [navigation, popStack]);

  const switchTab = useCallback(
    <T extends ETabRoutes>(
      route: T,
      params?: {
        screen: keyof ITabStackParamList[T];
        params?: ITabStackParamList[T][keyof ITabStackParamList[T]];
      },
    ) => {
      navigation.navigate(ERootRoutes.Main, {
        screen: route,
        params,
      });
    },
    [navigation],
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
      if (navigation.push) {
        navigation.push(modalType, {
          screen: route,
          params,
        });
        return;
      }
      navigation.navigate(modalType, {
        screen: route,
        params,
      });
    },
    [navigation],
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

  const pageHeaderReload = Page.Header.usePageHeaderReloadOptions();
  const setOptions = useCallback(
    (options: Partial<IStackNavigationOptions>) => {
      const reloadOptions = pageHeaderReload.reload(options);
      navigation.setOptions(reloadOptions);
    },
    [navigation, pageHeaderReload],
  );

  return {
    navigation,
    reset: navigation.reset,
    dispatch: navigation.dispatch,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    push: navigation.push,
    navigate: navigation.navigate,
    switchTab,
    pushModal,
    pushFullModal,
    pop,
    popStack,
    setOptions,
  };
}

export default useAppNavigation;
