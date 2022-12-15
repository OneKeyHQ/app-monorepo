import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { StackAnimationTypes } from 'react-native-screens';

export function useDisableNavigationAnimation({
  condition,
}: {
  condition?: boolean;
}) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    // disable animation if auto navigate
    if (condition) {
      navigation.setOptions({
        // node_modules/@react-navigation/native-stack/src/types.tsx
        // @ts-ignore
        animation: 'none' as StackAnimationTypes, // disable animation for native

        // node_modules/@react-navigation/stack/src/types.tsx
        // @ts-ignore
        animationEnabled: false, // disable animation for web
      });
    }
  }, [navigation, condition]);
}
