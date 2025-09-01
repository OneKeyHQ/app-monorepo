import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const PrimeDashboard = LazyLoadPage(() => import('../pages/PrimeDashboard'));
const PrimeDeviceLimit = LazyLoadPage(
  () => import('../pages/PrimeDeviceLimit'),
);
const PrimeCloudSync = LazyLoadPage(() => import('../pages/PrimeCloudSync'));
const PrimeCloudSyncDebug = LazyLoadPage(
  () => import('../pages/PrimeCloudSync/PagePrimeCloudSyncDebug'),
);
const PrimeCloudSyncInfo = LazyLoadPage(
  () => import('../pages/PrimeCloudSync/PagePrimeCloudSyncInfo'),
);
const PrimeFeatures = LazyLoadPage(() => import('../pages/PrimeFeatures'));
const PrimeDeleteAccount = LazyLoadPage(
  () => import('../pages/PrimeDeleteAccount'),
);
const PrimeTransfer = LazyLoadPage(() => import('../pages/PagePrimeTransfer'));
const PrimeTransferPreview = LazyLoadPage(
  () => import('../pages/PagePrimeTransfer/PagePrimeTransferPreview'),
);

export const PrimeRouter: IModalFlowNavigatorConfig<
  EPrimePages,
  IPrimeParamList
>[] = [
  {
    name: EPrimePages.PrimeDashboard,
    component: PrimeDashboard,
    options: {
      headerShown: false,
    },
  },
  {
    name: EPrimePages.PrimeDeviceLimit,
    component: PrimeDeviceLimit,
  },
  {
    name: EPrimePages.PrimeCloudSync,
    component: PrimeCloudSync,
  },
  {
    name: EPrimePages.PrimeCloudSyncDebug,
    component: PrimeCloudSyncDebug,
  },
  {
    name: EPrimePages.PrimeCloudSyncInfo,
    component: PrimeCloudSyncInfo,
  },
  {
    name: EPrimePages.PrimeFeatures,
    component: PrimeFeatures,
    options: {
      headerShown: false,
    },
  },
  {
    name: EPrimePages.PrimeDeleteAccount,
    component: PrimeDeleteAccount,
  },
  {
    name: EPrimePages.PrimeTransfer,
    component: PrimeTransfer,
  },
  {
    name: EPrimePages.PrimeTransferPreview,
    component: PrimeTransferPreview,
  },
];
