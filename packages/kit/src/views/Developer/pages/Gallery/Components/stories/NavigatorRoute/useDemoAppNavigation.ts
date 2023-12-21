import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, useThemeValue } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/layouts/Navigation';

import { EDemoRootRoutes } from './Routes';

import type { ERootModalRoutes, IDemoRootModalParamList } from './Modal/Routes';
import type { ITabStackParamList } from './Tab/RouteParamTypes';
import type { EDemoTabRoutes } from './Tab/Routes';

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

  const switchTab = <T extends EDemoTabRoutes>(
    route: T,
    params?: {
      screen: keyof ITabStackParamList[T];
      params?: ITabStackParamList[T][keyof ITabStackParamList[T]];
    },
  ) => {
    navigation.navigate(EDemoRootRoutes.Main, {
      screen: route,
      params,
    });
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

  const intl = useIntl();
  const textColor = useThemeValue('text');

  function setOptions(options: Partial<IStackNavigationOptions>) {
    const reloadOptions = Page.Header.usePageHeaderSearchOptions(
      options,
      intl,
      { searchTextColor: textColor },
    );
    navigation.setOptions(reloadOptions);
  }

  return {
    navigation,
    reset: navigation.reset,
    dispatch: navigation.dispatch,
    push: navigation.navigate,
    switchTab,
    pushModal,
    pop,
    popStack,
    setOptions,
  };
}

export default useDemoAppNavigation;
