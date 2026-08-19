import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalWalletConnectPayParamList } from '@onekeyhq/shared/src/routes';
import { EModalWalletConnectPayRoutes } from '@onekeyhq/shared/src/routes';

const PaymentOptionsModal = LazyLoadPage(() =>
  import('../pages/PaymentOptionsModal').then((m) => ({
    default: m.PaymentOptionsModal,
  })),
);
const DataCollectionModal = LazyLoadPage(() =>
  import('../pages/DataCollectionModal').then((m) => ({
    default: m.DataCollectionModal,
  })),
);
const PaymentResultModal = LazyLoadPage(() =>
  import('../pages/PaymentResultModal').then((m) => ({
    default: m.PaymentResultModal,
  })),
);

export const WalletConnectPayModalRouter: IModalFlowNavigatorConfig<
  EModalWalletConnectPayRoutes,
  IModalWalletConnectPayParamList
>[] = [
  {
    name: EModalWalletConnectPayRoutes.PaymentOptions,
    component: PaymentOptionsModal,
  },
  {
    name: EModalWalletConnectPayRoutes.DataCollection,
    component: DataCollectionModal,
  },
  {
    name: EModalWalletConnectPayRoutes.PaymentResult,
    component: PaymentResultModal,
  },
];
