import { useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { NativeBottomTabNavigationProp } from '@onekeyhq/components/src/layouts/Navigation/BottomTabs';

import type {
  NavigationProp,
  ParamListBase,
} from '@react-navigation/native';

/**
 * Run `callback` when the native bottom tab hosting this screen is
 * double-pressed while this screen is focused. The screen is usually the root
 * of a stack nested in the tab, so the listener is attached to the closest
 * tab navigator ancestor, like react-navigation's `useScrollToTop`.
 */
export function useTabDoublePress(callback: () => void) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let tabNavigation: NavigationProp<ParamListBase> | undefined = navigation;
    while (tabNavigation && tabNavigation.getState()?.type !== 'tab') {
      tabNavigation = tabNavigation.getParent();
    }
    if (!tabNavigation) {
      return;
    }

    return (
      tabNavigation as NativeBottomTabNavigationProp<ParamListBase>
    ).addListener('tabDoublePress', () => {
      // Skip when a screen pushed above this one is the visible one.
      if (navigation.isFocused()) {
        callbackRef.current();
      }
    });
  }, [navigation]);
}
