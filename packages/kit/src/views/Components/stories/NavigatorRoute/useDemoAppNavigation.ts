import { useNavigation } from '@react-navigation/core';

import type {
  PageNavigationProp,
  StackNavigationOptions,
} from '@onekeyhq/components/src/Navigation';

import { DemoRootRoutes } from './Routes';

import type { DemoRootModalParamList, RootModalRoutes } from './Modal/Routes';
import type { TabStackParamList } from './Tab/RouteParamTypes';
import type { DemoTabRoutes } from './Tab/Routes';

function useDemoAppNavigation<
  P extends PageNavigationProp<any> = PageNavigationProp<any>,
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

  const switchTab = <T extends DemoTabRoutes>(
    route: T,
    params?: {
      screen: keyof TabStackParamList[T];
      params?: TabStackParamList[T][keyof TabStackParamList[T]];
    },
  ) => {
    navigation.navigate(DemoRootRoutes.Main, {
      // screen: DemoMainRoutes.Tab,
      // params: {
      screen: route,
      params,
      // },
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

  function setOptions(options: Partial<StackNavigationOptions>) {
    navigation.setOptions(options);
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
