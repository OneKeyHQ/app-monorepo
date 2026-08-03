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
import { createMarketDetailV2Route } from '../../../views/Market/MarketDetailV2/MarketDetailV2Route';

const Browser = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Dashboard/DashboardContainer'),
);
const EarnProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocols'),
);
const EarnTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnTokens'),
);
const EarnFixedRateTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnFixedRateTokens'),
);
const EarnAllProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnAllProtocols'),
);
const EarnProtocolTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolTokens'),
);
const EarnProtocolDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolDetails'),
);
const BorrowHome = LazyLoadRootTabPage(
  () => import('../../../views/Borrow/pages/BorrowHomePage'),
);
const EarnPositions = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnPositions'),
);
const BorrowReserveDetails = LazyLoadRootTabPage(
  () => import('../../../views/Borrow/pages/ReserveDetails'),
);

// Market pages for native platforms (Market is embedded in Discovery on mobile)
const MarketDetailV2 = createMarketDetailV2Route();
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
    name: ETabEarnRoutes.EarnTokens,
    component: EarnTokens,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnFixedRateTokens,
    component: EarnFixedRateTokens,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnAllProtocols,
    component: EarnAllProtocols,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolTokens,
    component: EarnProtocolTokens,
    headerShown: !platformEnv.isNative,
  },
  {
    // Earn 详情分享路由 (universal link /earn/:network/:symbol/:provider 落点)。
    // 原生端 earn 页面挂在 Discovery 栈下，这里不注册的话
    // safePushToEarnRoute 的 push 会被 React Navigation 丢弃 (点击无反应)
    name: ETabEarnRoutes.EarnProtocolDetailsShare,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolDetails,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
  // Borrow and Market pages live in the Discovery stack on native.
  ...(platformEnv.isNative
    ? [
        {
          name: ETabEarnRoutes.BorrowHome,
          component: BorrowHome,
          headerShown: true,
        },
        {
          name: ETabEarnRoutes.EarnPositions,
          component: EarnPositions,
          headerShown: true,
        },
        {
          name: ETabEarnRoutes.BorrowReserveDetails,
          component: BorrowReserveDetails,
          headerShown: true,
        },
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
