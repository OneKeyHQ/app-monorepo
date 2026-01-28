import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalBulkSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalBulkSendParamList } from '@onekeyhq/shared/src/routes';

const BulkSendAddressesInput = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAddressesInput'),
);
const BulkSendAmountsInput = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAmountsInput'),
);
const BulkSendReview = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendReview'),
);
export const BulkSendModalRouter: IModalFlowNavigatorConfig<
  EModalBulkSendRoutes,
  IModalBulkSendParamList
>[] = [
  {
    name: EModalBulkSendRoutes.BulkSendAddressesInput,
    component: BulkSendAddressesInput,
  },
  {
    name: EModalBulkSendRoutes.BulkSendAmountsInput,
    component: BulkSendAmountsInput,
  },
  {
    name: EModalBulkSendRoutes.BulkSendReview,
    component: BulkSendReview,
  },
];
