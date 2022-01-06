import CreateAccountModal, {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from './CreateAccount';
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
];

export const ModalRoutes = {
  ...CreateAccountModalRoutes,
  ...ReceiveQRCodeModalRoutes,
  ...TransactionModalRoutes,
  ...ManageNetworkModalRoutes,
  ...TransactionDetailModalRoutes,
  ...ImportAccountModalRoutes,
  ...WatchedAccountModalRoutes,
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
};

export default modalStackScreenList;
