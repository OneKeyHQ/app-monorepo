import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { EScanQrCodeModalPages } from './type';

import type { IScanQrCodeModalParamList } from './type';

const ScanQrCodeModal = LazyLoadPage(() => import('../pages/ScanQrCodeModal'));

export const ScanQrCodeModalRouter: IModalFlowNavigatorConfig<
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList
>[] = [
  {
    name: EScanQrCodeModalPages.ScanQrCodeStack,
    component: ScanQrCodeModal,
  },
];
