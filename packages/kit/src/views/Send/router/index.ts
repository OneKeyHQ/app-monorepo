import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { SendConfirmWithProvider } from '@onekeyhq/kit/src/views/Send';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const SendDataInput = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Send/pages/SendDataInput/SendDataInputContainer'
    ),
);

const SendReplaceTx = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Send/pages/SendReplaceTx/SendReplaceTxContainer'
    ),
);

const TokenSelector = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AssetSelector/pages/TokenSelector'),
);

const DeriveTypesAddress = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/WalletAddress/pages/DeriveTypesAddress'),
);

const SendConfirmFromDApp = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Send/pages/SendConfirmFromDApp/SendConfirmFromDApp'
    ),
);

const SendConfirmFromSwap = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Send/pages/SendConfirmFromSwap/SendConfirmFromSwap'
    ),
);

export const ModalSendStack: IModalFlowNavigatorConfig<
  EModalSendRoutes,
  IModalSendParamList
>[] = [
  {
    name: EModalSendRoutes.SendDataInput,
    component: SendDataInput,
  },
  {
    name: EModalSendRoutes.SendConfirm,
    component: SendConfirmWithProvider,
  },
  {
    name: EModalSendRoutes.SendConfirmFromDApp,
    component: SendConfirmFromDApp,
  },
  {
    name: EModalSendRoutes.SendConfirmFromSwap,
    component: SendConfirmFromSwap,
  },
  {
    name: EModalSendRoutes.SendReplaceTx,
    component: SendReplaceTx,
  },
  // TODO: The following two pages seem to not be referenced anywhere, consider removing them
  {
    name: EModalSendRoutes.SendSelectToken,
    component: TokenSelector,
  },
  {
    name: EModalSendRoutes.SendSelectDeriveAddress,
    component: DeriveTypesAddress,
  },
];
