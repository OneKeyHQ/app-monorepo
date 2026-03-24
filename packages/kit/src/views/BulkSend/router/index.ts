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
const BulkSendIntervalInput = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendIntervalInput/BulkSendIntervalInput'),
);
const BulkSendReview = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendReview'),
);
const BulkSendProcess = LazyLoad(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendProcess'),
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
    name: EModalBulkSendRoutes.BulkSendIntervalInput,
    component: BulkSendIntervalInput,
  },
  {
    name: EModalBulkSendRoutes.BulkSendReview,
    component: BulkSendReview,
  },
  {
    name: EModalBulkSendRoutes.BulkSendProcess,
    component: BulkSendProcess,
  },
];
