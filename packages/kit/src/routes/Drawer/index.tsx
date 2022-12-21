import { memo } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

import { useThemeValue } from '@onekeyhq/components';
import { WalletSelectorMobile } from '@onekeyhq/kit/src/components/WalletSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Tab from '../Tab';
import { RootRoutes } from '../types';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
  const isWeb = !platformEnv.isNative;
  const drawerStyle: Partial<StyleProp<ViewStyle>> = {
    width: '85%',
    maxWidth: 400,
    backgroundColor: useThemeValue('background-default'),
  };
  if (isWeb) {
    drawerStyle.opacity = 1;
  }

  return (
    <DrawerStack.Navigator
      useLegacyImplementation
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: 'back',
        swipeEdgeWidth: 16,
        drawerStyle,
        swipeEnabled: !platformEnv.isNativeIOSPad,
      }}
      // eslint-disable-next-line react/no-unstable-nested-components
      drawerContent={(props) => <WalletSelectorMobile {...props} />}
    >
      <DrawerStack.Screen name={RootRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
