import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabDiscoveryRoutes } from '@onekeyhq/shared/src/routes';

import { LazyTabHomePage } from '../../../components/LazyLoadPage';

const Browser = LazyTabHomePage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyTabHomePage(
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
