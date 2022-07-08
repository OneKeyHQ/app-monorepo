import React from 'react';

import { useNavigation } from '@react-navigation/native';

// use `hideBackButton` in <Modal /> instead
function useDisableNavigationBack({ condition }: { condition: boolean }) {
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    // disable animation if auto navigate
    if (condition) {
      navigation.setOptions({
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
