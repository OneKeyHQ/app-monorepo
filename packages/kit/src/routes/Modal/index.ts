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
import {
  modalRoutes as OnekeyLiteModalComponents,
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from './HardwareOnekeyLite';
import HelpModal, { HelpModalRoutes, HelpModalRoutesParams } from './Help';
import ImportAccountModal, {
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
} from './ImportAccount';
import ManageNetworkModal, {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from './ManageNetwork';
import ManageTokenModal, {
  ManageTokenModalRoutes,
  ManageTokenRoutesParams,
} from './ManageToken';
import ReceiveQRCodeModal, {
  ReceiveQRCodeModalRoutes,
  ReceiveQRCodeRoutesParams,
} from './ReceiveToken';
import SettingsModal, {
  SettingsModalRoutes,
  SettingsRoutesParams,
} from './Settings';
import TransactionModal, {
  TransactionModalRoutes,
  TransactionModalRoutesParams,
} from './Transaction';
import TransactionDetailModal, {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from './TransactionDetail';
import WatchedAccountModal, {
  WatchedAccountModalRoutes,
  WatchedAccountRoutesParams,
} from './WatchedAccount';

import type { NavigatorScreenParams } from '@react-navigation/native';

const modalStackScreenList = [
  {
    name: CreateAccountModalRoutes.CreateAccountForm,
    component: CreateAccountModal,
  },
  {
    name: ReceiveQRCodeModalRoutes.ReceiveQRCodeModal,
    component: ReceiveQRCodeModal,
  },
  {
    name: TransactionModalRoutes.TransactionModal,
    component: TransactionModal,
  },
  {
    name: ManageNetworkModalRoutes.NetworkListViewModal,
    component: ManageNetworkModal,
  },
  {
    name: TransactionDetailModalRoutes.TransactionDetailModal,
    component: TransactionDetailModal,
  },
  {
    name: ImportAccountModalRoutes.ImportAccountModal,
    component: ImportAccountModal,
  },
  {
    name: WatchedAccountModalRoutes.WatchedAccountModal,
    component: WatchedAccountModal,
  },
  {
    name: ManageTokenModalRoutes.ListTokensModal,
    component: ManageTokenModal,
  },
  {
    name: CollectiblesModalRoutes.CollectionModal,
    component: CollectibleModal,
  },
  {
    name: SettingsModalRoutes.SetPasswordModal,
    component: SettingsModal,
  },
  {
    name: HelpModalRoutes.SubmitRequestModal,
    component: HelpModal,
  },
  {
    name: BackupWalletModalRoutes.BackupSeedHintModal,
    component: BackupWalletModal,
  },
  ...OnekeyLiteModalComponents,
];

export const ModalRoutes = {
  ...CreateAccountModalRoutes,
  ...ReceiveQRCodeModalRoutes,
  ...TransactionModalRoutes,
  ...ManageNetworkModalRoutes,
  ...TransactionDetailModalRoutes,
  ...ImportAccountModalRoutes,
  ...WatchedAccountModalRoutes,
  ...CollectiblesModalRoutes,
  ...SettingsModalRoutes,
  ...HelpModalRoutes,
  ...BackupWalletModalRoutes,
  ...OnekeyLiteModalRoutes,
};

export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ManageNetworkModalRoutes.NetworkListViewModal]: NavigatorScreenParams<ManageNetworkRoutesParams>;
  [ReceiveQRCodeModalRoutes.ReceiveQRCodeModal]: NavigatorScreenParams<ReceiveQRCodeRoutesParams>;
  [TransactionModalRoutes.TransactionModal]: NavigatorScreenParams<TransactionModalRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
  [ImportAccountModalRoutes.ImportAccountModal]: NavigatorScreenParams<ImportAccountRoutesParams>;
  [WatchedAccountModalRoutes.WatchedAccountModal]: NavigatorScreenParams<WatchedAccountRoutesParams>;
  [ManageTokenModalRoutes.ListTokensModal]: NavigatorScreenParams<ManageTokenRoutesParams>;
  [CollectiblesModalRoutes.CollectionModal]: NavigatorScreenParams<CollectiblesRoutesParams>;
  [SettingsModalRoutes.SetPasswordModal]: NavigatorScreenParams<SettingsRoutesParams>;
  [HelpModalRoutes.SubmitRequestModal]: NavigatorScreenParams<HelpModalRoutesParams>;
  [BackupWalletModalRoutes.BackupSeedHintModal]: NavigatorScreenParams<BackupWalletRoutesParams>;
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeCurrentModal]: NavigatorScreenParams<OnekeyLiteRoutesParams>;
};

export default modalStackScreenList;
