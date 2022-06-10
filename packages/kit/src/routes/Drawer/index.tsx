import React, { memo } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

import AccountSelectorMobile from '@onekeyhq/kit/src/components/Header/AccountSelectorMobile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Tab from '../Tab';
import { RootRoutes } from '../types';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
  const isWeb = !platformEnv.isNative;
  return (
    <DrawerStack.Navigator
      useLegacyImplementation={false}
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: isWeb ? 'back' : 'front',
        swipeEdgeWidth: 390,
        drawerStyle: { width: '90%' },
      }}
      drawerContent={(props) => <AccountSelectorMobile {...props} />}
    >
      <DrawerStack.Screen name={RootRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
