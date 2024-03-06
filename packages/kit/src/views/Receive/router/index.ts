import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { CreateInvoice } from '../pages/CreateInvoice';
import { ReceiveInvoice } from '../pages/ReceiveInvoice';
import { ReceiveToken } from '../pages/ReceiveToken';

import { EModalReceiveRoutes } from './type';

import type { IModalReceiveParamList } from './type';

export const ModalReceiveStack: IModalFlowNavigatorConfig<
  EModalReceiveRoutes,
  IModalReceiveParamList
>[] = [
  {
    name: EModalReceiveRoutes.ReceiveToken,
    component: ReceiveToken,
  },
  {
    name: EModalReceiveRoutes.CreateInvoice,
    component: CreateInvoice,
  },
  {
    name: EModalReceiveRoutes.ReceiveInvoice,
    component: ReceiveInvoice,
  },
];
