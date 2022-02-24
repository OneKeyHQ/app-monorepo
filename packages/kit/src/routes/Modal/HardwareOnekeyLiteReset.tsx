import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyLiteReset from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Reset';
import {
  OnekeyLiteResetModalRoutes,
  OnekeyLiteResetRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

const OnekeyLiteResetNavigator =
  createStackNavigator<OnekeyLiteResetRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteResetModalRoutes.OnekeyLiteResetModal,
    component: OnekeyLiteReset,
  },
];

const OnekeyLiteResetModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyLiteResetNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyLiteResetNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyLiteResetNavigator.Navigator>
  );
};

export default OnekeyLiteResetModalStack;
export { OnekeyLiteResetModalRoutes };
export type { OnekeyLiteResetRoutesParams };
