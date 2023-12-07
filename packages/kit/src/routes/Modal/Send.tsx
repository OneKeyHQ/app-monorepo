import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import {
  SendAddressInput,
  SendAmountInput,
  SendAssetInput,
  SendConfirm,
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
    component: SendAssetInput,
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
    component: SendConfirm,
  },
  {
    name: EModalSendRoutes.SendProgress,
    component: SendProgress,
  },
];
