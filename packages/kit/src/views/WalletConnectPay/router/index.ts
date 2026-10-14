import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalWalletConnectPayParamList } from '@onekeyhq/shared/src/routes';
import { EModalWalletConnectPayRoutes } from '@onekeyhq/shared/src/routes';

// The payment flow itself is not a route: WalletConnectPayDialogContainer
// renders WcPayDialogFlow from wcPayDialogStore. Only the compliance form
// (a full-screen page the flow parks behind) lives in this modal stack.
const DataCollectionModal = LazyLoadPage(() =>
  import('../pages/DataCollectionModal').then((m) => ({
    default: m.DataCollectionModal,
  })),
);

export const WalletConnectPayModalRouter: IModalFlowNavigatorConfig<
  EModalWalletConnectPayRoutes,
  IModalWalletConnectPayParamList
>[] = [
  {
    name: EModalWalletConnectPayRoutes.DataCollection,
    component: DataCollectionModal,
  },
];
