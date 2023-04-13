import { memo, useCallback, useMemo } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

import { getDrawerWidth } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletSelectorMobile } from '../../../components/WalletSelector';
import { MainRoutes } from '../../routesEnum';

import Tab from './Tab/TabNavigator';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
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
