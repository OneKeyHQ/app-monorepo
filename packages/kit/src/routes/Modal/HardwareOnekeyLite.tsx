import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLitePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

const OnekeyLiteNavigator = createStackNavigator<OnekeyLiteRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
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
export { OnekeyLiteModalRoutes };
export type { OnekeyLiteRoutesParams };
