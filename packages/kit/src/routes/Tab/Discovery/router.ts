import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { ETabDiscoveryRoutes } from './type';

const Browser = LazyLoadPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyLoadPage(
  () => import('../../../views/Discovery/pages/Dashboard/DashboardContainer'),
);

export const discoveryRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDiscoveryRoutes.TabDiscovery,
    rewrite: '/',
    component: platformEnv.isNative ? Browser : DiscoveryDashboard,
    translationId: 'title__explore',
  },
];
