import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IModalBulkExportHistoryParamList } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';

const BulkExportHistory = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkExportHistory/pages/BulkExportHistory'),
);

const BulkExportHistoryTaskCreated = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkExportHistory/pages/BulkExportHistoryTaskCreated'),
);

const BulkExportHistoryTaskList = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkExportHistory/pages/BulkExportHistoryTaskList'),
);

const BulkExportHistoryTaskDetail = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BulkExportHistory/pages/BulkExportHistoryTaskDetail'),
);

export const BulkExportHistoryModalRouter: IModalFlowNavigatorConfig<
  EModalBulkExportHistoryRoutes,
  IModalBulkExportHistoryParamList
>[] = [
  {
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
    component: BulkExportHistory,
  },
  {
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated,
    component: BulkExportHistoryTaskCreated,
  },
  {
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList,
    component: BulkExportHistoryTaskList,
  },
  {
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryTaskDetail,
    component: BulkExportHistoryTaskDetail,
  },
];
