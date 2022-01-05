import CreateAccountModal, { CreateAccountModalRoutes } from './CreateAccount';
import ManageNetworkModal, { ManageNetworkModalRoutes } from './ManageNetwork';
import ReceiveQRCodeModal, { ReceiveQRCodeModalRoutes } from './ReceiveToken';
import SendTokenModal, { SendTokenModalRoutes } from './SendToken';
import TransactionModal, { TransactionModalRoutes } from './Transaction';
import TransactionDetailModal, {
  TransactionDetailModalRoutes,
} from './TransactionDetail';

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

export default modalStackScreenList;
