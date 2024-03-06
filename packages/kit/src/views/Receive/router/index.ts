import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { ReceiveInvoice } from '../pages/ReceiveInvoice';
import { ReceiveToken } from '../pages/ReceiveToken';

import { EModalReceiveRoutes } from './type';

import type { IModalReceiveParamList } from './type';
import CreateInvoice from '../pages/CreateInvoice';

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
