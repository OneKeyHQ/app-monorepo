/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { ModalRoutes, ModalRoutesParams } from '../types';

import AddressBookModal from './AddressBook';
import BackupWalletModal from './BackupWallet';
import CollectibleModal from './Collectibles';
import CreateAccountModal from './CreateAccount';
import CreateWalletModalStack from './CreateWallet';
import DappConnectionStack from './DappConnection';
import DiscoverModal from './Discover';
import EnableLocalAuthenticationModal from './EnableLocalAuthentication';
import BuyModal from './FiatPay';
import OnekeyHardwareModal from './HardwareOnekey';
import HardwareOnekeyLitePinModal from './HardwareOnekeyLiteChangePin';
import HardwareOnekeyResetModal from './HardwareOnekeyLiteReset';
import HardwareUpdateModal from './HardwareUpdate';
import HistoryRequestModal from './HistoryRequest';
import ImportBackupPassword from './ImportBackupPassword';
import ManageNetworkModal from './ManageNetwork';
import { ManagerAccountModalStack as ManagerAccountModal } from './ManagerAccount';
import { ManagerWalletModalStack as ManagerWalletModal } from './ManagerWallet';
import ManageTokenModal from './ManageToken';
import PasswordModal from './Password';
import ReceiveToken from './ReceiveToken';
import ScanQrcode from './ScanQrcode';
import Send from './Send';
import StakingModal from './Staking';
import SubmitRequestModal from './SubmitRequest';
import SwapModal from './Swap';
import TransactionDetailModal from './TransactionDetail';
import UpdateFeatureModal from './UpdateFeature';

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
    name: ModalRoutes.DappConnectionModal,
    component: DappConnectionStack,
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
    name: ModalRoutes.HardwareUpdate,
    component: HardwareUpdateModal,
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
  {
    name: ModalRoutes.FiatPay,
    component: BuyModal,
  },
  {
    name: ModalRoutes.AddressBook,
    component: AddressBookModal,
  },
  {
    name: ModalRoutes.ImportBackupPassword,
    component: ImportBackupPassword,
  },
  {
    name: ModalRoutes.Staking,
    component: StakingModal,
  },
];

const ModalStack = createStackNavigator<ModalRoutesParams>();

const ModalStackNavigator = () => (
  <RootSiblingParent>
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
  </RootSiblingParent>
);

export default memo(ModalStackNavigator);
