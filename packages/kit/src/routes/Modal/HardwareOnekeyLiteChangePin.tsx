import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyLiteChangePin from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/ChangePin';
import {
  OnekeyLiteCurrentPinCode,
  OnekeyLiteNewRepeatPinCode,
  OnekeyLiteNewSetPinCode,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/ChangePinInputPin';
import {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

import createStackNavigator from './createStackNavigator';

const OnekeyLitePinNavigator =
  createStackNavigator<OnekeyLiteChangePinRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal,
    component: OnekeyLiteCurrentPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal,
    component: OnekeyLiteNewSetPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal,
    component: OnekeyLiteNewRepeatPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal,
    component: OnekeyLiteChangePin,
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
export { OnekeyLiteChangePinModalRoutes };
export type { OnekeyLiteChangePinRoutesParams };
