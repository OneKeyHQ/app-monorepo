import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ReceiveToken from '@onekeyhq/kit/src/views/ReceiveToken';
import {
  ReceiveTokenRoutes,
  ReceiveTokenRoutesParams,
} from '@onekeyhq/kit/src/views/ReceiveToken/types';

const ReceiveTokenNavigator = createStackNavigator<ReceiveTokenRoutesParams>();

const modalRoutes = [
  {
    name: ReceiveTokenRoutes.ReceiveToken,
    component: ReceiveToken,
  },
];

const ReceiveTokenModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ReceiveTokenNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ReceiveTokenNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ReceiveTokenNavigator.Navigator>
  );
};

export default ReceiveTokenModalStack;
export { ReceiveTokenRoutes };
export type { ReceiveTokenRoutesParams };
