import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ECloudBackupRoutes } from '@onekeyhq/shared/src/routes';
import type { ICloudBackupParamList } from '@onekeyhq/shared/src/routes';

const CloudBackupHome = LazyLoad(
  () => import('@onekeyhq/kit/src/views/CloudBackup/pages/Home'),
);

const CloudBackupList = LazyLoad(
  () => import('@onekeyhq/kit/src/views/CloudBackup/pages/List'),
);

const CloudBackupDetail = LazyLoad(
  () => import('@onekeyhq/kit/src/views/CloudBackup/pages/Detail'),
);

export const CloudBackupPages: IModalFlowNavigatorConfig<
  ECloudBackupRoutes,
  ICloudBackupParamList
>[] = [
  {
    name: ECloudBackupRoutes.CloudBackupHome,
    component: CloudBackupHome,
    translationId: 'iCloud Backup',
  },
  {
    name: ECloudBackupRoutes.CloudBackupList,
    component: CloudBackupList,
  },
  {
    name: ECloudBackupRoutes.CloudBackupDetail,
    component: CloudBackupDetail,
  },
];
