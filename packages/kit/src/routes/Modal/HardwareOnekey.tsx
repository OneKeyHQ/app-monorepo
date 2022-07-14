import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyHardwareConfirm from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConfirm';
import OnekeyHardwareConnect from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConnect';
import OnekeyHardwareDetails from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareDetails';
import OnekeyHardwarePinCode from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwarePinCode';
import OnekeyHardwareVerify from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareVerify';

import createStackNavigator from './createStackNavigator';

export enum OnekeyHardwareModalRoutes {
  OnekeyHardwareDetailsModal = 'OnekeyHardwareDetailsModal',
  OnekeyHardwareVerifyModal = 'OnekeyHardwareVerifyModal',
  OnekeyHardwareConnectModal = 'OnekeyHardwareConnectModal',
  OnekeyHardwarePinCodeModal = 'OnekeyHardwarePinCodeModal',
  OnekeyHardwareConfirmModal = 'OnekeyHardwareConfirmModal',
}

export type OnekeyHardwareRoutesParams = {
  [OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal]: {
    walletId: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal]: {
    walletId: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal]: {
    walletId: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwarePinCodeModal]: {
    type: string | null | undefined;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareConfirmModal]: {
    type: string | null | undefined;
  };
};

const OnekeyHardwareNavigator =
  createStackNavigator<OnekeyHardwareRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal,
    component: OnekeyHardwareDetails,
  },
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal,
    component: OnekeyHardwareVerify,
  },
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal,
    component: OnekeyHardwareConnect,
  },
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwarePinCodeModal,
    component: OnekeyHardwarePinCode,
  },
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareConfirmModal,
    component: OnekeyHardwareConfirm,
  },
];

const OnekeyHardwareModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyHardwareNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyHardwareNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyHardwareNavigator.Navigator>
  );
};

export default OnekeyHardwareModalStack;
