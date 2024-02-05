import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import {
  SendConfirmWithProvider,
  SendCustomFee,
  SendDataInput,
} from '@onekeyhq/kit/src/views/Send';
import { EModalSendRoutes } from '@onekeyhq/kit/src/views/Send/router';
import type { IModalSendParamList } from '@onekeyhq/kit/src/views/Send/router';

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
    name: EModalSendRoutes.SendCustomFee,
    component: SendCustomFee,
  },
];
