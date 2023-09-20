import { useCallback, useEffect, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// use `hideBackButton` in <Modal /> instead
function useDisableNavigationBack({ condition }: { condition: boolean }) {
  const navigation = useNavigation();

  const navEventAction = useCallback(
    (
      method: 'addListener' | 'removeListener',
      name: string,
      callback: (e: Event) => void,
      { applyToAllParent = false }: { applyToAllParent?: boolean } = {},
    ) => {
      let nav: typeof navigation | undefined = navigation;
      while (nav && nav[method]) {
        nav[method](name as any, callback as any);
        if (applyToAllParent) {
          nav = nav?.getParent?.();
        } else {
          nav = undefined;
        }
      }
    },
    [navigation],
  );

  useEffect(() => {
    // only android works for addListener beforeRemove
    // if you addListener beforeRemove in iOS, and swipe back by gesture, the navigation will be broken.
    if (!platformEnv.isNativeAndroid) {
      return;
    }
    const beforeRemoveHandler = (e: Event) => {
      if (condition) {
        e?.preventDefault?.();
      }
    };
    // navEventAction('addListener', 'gestureStart', beforeRemoveHandler);

    // *** can not prevent gesture back, and may cause all navigation back disabled permanently, as the useEffect destroy callback won't be called.
    // The screen 'BehindTheScene' was removed natively but didn't get removed from JS state. This can happen if the action was prevented in a 'beforeRemove' listener, which is not fully supported in native-stack.
    navEventAction('addListener', 'beforeRemove', beforeRemoveHandler);
    return () => {
      // navEventAction('removeListener', 'gestureStart', beforeRemoveHandler);
      navEventAction('removeListener', 'beforeRemove', beforeRemoveHandler);
    };
  }, [condition, navigation, navEventAction]);

  useLayoutEffect(() => {
    // return;

    // disable animation if auto navigate
    if (condition) {
      navigation.setOptions({
        gestureEnabled: false,

        // node_modules/@react-navigation/native-stack/src/types.tsx
        // @ts-ignore
        headerLeft: null,

        // node_modules/@react-navigation/stack/src/types.tsx
        // @ts-ignore
        // headerLeft: null, // disable animation for web
      });
    }
  }, [navigation, condition]);
}
export { useDisableNavigationBack };
