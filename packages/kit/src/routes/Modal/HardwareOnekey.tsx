import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OnekeyHardwareConfirm from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConfirm';
import OnekeyHardwareConnect from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareConnect';
import OnekeyHardwareDetails from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareDetails';
import OnekeyHardwareDeviceName from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareDeviceName';
import OnekeyHardwareHomescreen from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareHomescreen';
import OnekeyHardwarePinCode from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwarePinCode';
import OnekeyHardwareVerify from '@onekeyhq/kit/src/views/Hardware/Onekey/OnekeyHardwareVerify';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export enum OnekeyHardwareModalRoutes {
  OnekeyHardwareDetailsModal = 'OnekeyHardwareDetailsModal',
  OnekeyHardwareVerifyModal = 'OnekeyHardwareVerifyModal',
  OnekeyHardwareConnectModal = 'OnekeyHardwareConnectModal',
  OnekeyHardwarePinCodeModal = 'OnekeyHardwarePinCodeModal',
  OnekeyHardwareConfirmModal = 'OnekeyHardwareConfirmModal',
  OnekeyHardwareDeviceNameModal = 'OnekeyHardwareDeviceNameModal',
  OnekeyHardwareHomescreenModal = 'OnekeyHardwareHomescreenModal',
}

export type OnekeyHardwareRoutesParams = {
  [OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal]: {
    walletId: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal]: {
    walletId: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal]: {
    deviceId?: string;
    connectId?: string;
    onHandler?: () => Promise<any>;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwarePinCodeModal]: {
    type: string | null | undefined;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareConfirmModal]: {
    type: string | null | undefined;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal]: {
    walletId: string;
    deviceName: string;
  };
  [OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal]: {
    walletId: string;
    deviceType: IOneKeyDeviceType;
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
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareDeviceNameModal,
    component: OnekeyHardwareDeviceName,
  },
  {
    name: OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal,
    component: OnekeyHardwareHomescreen,
  },
];

const OnekeyHardwareModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyHardwareNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
