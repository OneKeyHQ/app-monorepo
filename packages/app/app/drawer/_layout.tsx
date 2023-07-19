import { useCallback, useMemo } from 'react';

import { Drawer } from 'expo-router/drawer';

import { getDrawerWidth } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';
import { WalletSelectorMobile } from '@onekeyhq/kit/src/components/WalletSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { StyleProp, ViewStyle } from 'react-native';

export default function Layout() {
  const backgroundColor = useThemeValue('background-default');

  const screenOptions = useMemo(() => {
    const drawerStyle: Partial<StyleProp<ViewStyle>> = {
      width: getDrawerWidth(),
      backgroundColor,
    };

    if (platformEnv.isRuntimeBrowser) {
      drawerStyle.opacity = 1;
    }
    return {
      headerShown: false,
      /**
       * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
       */
      drawerType: 'back',
      drawerStyle,
      swipeEnabled: false,
    } as const;
  }, [backgroundColor]);

  const drawerContent = useCallback(
    (props) => <WalletSelectorMobile {...props} />,
    [],
  );
  return <Drawer screenOptions={screenOptions} drawerContent={drawerContent} />;
}
