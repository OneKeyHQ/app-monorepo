import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import {
  SendConfirmWithProvider,
  SendDataInputWithProvider,
  SendReplaceTx,
} from '@onekeyhq/kit/src/views/Send';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { SendConfirmFromDApp } from '../pages/SendConfirmFromDApp/SendConfirmFromDApp';

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

export const ModalSendStack: IModalFlowNavigatorConfig<
  EModalSendRoutes,
  IModalSendParamList
>[] = [
  {
    name: EModalSendRoutes.SendDataInput,
    component: SendDataInputWithProvider,
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
    name: EModalSendRoutes.WeblnSendPayment,
    component: WeblnSendPaymentModal,
  },
];
