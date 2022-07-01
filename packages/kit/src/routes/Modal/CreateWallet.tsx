import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { UserInputCheckResult } from '@onekeyhq/engine/src/types/credential';
import { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import CreateWallet from '@onekeyhq/kit/src/views/CreateWallet';
import AddImportedAccountDone from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedAccountDone';
import AddImportedOrWatchingAccount from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedOrWatchingAccount';
import AddExistingWallet from '@onekeyhq/kit/src/views/CreateWallet/AddExistingWallet';
import AttentionsView from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/AttentionsView';
import AppWalletDone from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Done';
import Mnemonic from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Mnemonic';
import NewWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/NewWallet';
import Guide from '@onekeyhq/kit/src/views/CreateWallet/Guide';
import ConnectHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/ConnectHardware';
import DeviceStatusCheck from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/DeviceStatusCheck';
import RestoreHardwareWallet from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWallet';
import RestoreHardwareWalletDescription from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWalletDescription';
import SetupHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupHardware';
import SetupNewDevice, {
  SetupNewDeviceType,
} from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupNewDevice';
import SetupSuccess from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupSuccess';
import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLiteBackupPinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode/BackupPinCodeVerify';
import OnekeyLiteRestorePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode/RestorePinCodeVerify';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import OnekeyLiteRestoreDoneView from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore/Done';
import type {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

import createStackNavigator from './createStackNavigator';

export enum CreateWalletModalRoutes {
  CreateWalletModal = 'CreateWalletModal',
  ConnectHardwareModal = 'ConnectHardwareModal',
  AppWalletDoneModal = 'AppWalletDoneModal',
  SetupSuccessModal = 'SetupSuccessModal',
  SetupHardwareModal = 'SetupHardwareModal',
  SetupNewDeviceModal = 'SetupNewDeviceModal',
  DeviceStatusCheckModal = 'DeviceStatusCheckModal',
  RestoreHardwareWalletModal = 'RestoreHardwareWalletModal',
  RestoreHardwareWalletDescriptionModal = 'RestoreHardwareWalletDescriptionModal',

  CreateWatchedAccount = 'CreateWatchedAccount',
  CreateImportedAccount = 'CreateImportedAccount',

  // Onekey Lite backup
  OnekeyLiteRestorePinCodeVerifyModal = 'OnekeyLiteRestorePinCodeVerifyModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteRestoreDoneModal = 'OnekeyLiteRestoreDoneModal',
  OnekeyLiteBackupPinCodeVerifyModal = 'OnekeyLiteBackupPinCodeVerifyModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',

  AddExistingWalletModal = 'AddExistingWalletModal',
  GuideModal = 'GuideModal',
  AddImportedOrWatchingAccountModal = 'AddImportedOrWatchingAccountModal',
  AddImportedAccountDoneModal = 'AddImportedAccountDoneModal',
  AttentionsModal = 'AttentionsModal',
  MnemonicModal = 'MnemonicModal',
  NewWalletModal = 'NewWalletModal',
}

export type CreateWalletRoutesParams = {
  [CreateWalletModalRoutes.CreateWalletModal]: undefined;
  [CreateWalletModalRoutes.ConnectHardwareModal]: undefined;
  [CreateWalletModalRoutes.AttentionsModal]: {
    password: string;
    withEnableAuthentication?: boolean;
  };
  [CreateWalletModalRoutes.MnemonicModal]: {
    password: string;
    withEnableAuthentication?: boolean;
    mnemonic: string;
  };
  [CreateWalletModalRoutes.NewWalletModal]: undefined;
  [CreateWalletModalRoutes.AppWalletDoneModal]:
    | { mnemonic?: string }
    | undefined;
  [CreateWalletModalRoutes.SetupSuccessModal]: { device: SearchDevice };
  [CreateWalletModalRoutes.SetupHardwareModal]: { device: SearchDevice };
  [CreateWalletModalRoutes.SetupNewDeviceModal]: {
    device: SearchDevice;
    type: SetupNewDeviceType;
  };
  [CreateWalletModalRoutes.DeviceStatusCheckModal]: { device: SearchDevice };
  [CreateWalletModalRoutes.RestoreHardwareWalletModal]: {
    device: SearchDevice;
  };
  [CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal]: {
    device: SearchDevice;
  };
  [CreateWalletModalRoutes.CreateImportedAccount]: undefined;
  [CreateWalletModalRoutes.CreateWatchedAccount]: undefined;
  [CreateWalletModalRoutes.AddExistingWalletModal]: {
    mode: 'all' | 'mnemonic' | 'watching' | 'imported';
    presetText?: string;
  };
  [CreateWalletModalRoutes.AddImportedOrWatchingAccountModal]: {
    text: string;
    checkResults: Array<UserInputCheckResult>;
  };
  [CreateWalletModalRoutes.AddImportedAccountDoneModal]: {
    privatekey: string;
    networkId: string;
    name: string;
  };
  [CreateWalletModalRoutes.GuideModal]: undefined;

  // Onekey Lite Backup & Restore
  [CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestorePinCodeVerifyModal];
  [CreateWalletModalRoutes.OnekeyLiteRestoreModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestoreModal];
  [CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestoreDoneModal];
  [CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteBackupPinCodeVerifyModal];
  [CreateWalletModalRoutes.OnekeyLiteBackupModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteBackupModal];
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

  // Onekey Lite backup
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
    component: OnekeyLiteRestorePinCode,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestoreModal,
    component: OnekeyLiteRestore,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
    component: OnekeyLiteRestoreDoneView,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
    component: OnekeyLiteBackupPinCode,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteBackupModal,
    component: OnekeyLiteBackup,
  },
  {
    name: CreateWalletModalRoutes.AddExistingWalletModal,
    component: AddExistingWallet,
  },
  {
    name: CreateWalletModalRoutes.GuideModal,
    component: Guide,
  },
  {
    name: CreateWalletModalRoutes.AddImportedOrWatchingAccountModal,
    component: AddImportedOrWatchingAccount,
  },
  {
    name: CreateWalletModalRoutes.AddImportedAccountDoneModal,
    component: AddImportedAccountDone,
  },
  {
    name: CreateWalletModalRoutes.AttentionsModal,
    component: AttentionsView,
  },
  {
    name: CreateWalletModalRoutes.MnemonicModal,
    component: Mnemonic,
  },
  {
    name: CreateWalletModalRoutes.NewWalletModal,
    component: NewWallet,
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
