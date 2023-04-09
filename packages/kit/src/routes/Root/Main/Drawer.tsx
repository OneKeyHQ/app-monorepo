import { memo, useCallback, useMemo } from 'react';

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
  const drawerWidth = useMemo(() => {
    // must sync with nestedtabview
    const expectedWidth = width * 0.85;
    const maxWidth = 400;
    return expectedWidth > maxWidth ? maxWidth : expectedWidth;
  }, [width]);

  const backgroundColor = useThemeValue('background-default');

  const screenOptions = useMemo(() => {
    const drawerStyle: Partial<StyleProp<ViewStyle>> = {
      width: drawerWidth,
      // maxWidth is not supported on iPad mini
      maxWidth: platformEnv.isNative ? undefined : 400,
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
  }, [backgroundColor, drawerWidth]);

  const drawerContent = useCallback(
    (props) => <WalletSelectorMobile {...props} />,
    [],
  );

  return (
    <DrawerStack.Navigator
      screenOptions={screenOptions}
      drawerContent={drawerContent}
    >
      <DrawerStack.Screen name={MainRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
