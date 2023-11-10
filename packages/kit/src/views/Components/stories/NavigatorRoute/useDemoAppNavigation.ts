import { useNavigation } from '@react-navigation/core';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/Navigation';

import { DemoRootRoutes } from './Routes';

import type { DemoRootModalParamList, RootModalRoutes } from './Modal/Routes';
import type { TabStackParamList } from './Tab/RouteParamTypes';
import type { DemoTabRoutes } from './Tab/Routes';

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

  const switchTab = <T extends DemoTabRoutes>(
    route: T,
    params?: {
      screen: keyof TabStackParamList[T];
      params?: TabStackParamList[T][keyof TabStackParamList[T]];
    },
  ) => {
    navigation.navigate(DemoRootRoutes.Main, {
      screen: route,
      params,
    });
  };

  const pushModal = <T extends RootModalRoutes>(
    route: T,
    params?: {
      screen: keyof DemoRootModalParamList[T];
      params?: DemoRootModalParamList[T][keyof DemoRootModalParamList[T]];
    },
  ) => {
    navigation.navigate(DemoRootRoutes.Modal, {
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

  function setOptions(options: Partial<IStackNavigationOptions>) {
    const { headerSearchBarOptions, ...otherOptions } = options;

    let newHeaderSearchBarOptions: IStackNavigationOptions = {};
    if (headerSearchBarOptions) {
      newHeaderSearchBarOptions = {
        headerSearchBarOptions: {
          hideNavigationBar: false,
          // @ts-expect-error
          hideWhenScrolling: false,
          obscureBackground: true,
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
