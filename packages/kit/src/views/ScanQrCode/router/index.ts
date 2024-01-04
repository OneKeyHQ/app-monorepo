import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EScanQrCodeModalPages } from './type';

import type { IScanQrCodeModalParamList } from './type';

const ScanQrCodeModal = LazyLoad(() => import('../pages/ScanQrCodeModal'));

export const ScanQrCodeModalRouter: IModalFlowNavigatorConfig<
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList
>[] = [
  {
    name: EScanQrCodeModalPages.ScanQrCodeModal,
    component: ScanQrCodeModal,
  },
];
