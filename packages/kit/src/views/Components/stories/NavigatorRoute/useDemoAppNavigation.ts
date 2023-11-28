import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/Navigation';

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
  const [bgColor, titleColor] = useThemeValue(['bg', 'text']);

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

  const iosHeaderStyle = Platform.select<IStackNavigationOptions>({
    ios: {
      headerStyle: {
        backgroundColor: bgColor,
      },
      headerTintColor: titleColor,
    },
  });

  const searchTextColor = titleColor;
  const intl = useIntl();
  const searchCancelText = intl.formatMessage({ id: 'action__cancel' });

  function setOptions(options: Partial<IStackNavigationOptions>) {
    const { headerSearchBarOptions, ...otherOptions } = options;

    let newHeaderSearchBarOptions: IStackNavigationOptions = {};
    if (headerSearchBarOptions) {
      newHeaderSearchBarOptions = {
        headerSearchBarOptions: {
          hideNavigationBar: false,
          hideWhenScrolling: false,
          cancelButtonText: searchCancelText,
          textColor: searchTextColor,
          ...headerSearchBarOptions,
        },
      };
    }

    navigation.setOptions({
      ...iosHeaderStyle,
      ...otherOptions,
      ...newHeaderSearchBarOptions,
    });
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
