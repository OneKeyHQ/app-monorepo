import React, { memo } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

import AccountSelectorMobile from '@onekeyhq/kit/src/components/Header/AccountSelectorMobile';

import Tab from '../Tab';
import { RootRoutes } from '../types';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => (
  <DrawerStack.Navigator
    screenOptions={{
      headerShown: false,
      drawerType: 'front',
    }}
    drawerContent={(props) => <AccountSelectorMobile {...props} />}
  >
    <DrawerStack.Screen name={RootRoutes.Tab} component={Tab} />
  </DrawerStack.Navigator>
);

export default memo(DrawerStackNavigator);
