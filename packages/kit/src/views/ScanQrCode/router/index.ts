import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { ScanQrCodeModal } from '../pages/ScanQrCodeModal';

import { EScanQrCodeModalPages } from './type';

import type { IScanQrCodeModalParamList } from './type';

export const ScanQrCodeModalRouter: IModalFlowNavigatorConfig<
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList
>[] = [
  {
    name: EScanQrCodeModalPages.ScanQrCodeModal,
    component: ScanQrCodeModal,
  },
];
