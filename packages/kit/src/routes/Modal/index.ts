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
  ...TransactionModalRoutes,
  ...ManageNetworkModalRoutes,
  ...TransactionDetailModalRoutes,
};

export type ModalTypes = {
  [CreateAccountModalRoutes.CreateAccountForm]: NavigatorScreenParams<CreateAccountRoutesParams>;
  [ManageNetworkModalRoutes.ManageNetworkModal]: NavigatorScreenParams<ManageNetworkRoutesParams>;
  [ReceiveQRCodeModalRoutes.ReceiveQRCodeModal]: NavigatorScreenParams<ReceiveQRCodeRoutesParams>;
  [TransactionModalRoutes.TransactionModal]: NavigatorScreenParams<TransactionModalRoutesParams>;
  [TransactionDetailModalRoutes.TransactionDetailModal]: NavigatorScreenParams<TransactionDetailRoutesParams>;
};

export default modalStackScreenList;
