import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Browser from '../../../views/Discovery/pages/Browser/Browser';
import DiscoveryDashboard from '../../../views/Discovery/pages/Dashboard';

import { ETabDiscoveryRoutes } from './type';

export const discoveryRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDiscoveryRoutes.TabDiscovery,
    rewrite: '/',
    component: platformEnv.isNative ? Browser : DiscoveryDashboard,
    translationId: 'title__explore',
  },
];
