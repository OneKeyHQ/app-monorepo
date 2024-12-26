import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalSignatureConfirmParamList } from '@onekeyhq/shared/src/routes';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const TxConfirmModal = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/SignatureConfirm/pages/TxConfirm/TxConfirm'
    ),
);

export const ModalSignatureConfirmStack: IModalFlowNavigatorConfig<
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList
>[] = [
  {
    name: EModalSignatureConfirmRoutes.TxConfirm,
    component: TxConfirmModal,
  },
];
