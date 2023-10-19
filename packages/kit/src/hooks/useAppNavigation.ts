import { useNavigation } from '@react-navigation/core';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import type {
  ModalNavigationProp,
  PageNavigationProp,
  StackNavigationOptions,
} from '@onekeyhq/components/src/Navigation';

import { RootRoutes } from '../routes/Root/Routes';

import type { ModalParamList, ModalRoutes } from '../routes/Root/Modal/Routes';
import type { TabRoutes, TabStackParamList } from '../routes/Root/Tab/Routes';

function useAppNavigation<
  P extends
    | PageNavigationProp<any>
    | ModalNavigationProp<any> = PageNavigationProp<any>,
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

  const switchTab = <T extends TabRoutes>(
    route: T,
    params?: {
      screen: keyof TabStackParamList[T];
      params?: TabStackParamList[T][keyof TabStackParamList[T]];
    },
  ) => {
    navigation.navigate(RootRoutes.Main, {
      screen: route,
      params,
    });
  };

  const pushModal = <T extends ModalRoutes>(
    route: T,
    params?: {
      screen: keyof ModalParamList[T];
      params?: ModalParamList[T][keyof ModalParamList[T]];
    },
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: route,
      params,
    });
  };

  const iosHeaderStyle = Platform.select<StackNavigationOptions>({
    ios: {
      headerStyle: {
        backgroundColor: bgColor as string,
      },
      headerTintColor: titleColor as string,
    },
  });

  function setOptions(options: Partial<StackNavigationOptions>) {
    const { headerSearchBarOptions, ...otherOptions } = options;

    let newHeaderSearchBarOptions: StackNavigationOptions = {};
    if (headerSearchBarOptions) {
      newHeaderSearchBarOptions = {
        headerSearchBarOptions: {
          // always show search bar on iOS
          hideNavigationBar: false,
          // @ts-expect-error
          hideWhenScrolling: false,
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

export default useAppNavigation;
