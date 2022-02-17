import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Password } from '@onekeyhq/kit/src/views/Password';
import {
  PasswordRoutes,
  PasswordRoutesParams,
} from '@onekeyhq/kit/src/views/Password/types';

const PasswordNavigator = createStackNavigator<PasswordRoutesParams>();

const modalRoutes = [
  {
    name: PasswordRoutes.PasswordRoutes,
    component: Password,
  },
];

const PasswordModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <PasswordNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <PasswordNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </PasswordNavigator.Navigator>
  );
};

export type { PasswordRoutesParams };
export { PasswordRoutes };
export default PasswordModalStack;
