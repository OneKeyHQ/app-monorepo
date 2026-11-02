import { useEffect, useRef } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import type { NativeBottomTabNavigationProp } from '@onekeyhq/components/src/layouts/Navigation/BottomTabs';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Run `callback` when the native bottom tab hosting this screen is
 * double-pressed while this screen is focused. The screen is usually the root
 * of a stack nested in the tab, so the listener is attached to the closest
 * tab navigator ancestor, like react-navigation's `useScrollToTop`.
 */
export function useTabDoublePress(callback: () => void) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // `nestedNavigation` ends as the navigation directly inside the tab route.
    let nestedNavigation: NavigationProp<ParamListBase> = navigation;
    let tabNavigation: NavigationProp<ParamListBase> | undefined = navigation;
    while (tabNavigation && tabNavigation.getState()?.type !== 'tab') {
      nestedNavigation = tabNavigation;
      tabNavigation = tabNavigation.getParent();
    }
    if (!tabNavigation) {
      return;
    }
    const hostTabNavigation = tabNavigation;

    const getHostTabRouteKey = () => {
      if (nestedNavigation === hostTabNavigation) {
        return route.key;
      }
      const nestedStateKey = nestedNavigation.getState()?.key;
      return hostTabNavigation
        .getState()
        ?.routes.find((tabRoute) => tabRoute.state?.key === nestedStateKey)
        ?.key;
    };

    return (
      hostTabNavigation as NativeBottomTabNavigationProp<ParamListBase>
    ).addListener('tabDoublePress', (e) => {
      // react-navigation already delivers targeted events only to the
      // listening route; the explicit check keeps that contract visible.
      if (e.target !== getHostTabRouteKey()) {
        return;
      }
      // Skip when a screen pushed above this one is the visible one.
      if (navigation.isFocused()) {
        callbackRef.current();
      }
    });
  }, [navigation, route.key]);
}
