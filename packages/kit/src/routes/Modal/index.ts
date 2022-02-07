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
  ManageTokenModalRoutes,
  ManageTokenRoutesParams,
} from './ManageToken';
import MiscModal, { MiscModalRoutes, MiscRoutesParams } from './Misc';
import ReceiveToken, {
  ReceiveTokenRoutes,
  ReceiveTokenRoutesParams,
} from './ReceiveToken';
import Send, { SendRoutes, SendRoutesParams } from './Send';
import SettingsModal, {
  SettingsModalRoutes,
  SettingsRoutesParams,
} from './Settings';
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
    name: CreateAccountModalRoutes.CreateAccountForm,
    component: CreateAccountModal,
  },
  {
    name: ModalNavigatorRoutes.ReceiveTokenNavigator,
    component: ReceiveToken,
  },
  {
    name: ModalNavigatorRoutes.SendNavigator,
    component: Send,
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
    name: SubmitRequestRoutes.SubmitRequestModal,
    component: SubmitRequestModal,
  },
  {
    name: HistoryRequestRoutes.HistoryRequestModal,
    component: HistoryRequestModal,
  },
  {
    name: BackupWalletModalRoutes.BackupSeedHintModal,
    component: BackupWalletModal,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
    component: HardwareOnekeyModal,
  },
  {
    name: OnekeyLiteResetModalRoutes.OnekeyLiteResetModal,
    component: HardwareOnekeyResetModal,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal,
    component: HardwareOnekeyLitePinModal,
  },
  {
    name: MiscModalRoutes.TermsModal,
    component: MiscModal,
  },
];

export const ModalRoutes = {
  ...CreateAccountModalRoutes,
  ...ReceiveTokenRoutes,
  ...SendRoutes,
  ...ManageNetworkModalRoutes,
  ...TransactionDetailModalRoutes,
  ...ImportAccountModalRoutes,
  ...WatchedAccountModalRoutes,
  ...CollectiblesModalRoutes,
  ...SettingsModalRoutes,
  ...BackupWalletModalRoutes,
  ...SubmitRequestRoutes,
  ...HistoryRequestRoutes,
  ...OnekeyLiteModalRoutes,
  ...OnekeyLiteResetModalRoutes,
  ...OnekeyLiteChangePinModalRoutes,
};

export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ManageNetworkModalRoutes.NetworkListViewModal]: NavigatorScreenParams<ManageNetworkRoutesParams>;
  [ModalNavigatorRoutes.ReceiveTokenNavigator]: NavigatorScreenParams<ReceiveTokenRoutesParams>;
  [ModalNavigatorRoutes.SendNavigator]: NavigatorScreenParams<SendRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
  [ImportAccountModalRoutes.ImportAccountModal]: NavigatorScreenParams<ImportAccountRoutesParams>;
  [WatchedAccountModalRoutes.WatchedAccountModal]: NavigatorScreenParams<WatchedAccountRoutesParams>;
  [ManageTokenModalRoutes.ListTokensModal]: NavigatorScreenParams<ManageTokenRoutesParams>;
  [CollectiblesModalRoutes.CollectionModal]: NavigatorScreenParams<CollectiblesRoutesParams>;
  [SettingsModalRoutes.SetPasswordModal]: NavigatorScreenParams<SettingsRoutesParams>;
  [BackupWalletModalRoutes.BackupSeedHintModal]: NavigatorScreenParams<BackupWalletRoutesParams>;
  [SubmitRequestRoutes.SubmitRequestModal]: NavigatorScreenParams<SubmitRequestModalRoutesParams>;
  [HistoryRequestRoutes.HistoryRequestModal]: NavigatorScreenParams<HistoryRequestModalRoutesParams>;
  [OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal]: NavigatorScreenParams<OnekeyLiteRoutesParams>;
  [OnekeyLiteResetModalRoutes.OnekeyLiteResetModal]: NavigatorScreenParams<OnekeyLiteResetRoutesParams>;
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal]: NavigatorScreenParams<OnekeyLiteChangePinRoutesParams>;
  [MiscModalRoutes.TermsModal]: NavigatorScreenParams<MiscRoutesParams>;
};

export default modalStackScreenList;
