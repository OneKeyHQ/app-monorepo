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
const PrimeFeatures = LazyLoadPage(() => import('../pages/PrimeFeatures'));

export const PrimeRouter: IModalFlowNavigatorConfig<
  EPrimePages,
  IPrimeParamList
>[] = [
  {
    name: EPrimePages.PrimeDashboard,
    component: PrimeDashboard,
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
    name: EPrimePages.PrimeFeatures,
    component: PrimeFeatures,
  },
];
