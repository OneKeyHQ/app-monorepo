import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IModalBulkExportHistoryParamList } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';

const BulkExportHistory = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkExportHistory/pages/BulkExportHistory'),
);

export const BulkExportHistoryModalRouter: IModalFlowNavigatorConfig<
  EModalBulkExportHistoryRoutes,
  IModalBulkExportHistoryParamList
>[] = [
  {
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
    component: BulkExportHistory,
  },
];
