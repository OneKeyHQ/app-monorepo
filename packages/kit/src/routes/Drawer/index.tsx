import React, { memo, useEffect, useState } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { RootSiblingParent } from 'react-native-root-siblings';

import AccountSelectorMobile from '@onekeyhq/kit/src/components/Header/AccountSelectorMobile';
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
  };
  if (isWeb) {
    drawerStyle.opacity = 1;
  }
  const [key, setKey] = useState('');
  useEffect(() => {
    // recreate drawer navigator to fix OK-8412 on ios
    // no idea why it works
    setTimeout(() => setKey('drawer'), 10);
  }, []);

  return (
    <DrawerStack.Navigator
      useLegacyImplementation
      key={key}
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: 'back',
        swipeEdgeWidth: 390,
        drawerStyle,
      }}
      drawerContent={(props) => <AccountSelectorMobile {...props} />}
    >
      <DrawerStack.Screen name={RootRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
