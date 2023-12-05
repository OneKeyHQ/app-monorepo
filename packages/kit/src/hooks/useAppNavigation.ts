import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import type {
  IModalNavigationProp,
  IPageNavigationProp,
  IStackNavigationOptions,
} from '@onekeyhq/components/src/layouts/Navigation';

import { ERootRoutes } from '../routes/enum';

import type {
  EIOSFullScreenModalRoutes,
  IIOSFullScreenModalParamList,
} from '../routes/iOSFullScreen/type';
import type { EModalRoutes, IModalParamList } from '../routes/Modal/type';
import type { ETabRoutes, ITabStackParamList } from '../routes/Tab/router';

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

  const pushFullModal = <T extends EIOSFullScreenModalRoutes>(
    route: T,
    params?: {
      screen: keyof IIOSFullScreenModalParamList[T];
      params?: IIOSFullScreenModalParamList[T][keyof IIOSFullScreenModalParamList[T]];
    },
  ) => {
    navigation.navigate(ERootRoutes.iOSFullScreen, {
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
          // always show search bar on iOS
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
