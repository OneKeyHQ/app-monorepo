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

const LnurlPayRequestModal = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlPayRequestModal'
    ),
);

const LnurlWithdrawModal = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlWithdrawModal'
    ),
);

const LnurlAuthModal = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlAuthModal'
    ),
);

const WeblnSendPaymentModal = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/LightningNetwork/pages/Webln/WeblnSendPaymentModal'
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
  {
    name: EModalSendRoutes.LnurlPayRequest,
    component: LnurlPayRequestModal,
  },
  {
    name: EModalSendRoutes.LnurlWithdraw,
    component: LnurlWithdrawModal,
  },
  {
    name: EModalSendRoutes.LnurlAuth,
    component: LnurlAuthModal,
  },
  {
    name: EModalSendRoutes.SendSelectToken,
    component: TokenSelector,
  },
  {
    name: EModalSendRoutes.SendSelectDeriveAddress,
    component: DeriveTypesAddress,
  },
];
