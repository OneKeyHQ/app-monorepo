import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Input from '@onekeyhq/kit/src/views/Swap/Input';
import Output from '@onekeyhq/kit/src/views/Swap/Output';
import Settings from '@onekeyhq/kit/src/views/Swap/Settings';
import {
  SwapRoutes,
  SwapRoutesParams,
} from '@onekeyhq/kit/src/views/Swap/typings';

import createStackNavigator from './createStackNavigator';

const SwapNavigator = createStackNavigator<SwapRoutesParams>();

const modalRoutes = [
  {
    name: SwapRoutes.Input,
    component: Input,
  },
  {
    name: SwapRoutes.Output,
    component: Output,
  },
  {
    name: SwapRoutes.Settings,
    component: Settings,
  },
];

const SwapModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SwapNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SwapNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SwapNavigator.Navigator>
  );
};

export type { SwapRoutesParams };
export { SwapRoutes };
export default SwapModalStack;
