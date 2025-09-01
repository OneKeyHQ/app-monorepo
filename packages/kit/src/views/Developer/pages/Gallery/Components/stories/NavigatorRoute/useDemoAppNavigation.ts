import { useNavigation } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/layouts/Navigation';

import { EDemoRootRoutes } from './Routes';

import type { ERootModalRoutes, IDemoRootModalParamList } from './Modal/Routes';

function useDemoAppNavigation<
  P extends
    | IPageNavigationProp<any>
    | IModalNavigationProp<any> = IPageNavigationProp<any>,
>() {
  const navigation = useNavigation<P>();

  const popStack = () => {
    navigation.getParent()?.goBack?.();
  };

  const pop = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack?.();
    } else {
      popStack();
    }
  };

  const pushModal = <T extends ERootModalRoutes>(
    route: T,
    params?: {
      screen: keyof IDemoRootModalParamList[T];
      params?: IDemoRootModalParamList[T][keyof IDemoRootModalParamList[T]];
    },
  ) => {
    navigation.navigate(EDemoRootRoutes.Modal, {
      screen: route,
      params,
    });
  };

  const pageHeaderReload = Page.Header.usePageHeaderReloadOptions();
  function setOptions(options: Partial<IStackNavigationOptions>) {
    const reloadOptions = pageHeaderReload.reload(options);
    navigation.setOptions(reloadOptions);
  }

  return {
    navigation,
    reset: navigation.reset,
    dispatch: navigation.dispatch,
    push: navigation.navigate,
    pushModal,
    pop,
    popStack,
    setOptions,
  };
}

export default useDemoAppNavigation;
