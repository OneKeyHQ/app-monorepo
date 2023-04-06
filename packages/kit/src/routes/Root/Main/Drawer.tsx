import { memo, useCallback } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { useWindowDimensions } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletSelectorMobile } from '../../../components/WalletSelector';
import { MainRoutes } from '../../routesEnum';

import Tab from './Tab/TabNavigator';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
  const { width } = useWindowDimensions();
  const drawerStyle: Partial<StyleProp<ViewStyle>> = {
    // must sync with nestedtabview
    width: Math.floor(width * 0.85),
    // maxWidth is not supported on iPad mini
    maxWidth: platformEnv.isNative ? undefined : 400,
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
      <DrawerStack.Screen name={MainRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
