import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import type { IModalBulkCopyAddressesParamList } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';

const BulkCopyAddresses = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkCopyAddresses/pages/BulkCopyAddresses'),
);

const ExportAddresses = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkCopyAddresses/pages/ExportAddresses'),
);

export const BulkCopyAddressesModalRouter: IModalFlowNavigatorConfig<
  EModalBulkCopyAddressesRoutes,
  IModalBulkCopyAddressesParamList
>[] = [
  {
    name: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
    component: BulkCopyAddresses,
  },
  {
    name: EModalBulkCopyAddressesRoutes.ExportAddressesModal,
    component: ExportAddresses,
  },
];
