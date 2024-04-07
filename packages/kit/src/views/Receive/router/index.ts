import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';

import { CreateInvoice } from '../pages/CreateInvoice';
import { ReceiveInvoice } from '../pages/ReceiveInvoice';
import { ReceiveToken } from '../pages/ReceiveToken';

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
