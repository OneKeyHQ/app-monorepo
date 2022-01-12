import React from 'react';

import { RouteProp } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import HardwareConnect from '@onekeyhq/kit/src/views/Hardware/Connect';
import {
  HardwareConnectModalRoutes,
  HardwareConnectRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/Connect/types';

export type HardwareConnectRouteProp = RouteProp<
  HardwareConnectRoutesParams,
  HardwareConnectModalRoutes.HardwareConnectModal
>;

const HardwareConnectNavigator =
  createStackNavigator<HardwareConnectRoutesParams>();

const modalRoutes = [
  {
    name: HardwareConnectModalRoutes.HardwareConnectModal,
    component: HardwareConnect,
  },
];

const HardwareConnectModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <HardwareConnectNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <HardwareConnectNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </HardwareConnectNavigator.Navigator>
  );
};

export default HardwareConnectModalStack;
export { HardwareConnectModalRoutes };
export type { HardwareConnectRoutesParams };
