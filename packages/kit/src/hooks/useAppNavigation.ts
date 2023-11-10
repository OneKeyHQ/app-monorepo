import { useNavigation } from '@react-navigation/core';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/Navigation';

import { ERootRoutes } from '../routes/Root/Routes';

import type {
  EModalRoutes,
  IModalParamList,
} from '../routes/Root/Modal/Routes';
import type { ETabRoutes, ITabStackParamList } from '../routes/Root/Tab/Routes';

function useAppNavigation<
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

  const switchTab = <T extends ETabRoutes>(
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
  };

  const pushModal = <T extends EModalRoutes>(
    route: T,
    params?: {
      screen: keyof IModalParamList[T];
      params?: IModalParamList[T][keyof IModalParamList[T]];
    },
  ) => {
    navigation.navigate(ERootRoutes.Modal, {
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
