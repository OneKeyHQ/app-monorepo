import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import {
  SendConfirmWithProvider,
  SendDataInputWithProvider,
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
];
