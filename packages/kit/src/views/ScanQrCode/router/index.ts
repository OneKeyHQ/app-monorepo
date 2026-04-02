import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IScanQrCodeModalParamList } from '@onekeyhq/shared/src/routes';
import { EScanQrCodeModalPages } from '@onekeyhq/shared/src/routes';

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
