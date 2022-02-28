import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import CreateWallet from '@onekeyhq/kit/src/views/CreateWallet';
import AppWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/AppWallet';
import AppWalletDone from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Done';
import RestoreFromMnemonic from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/RestoreFromMnemonic';
import RestoreWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/RestoreWallet';
import ConnectHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/ConnectHardware';
import DeviceStatusCheck from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/DeviceStatusCheck';
import RestoreHardwareWallet from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWallet';
import RestoreHardwareWalletDescription from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWalletDescription';
import SetupHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupHardware';
import SetupNewDevice from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupNewDevice';
import SetupSuccess from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupSuccess';

export enum CreateWalletModalRoutes {
  CreateWalletModal = 'CreateWalletModal',
  ConnectHardwareModal = 'ConnectHardwareModal',
  AppWalletModal = 'AppWalletModal',
  AppWalletDoneModal = 'AppWalletDoneModal',
  RestoreWalletModal = 'RestoreWalletModal',
  RestoreFromMnemonicModal = 'RestoreFromMnemonicModal',
  SetupSuccessModal = 'SetupSuccessModal',
  SetupHardwareModal = 'SetupHardwareModal',
  SetupNewDeviceModal = 'SetupNewDeviceModal',
  DeviceStatusCheckModal = 'DeviceStatusCheckModal',
  RestoreHardwareWalletModal = 'RestoreHardwareWalletModal',
  RestoreHardwareWalletDescriptionModal = 'RestoreHardwareWalletDescriptionModal',
}

export type CreateWalletRoutesParams = {
  [CreateWalletModalRoutes.CreateWalletModal]: undefined;
  [CreateWalletModalRoutes.ConnectHardwareModal]: undefined;
  [CreateWalletModalRoutes.AppWalletModal]: undefined;
  [CreateWalletModalRoutes.AppWalletDoneModal]: undefined;
  [CreateWalletModalRoutes.RestoreWalletModal]: undefined;
  [CreateWalletModalRoutes.RestoreFromMnemonicModal]: undefined;
  [CreateWalletModalRoutes.SetupSuccessModal]?: { deviceName?: string };
  [CreateWalletModalRoutes.SetupHardwareModal]?: { deviceName?: string };
  [CreateWalletModalRoutes.SetupNewDeviceModal]: undefined;
  [CreateWalletModalRoutes.DeviceStatusCheckModal]: undefined;
  [CreateWalletModalRoutes.RestoreHardwareWalletModal]: undefined;
  [CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal]: undefined;
};

const CreateWalletNavigator = createStackNavigator<CreateWalletRoutesParams>();

const modalRoutes = [
  {
    name: CreateWalletModalRoutes.CreateWalletModal,
    component: CreateWallet,
  },
  {
    name: CreateWalletModalRoutes.ConnectHardwareModal,
    component: ConnectHardware,
  },
  {
    name: CreateWalletModalRoutes.AppWalletModal,
    component: AppWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreWalletModal,
    component: RestoreWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreFromMnemonicModal,
    component: RestoreFromMnemonic,
  },
  {
    name: CreateWalletModalRoutes.SetupSuccessModal,
    component: SetupSuccess,
  },
  {
    name: CreateWalletModalRoutes.SetupHardwareModal,
    component: SetupHardware,
  },
  {
    name: CreateWalletModalRoutes.SetupNewDeviceModal,
    component: SetupNewDevice,
  },
  {
    name: CreateWalletModalRoutes.DeviceStatusCheckModal,
    component: DeviceStatusCheck,
  },
  {
    name: CreateWalletModalRoutes.RestoreHardwareWalletModal,
    component: RestoreHardwareWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal,
    component: RestoreHardwareWalletDescription,
  },
  {
    name: CreateWalletModalRoutes.AppWalletDoneModal,
    component: AppWalletDone,
  },
];

const CreateWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CreateWalletNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <CreateWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </CreateWalletNavigator.Navigator>
  );
};

export default CreateWalletModalStack;
