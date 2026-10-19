import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';
import { earnLazyPageFallback } from '../../../views/Earn/components/EarnLazyPageFallback';

import { DiscoveryMarketRouteRedirect } from './DiscoveryMarketRouteRedirect';

const Browser = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);
const DiscoveryDashboard = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Dashboard/DashboardContainer'),
);
const EarnProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocols'),
  earnLazyPageFallback,
);
const EarnTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnTokens'),
  earnLazyPageFallback,
);
const EarnFixedRateTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnFixedRateTokens'),
  earnLazyPageFallback,
);
const EarnAllProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnAllProtocols'),
  earnLazyPageFallback,
);
const EarnProtocolTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolTokens'),
  earnLazyPageFallback,
);
const EarnProtocolDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolDetails'),
  earnLazyPageFallback,
);
// Pools (Uniswap LP) demo
const EarnPools = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPools'),
  earnLazyPageFallback,
);
const EarnPoolDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolDetails'),
  earnLazyPageFallback,
);
const EarnPoolAddLiquidity = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolAddLiquidity'),
  earnLazyPageFallback,
);
const EarnPoolTask = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolTask'),
  earnLazyPageFallback,
);
const EarnPoolPosition = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolPosition'),
  earnLazyPageFallback,
);
const EarnPoolRemoveLiquidity = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolRemoveLiquidity'),
  earnLazyPageFallback,
);
const EarnPoolsExit = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pools/pages/EarnPoolsExit'),
  earnLazyPageFallback,
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
    // Earn detail share route (landing for the universal link
    // /earn/:network/:symbol/:provider). On native, earn pages live in the
    // Discovery stack; without registering it here, safePushToEarnRoute's push
    // is silently dropped by React Navigation (tap does nothing)
    name: ETabEarnRoutes.EarnProtocolDetailsShare,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolDetails,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPools,
    component: EarnPools,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolDetails,
    component: EarnPoolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    // Same page, reached by its shared link; see EarnProtocolDetailsShare
    name: ETabEarnRoutes.EarnPoolDetailsShare,
    component: EarnPoolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolAddLiquidity,
    component: EarnPoolAddLiquidity,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolTask,
    component: EarnPoolTask,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolPosition,
    component: EarnPoolPosition,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolRemoveLiquidity,
    component: EarnPoolRemoveLiquidity,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPoolsExit,
    component: EarnPoolsExit,
    headerShown: !platformEnv.isNative,
  },
  // Borrow pages live in the Discovery stack on native; legacy Market sub-routes
  // redirect to the standalone Market tab stack.
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
          component: DiscoveryMarketRouteRedirect,
          headerShown: false,
        },
        {
          name: ETabMarketRoutes.MarketStockDetail,
          component: DiscoveryMarketRouteRedirect,
          headerShown: false,
        },
        {
          name: ETabMarketRoutes.MarketBannerDetail,
          component: DiscoveryMarketRouteRedirect,
          headerShown: false,
        },
      ]
    : []),
];
