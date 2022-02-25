/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';

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
import DappSendStack, {
  DappSendModalRoutes,
  DappSendRoutesParams,
} from './DappSend';
import DappSignatureStack, {
  DappSignatureModalRoutes,
  DappSignatureRoutesParams,
} from './DappSignature';
import HardwareOnekeyModal, {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from './HardwareOnekeyLite';
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
import ManageNetworkModal, {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from './ManageNetwork';
import ManageTokenModal, {
  ManageTokenRoutes,
  ManageTokenRoutesParams,
} from './ManageToken';
import PasswordModal, {
  PasswordRoutes,
  PasswordRoutesParams,
} from './Password';
import ReceiveToken, {
  ReceiveTokenRoutes,
  ReceiveTokenRoutesParams,
} from './ReceiveToken';
import Send, { SendRoutes, SendRoutesParams } from './Send';
import SubmitRequestModal, {
  SubmitRequestModalRoutesParams,
  SubmitRequestRoutes,
} from './SubmitRequest';
import TransactionDetailModal, {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from './TransactionDetail';
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
    name: ModalRoutes.OnekeyLite,
    component: HardwareOnekeyModal,
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
    name: ModalRoutes.DappSendConfirmModal,
    component: DappSendStack,
  },
  {
    name: ModalRoutes.DappSignatureModal,
    component: DappSignatureStack,
  },
  {
    name: ModalRoutes.Collectibles,
    component: CollectibleModal,
  },
  {
    name: ModalRoutes.CreateWallet,
    component: CreateWalletModalStack,
  },
];

// ModalTypes will be delete later, don't update it
export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ManageNetworkModalRoutes.NetworkListViewModal]: NavigatorScreenParams<ManageNetworkRoutesParams>;
  [ModalNavigatorRoutes.ReceiveTokenNavigator]: NavigatorScreenParams<ReceiveTokenRoutesParams>;
  [ModalNavigatorRoutes.SendNavigator]: NavigatorScreenParams<SendRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
  [ImportAccountModalRoutes.ImportAccountModal]: NavigatorScreenParams<ImportAccountRoutesParams>;
  [WatchedAccountModalRoutes.WatchedAccountModal]: NavigatorScreenParams<WatchedAccountRoutesParams>;
  [CollectiblesModalRoutes.CollectionModal]: NavigatorScreenParams<CollectiblesRoutesParams>;
  [PasswordRoutes.PasswordRoutes]: NavigatorScreenParams<PasswordRoutesParams>;
  [BackupWalletModalRoutes.BackupSeedHintModal]: NavigatorScreenParams<BackupWalletRoutesParams>;
  [SubmitRequestRoutes.SubmitRequestModal]: NavigatorScreenParams<SubmitRequestModalRoutesParams>;
  [HistoryRequestRoutes.HistoryRequestModal]: NavigatorScreenParams<HistoryRequestModalRoutesParams>;
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal]: NavigatorScreenParams<OnekeyLiteRoutesParams>;
  [CreateWalletModalRoutes.CreateWalletModal]: NavigatorScreenParams<CreateWalletRoutesParams>;
  [DappApproveModalRoutes.ApproveModal]: NavigatorScreenParams<DappApproveRoutesParams>;
  [DappConnectionModalRoutes.ConnectionModal]: NavigatorScreenParams<DappConnectionRoutesParams>;
  [DappMulticallModalRoutes.MulticallModal]: NavigatorScreenParams<DappMulticallRoutesParams>;
  [DappSendModalRoutes.SendConfirmModal]: NavigatorScreenParams<DappSendRoutesParams>;
  [DappSignatureModalRoutes.SignatureModal]: NavigatorScreenParams<DappSignatureRoutesParams>;
};

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => (
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
);

export default memo(ModalStackNavigator);
