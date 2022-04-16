import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ScanQrcode from '@onekeyhq/kit/src/views/ScanQrcode/ScanQrcode';
import {
  ScanQrcodeRoutes,
  ScanQrcodeRoutesParams,
} from '@onekeyhq/kit/src/views/ScanQrcode/types';

import createStackNavigator from './createStackNavigator';

const ScanQrcodeNavigator = createStackNavigator<ScanQrcodeRoutes>();

const modalRoutes = [
  {
    name: ScanQrcodeRoutes.ScanQrcode,
    component: ScanQrcode,
  },
];

const ScanQrcodeStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ScanQrcodeNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ScanQrcodeNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ScanQrcodeNavigator.Navigator>
  );
};

export default ScanQrcodeStack;
export type { ScanQrcodeRoutesParams };
export { ScanQrcodeRoutes };
