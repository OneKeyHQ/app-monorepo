import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { Browser } from '@onekeyhq/components/src/primitives/Icon/react/outline';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DiscoveryDashboard from '../../../views/Discovery/container/Dashboard';

import { ETabDiscoveryRoutes } from './type';

export const discoveryRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDiscoveryRoutes.TabDiscovery,
    rewrite: '/',
    component: platformEnv.isNative ? Browser : DiscoveryDashboard,
    translationId: 'title__explore',
  },
];
