import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import CreateInvoice from '@onekeyhq/kit/src/views/LightningNetwork/pages/CreateInvoice';

import { QrCode } from '../pages';

import { EModalReceiveRoutes } from './type';

import type { IModalReceiveParamList } from './type';

export const ModalReceiveStack: IModalFlowNavigatorConfig<
  EModalReceiveRoutes,
  IModalReceiveParamList
>[] = [
  {
    name: EModalReceiveRoutes.QrCode,
    component: QrCode,
  },
  {
    name: EModalReceiveRoutes.LightningCreateInvoice,
    component: CreateInvoice,
  },
];
