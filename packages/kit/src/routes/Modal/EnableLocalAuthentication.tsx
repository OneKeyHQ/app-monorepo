import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import EnableLocalAuthentication from '@onekeyhq/kit/src/views/EnableLocalAuthentication';
import {
  EnableLocalAuthenticationRoutes,
  EnableLocalAuthenticationRoutesParams,
} from '@onekeyhq/kit/src/views/EnableLocalAuthentication/types';

const EnableLocalAuthenticationNavigator =
  createStackNavigator<EnableLocalAuthenticationRoutesParams>();

const modalRoutes = [
  {
    name: EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal,
    component: EnableLocalAuthentication,
  },
];

const PasswordModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <EnableLocalAuthenticationNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <EnableLocalAuthenticationNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </EnableLocalAuthenticationNavigator.Navigator>
  );
};

export type { EnableLocalAuthenticationRoutesParams };
export { EnableLocalAuthenticationRoutes };
export default PasswordModalStack;
