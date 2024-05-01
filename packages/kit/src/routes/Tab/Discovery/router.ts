import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabDiscoveryRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const Browser = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Dashboard/DashboardContainer'),
);

export const discoveryRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDiscoveryRoutes.TabDiscovery,
    rewrite: '/',
    component: platformEnv.isNative ? Browser : DiscoveryDashboard,
    // translationId: 'title__explore',
  },
];
