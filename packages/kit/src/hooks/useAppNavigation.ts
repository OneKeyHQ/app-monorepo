import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, useThemeValue } from '@onekeyhq/components';
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
import type { ETabRoutes, ITabStackParamList } from '../routes/Tab/type';

function useAppNavigation<
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
