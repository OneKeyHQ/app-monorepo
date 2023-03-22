import { memo, useCallback } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

import { useThemeValue } from '@onekeyhq/components';
import { WalletSelectorMobile } from '@onekeyhq/kit/src/components/WalletSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Tab from '../Tab';
import { RootRoutes } from '../types';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
  const drawerStyle: Partial<StyleProp<ViewStyle>> = {
    // must sync with nestedtabview
    width: '85%',
    maxWidth: 400,
    backgroundColor: useThemeValue('background-default'),
  };
  if (platformEnv.isRuntimeBrowser) {
    drawerStyle.opacity = 1;
  }

  const drawerContent = useCallback(
    (props) => <WalletSelectorMobile {...props} />,
    [],
  );

  return (
    <DrawerStack.Navigator
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: 'back',
        drawerStyle,
        swipeEnabled: false,
      }}
      drawerContent={drawerContent}
    >
      <DrawerStack.Screen name={RootRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
