import React from 'react';

import { RouteProp } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import {
  OnekeyLiteCurrentPinCode,
  OnekeyLiteNewRepeatPinCode,
  OnekeyLiteNewSetPinCode,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/ChangePinInputPin';
import {
  OnekeyLitePinModalRoutes,
  OnekeyLitePinRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

export type OnekeyLiteRouteProp = RouteProp<
  OnekeyLitePinRoutesParams,
  OnekeyLitePinModalRoutes
>;

const OnekeyLitePinNavigator =
  createStackNavigator<OnekeyLitePinRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLitePinModalRoutes.OnekeyLitePinCodeChangePinModal,
    component: OnekeyLiteCurrentPinCode,
  },
  {
    name: OnekeyLitePinModalRoutes.OnekeyLitePinCodeSetModal,
    component: OnekeyLiteNewSetPinCode,
  },
  {
    name: OnekeyLitePinModalRoutes.OnekeyLitePinCodeRepeatModal,
    component: OnekeyLiteNewRepeatPinCode,
  },
];

const OnekeyLitePinModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyLitePinNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyLitePinNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyLitePinNavigator.Navigator>
  );
};

export default OnekeyLitePinModalStack;
export { OnekeyLitePinModalRoutes, modalRoutes };
export type { OnekeyLitePinRoutesParams };
