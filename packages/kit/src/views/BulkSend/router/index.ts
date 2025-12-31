import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalBulkSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalBulkSendParamList } from '@onekeyhq/shared/src/routes';

const BulkSendAddressesInput = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAddressesInput'),
);
export const BulkSendModalRouter: IModalFlowNavigatorConfig<
  EModalBulkSendRoutes,
  IModalBulkSendParamList
>[] = [
  {
    name: EModalBulkSendRoutes.BulkSendAddressesInput,
    component: BulkSendAddressesInput,
  },
];
