import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';

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

// Market pages for native platforms (Market is embedded in Discovery on mobile)
const MarketDetailV2 = LazyLoadPage(
  () => import('../../../views/Market/MarketDetailV2'),
);

const MarketBannerDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketBannerDetail'),
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
  // Market pages for native platforms (Market is embedded in Discovery on mobile)
  ...(platformEnv.isNative
    ? [
        {
          name: ETabMarketRoutes.MarketDetailV2,
          component: MarketDetailV2,
          headerShown: false,
        },
        {
          name: ETabMarketRoutes.MarketBannerDetail,
          component: MarketBannerDetail,
          headerShown: false,
        },
      ]
    : []),
];
