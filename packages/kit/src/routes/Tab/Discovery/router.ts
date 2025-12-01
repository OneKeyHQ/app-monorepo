import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const Browser = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Dashboard/DashboardContainer'),
);
const EarnProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocols'),
);
const EarnProtocolDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolDetails'),
);

export const discoveryRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDiscoveryRoutes.TabDiscovery,
    rewrite: '/',
    headerShown: !platformEnv.isNative,
    component: platformEnv.isNative ? Browser : DiscoveryDashboard,
    // translationId: 'title__explore',
  },
  {
    // Reuse earn pages inside Discovery tab to keep tab selection when navigating from DeFi sub-tab.
    name: ETabEarnRoutes.EarnProtocols,
    component: EarnProtocols,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolDetails,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
];
