import React from 'react';

import { RouteProp } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import HardwarePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode';
import {
  HardwarePinCodeModalRoutes,
  HardwarePinCodeRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode/types';

export type HardwarePinCodeRouteProp = RouteProp<
  HardwarePinCodeRoutesParams,
  HardwarePinCodeModalRoutes
>;

const HardwarePinCodeNavigator =
  createStackNavigator<HardwarePinCodeRoutesParams>();

const modalRoutes = [
  {
    name: HardwarePinCodeModalRoutes.HardwarePinCodeModal,
    component: HardwarePinCode,
  },
];

const HardwarePinCodeModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <HardwarePinCodeNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <HardwarePinCodeNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </HardwarePinCodeNavigator.Navigator>
  );
};

export default HardwarePinCodeModalStack;
export { HardwarePinCodeModalRoutes };
export type { HardwarePinCodeRoutesParams };
