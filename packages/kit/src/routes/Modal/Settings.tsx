import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Password } from '@onekeyhq/kit/src/views/Settings/Password';
import {
  SettingsModalRoutes,
  SettingsRoutesParams,
} from '@onekeyhq/kit/src/views/Settings/Password/types';

const ManageTokenNavigator = createStackNavigator<SettingsRoutesParams>();

const modalRoutes = [
  {
    name: SettingsModalRoutes.SetPasswordModal,
    component: Password,
  },
];

const SettingsModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageTokenNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ManageTokenNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageTokenNavigator.Navigator>
  );
};

export type { SettingsRoutesParams };
export { SettingsModalRoutes };
export default SettingsModalStack;
