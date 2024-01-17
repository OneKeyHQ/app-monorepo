import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { LightingInvoice, QrCode } from '../pages';

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
    name: EModalReceiveRoutes.LightingInvoice,
    component: LightingInvoice,
  },
];
