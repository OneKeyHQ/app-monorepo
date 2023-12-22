import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { QrCode } from '../pages';

import { EReceivePages } from './type';

import type { IReceiveParamList } from './type';

export const ReceiveRouter: IModalFlowNavigatorConfig<
  EReceivePages,
  IReceiveParamList
>[] = [
  {
    name: EReceivePages.QrCode,
    component: QrCode,
  },
];
