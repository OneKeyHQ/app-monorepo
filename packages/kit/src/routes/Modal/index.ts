import CreateAccountModal, {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from './CreateAccount';
import ManageNetworkModal, {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from './ManageNetwork';
import ReceiveQRCodeModal, {
  ReceiveQRCodeModalRoutes,
  ReceiveQRCodeRoutesParams,
} from './ReceiveToken';
import SendTokenModal, {
  SendTokenModalRoutes,
  SendTokenRoutesParams,
} from './SendToken';
import TransactionModal, {
  TransactionModalRoutes,
  TransactionModalRoutesParams,
} from './Transaction';
import TransactionDetailModal, {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from './TransactionDetail';

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
    name: SendTokenModalRoutes.SendTokenModal,
    component: SendTokenModal,
  },
  {
    name: TransactionModalRoutes.TransactionModal,
    component: TransactionModal,
  },
  {
    name: ManageNetworkModalRoutes.ManageNetworkModal,
    component: ManageNetworkModal,
  },
  {
    name: TransactionDetailModalRoutes.TransactionDetailModal,
    component: TransactionDetailModal,
  },
];

export const ModalRoutes = {
  ...CreateAccountModalRoutes,
  ...ReceiveQRCodeModalRoutes,
  ...SendTokenModalRoutes,
  ...TransactionModalRoutes,
  ...ManageNetworkModalRoutes,
  ...TransactionDetailModalRoutes,
};

export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ManageNetworkModalRoutes.ManageNetworkModal]: NavigatorScreenParams<ManageNetworkRoutesParams>;
  [ReceiveQRCodeModalRoutes.ReceiveQRCodeModal]: NavigatorScreenParams<ReceiveQRCodeRoutesParams>;
  [SendTokenModalRoutes.SendTokenModal]: NavigatorScreenParams<SendTokenRoutesParams>;
  [TransactionModalRoutes.TransactionModal]: NavigatorScreenParams<TransactionModalRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
};

export default modalStackScreenList;
