/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { DialogManager } from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ModalRoutes, ModalRoutesParams } from '../types';

import BackupWalletModal, {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from './BackupWallet';
import CollectibleModal, {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from './Collectibles';
import CreateAccountModal, {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from './CreateAccount';
import CreateWalletModalStack, {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from './CreateWallet';
import DappApproveStack, {
  DappApproveModalRoutes,
  DappApproveRoutesParams,
} from './DappApprove';
import DappConnectionStack, {
  DappConnectionModalRoutes,
  DappConnectionRoutesParams,
} from './DappConnection';
import DappMulticallStack, {
  DappMulticallModalRoutes,
  DappMulticallRoutesParams,
} from './DappMulticall';
import DiscoverModal from './Discover';
import EnableLocalAuthenticationModal from './EnableLocalAuthentication';
import OnekeyHardwareModal, {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from './HardwareOnekey';
import HardwareOnekeyLitePinModal, {
  OnekeyLiteChangePinModalRoutes,
  OnekeyLiteChangePinRoutesParams,
} from './HardwareOnekeyLiteChangePin';
import HardwareOnekeyResetModal, {
  OnekeyLiteResetModalRoutes,
  OnekeyLiteResetRoutesParams,
} from './HardwareOnekeyLiteReset';
import HistoryRequestModal, {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from './HistoryRequest';
import ImportAccountModal, {
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
} from './ImportAccount';
import ManageNetworkModal from './ManageNetwork';
import {
  ManagerAccountModalStack as ManagerAccountModal,
  ManagerAccountModalRoutes,
  ManagerAccountRoutesParams,
} from './ManagerAccount';
import {
  ManagerWalletModalStack as ManagerWalletModal,
  ManagerWalletModalRoutes,
  ManagerWalletRoutesParams,
} from './ManagerWallet';
import ManageTokenModal from './ManageToken';
import PasswordModal, {
  PasswordRoutes,
  PasswordRoutesParams,
} from './Password';
import ReceiveToken, {
  ReceiveTokenRoutes,
  ReceiveTokenRoutesParams,
} from './ReceiveToken';
import ScanQrcode, {
  ScanQrcodeRoutes,
  ScanQrcodeRoutesParams,
} from './ScanQrcode';
import Send, { SendRoutes, SendRoutesParams } from './Send';
import SubmitRequestModal, {
  SubmitRequestModalRoutesParams,
  SubmitRequestRoutes,
} from './SubmitRequest';
import SwapModal from './Swap';
import TransactionDetailModal, {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from './TransactionDetail';
import UpdateFeatureModal from './UpdateFeature';
import WatchedAccountModal, {
  WatchedAccountModalRoutes,
  WatchedAccountRoutesParams,
} from './WatchedAccount';

import type { NavigatorScreenParams } from '@react-navigation/native';

export enum ModalNavigatorRoutes {
  ReceiveTokenNavigator = 'ReceiveTokenNavigator',
  SendNavigator = 'SendNavigator',
}

const modalStackScreenList = [
  {
    name: ModalRoutes.CreateAccount,
    component: CreateAccountModal,
  },
  {
    name: ModalRoutes.Receive,
    component: ReceiveToken,
  },
  {
    name: ModalRoutes.Send,
    component: Send,
  },
  {
    name: ModalRoutes.ScanQrcode,
    component: ScanQrcode,
  },
  {
    name: ModalRoutes.BackupWallet,
    component: BackupWalletModal,
  },
  {
    name: ModalRoutes.TransactionDetail,
    component: TransactionDetailModal,
  },
  {
    name: ModalRoutes.ImportAccount,
    component: ImportAccountModal,
  },
  {
    name: ModalRoutes.WatchedAccount,
    component: WatchedAccountModal,
  },
  {
    name: ModalRoutes.ManageToken,
    component: ManageTokenModal,
  },
  {
    name: ModalRoutes.SubmitRequest,
    component: SubmitRequestModal,
  },
  {
    name: ModalRoutes.HistoryRequest,
    component: HistoryRequestModal,
  },
  {
    name: ModalRoutes.Password,
    component: PasswordModal,
  },
  {
    name: ModalRoutes.OnekeyLiteReset,
    component: HardwareOnekeyResetModal,
  },
  {
    name: ModalRoutes.OnekeyLiteChangePinInputPin,
    component: HardwareOnekeyLitePinModal,
  },
  {
    name: ModalRoutes.DappApproveModal,
    component: DappApproveStack,
  },
  {
    name: ModalRoutes.DappConnectionModal,
    component: DappConnectionStack,
  },
  {
    name: ModalRoutes.DappMulticallModal,
    component: DappMulticallStack,
  },
  {
    name: ModalRoutes.Collectibles,
    component: CollectibleModal,
  },
  {
    name: ModalRoutes.CreateWallet,
    component: CreateWalletModalStack,
  },
  {
    name: ModalRoutes.ManagerWallet,
    component: ManagerWalletModal,
  },
  {
    name: ModalRoutes.ManagerAccount,
    component: ManagerAccountModal,
  },
  {
    name: ModalRoutes.EnableLocalAuthentication,
    component: EnableLocalAuthenticationModal,
  },
  {
    name: ModalRoutes.ManageNetwork,
    component: ManageNetworkModal,
  },
  {
    name: ModalRoutes.OnekeyHardware,
    component: OnekeyHardwareModal,
  },
  {
    name: ModalRoutes.Discover,
    component: DiscoverModal,
  },
  {
    name: ModalRoutes.Swap,
    component: SwapModal,
  },
  {
    name: ModalRoutes.UpdateFeature,
    component: UpdateFeatureModal,
  },
];

// ModalTypes will be delete later, don't update it
export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ModalNavigatorRoutes.ReceiveTokenNavigator]: NavigatorScreenParams<ReceiveTokenRoutesParams>;
  [ModalNavigatorRoutes.SendNavigator]: NavigatorScreenParams<SendRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
  [ImportAccountModalRoutes.ImportAccountModal]: NavigatorScreenParams<ImportAccountRoutesParams>;
  [WatchedAccountModalRoutes.WatchedAccountModal]: NavigatorScreenParams<WatchedAccountRoutesParams>;
  [CollectiblesModalRoutes.CollectionModal]: NavigatorScreenParams<CollectiblesRoutesParams>;
  [PasswordRoutes.PasswordRoutes]: NavigatorScreenParams<PasswordRoutesParams>;
  [SubmitRequestRoutes.SubmitRequestModal]: NavigatorScreenParams<SubmitRequestModalRoutesParams>;
  [HistoryRequestRoutes.HistoryRequestModal]: NavigatorScreenParams<HistoryRequestModalRoutesParams>;
  [CreateWalletModalRoutes.CreateWalletModal]: NavigatorScreenParams<CreateWalletRoutesParams>;
  [ManagerWalletModalRoutes.ManagerWalletModal]: NavigatorScreenParams<ManagerWalletRoutesParams>;
  [ManagerAccountModalRoutes.ManagerAccountModal]: NavigatorScreenParams<ManagerAccountRoutesParams>;
  [DappApproveModalRoutes.ApproveModal]: NavigatorScreenParams<DappApproveRoutesParams>;
  [DappConnectionModalRoutes.ConnectionModal]: NavigatorScreenParams<DappConnectionRoutesParams>;
  [DappMulticallModalRoutes.MulticallModal]: NavigatorScreenParams<DappMulticallRoutesParams>;
};

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => (
  <>
    <ModalStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {modalStackScreenList.map((modal) => (
        <ModalStack.Screen
          key={modal.name}
          name={modal.name}
          component={modal.component}
        />
      ))}
    </ModalStack.Navigator>
    {/* Native Modal must register another for root container */}
    {platformEnv.isIOS && <Toast bottomOffset={60} />}
    {platformEnv.isIOS && <DialogManager.Holder />}
  </>
);

export default memo(ModalStackNavigator);
