import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const ReceiveToken = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/ReceiveToken'),
);
const CreateInvoice = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/CreateInvoice'),
);
const ReceiveInvoice = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/ReceiveInvoice'),
);

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
