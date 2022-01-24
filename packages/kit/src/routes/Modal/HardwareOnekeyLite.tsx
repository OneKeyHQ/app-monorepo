import React from 'react';

import { RouteProp } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLiteChangePin from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/ChangePin';
import OnekeyLitePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode';
import OnekeyLiteReset from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Reset';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

export type OnekeyLiteRouteProp = RouteProp<
  OnekeyLiteRoutesParams,
  OnekeyLiteModalRoutes
>;

const OnekeyLiteNavigator = createStackNavigator<OnekeyLiteRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
    component: OnekeyLitePinCode,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeSetModal,
    component: OnekeyLitePinCode,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeRepeatModal,
    component: OnekeyLitePinCode,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal,
    component: OnekeyLitePinCode,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteRestoreModal,
    component: OnekeyLiteRestore,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteBackupModal,
    component: OnekeyLiteBackup,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteChangePinModal,
    component: OnekeyLiteChangePin,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteResetModal,
    component: OnekeyLiteReset,
  },
];

const OnekeyLiteModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyLiteNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyLiteNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyLiteNavigator.Navigator>
  );
};

export default OnekeyLiteModalStack;
export { OnekeyLiteModalRoutes, modalRoutes };
export type { OnekeyLiteRoutesParams };
