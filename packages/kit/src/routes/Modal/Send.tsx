import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import {
  SendAddressInput,
  SendAddressInputWithProvider,
  SendAmountInput,
  SendConfirmWithProvider,
  SendCustomFee,
  SendProgress,
} from '@onekeyhq/kit/src/views/Send';
import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';
import type { IModalSendParamList } from '@onekeyhq/kit/src/views/Send/router';

export const ModalSendStack: IModalFlowNavigatorConfig<
  EModalSendRoutes,
  IModalSendParamList
>[] = [
  {
    name: EModalSendRoutes.SendAssetInput,
    component: SendAddressInputWithProvider,
  },
  {
    name: EModalSendRoutes.SendAddressInput,
    component: SendAddressInput,
  },
  {
    name: EModalSendRoutes.SendAmountInput,
    component: SendAmountInput,
  },
  {
    name: EModalSendRoutes.SendConfirm,
    component: SendConfirmWithProvider,
  },
  {
    name: EModalSendRoutes.SendProgress,
    component: SendProgress,
  },
  {
    name: EModalSendRoutes.SendCustomFee,
    component: SendCustomFee,
  },
];
