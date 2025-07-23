import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabMarketRoutes,
  ETabMarketV2Routes,
} from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';

const MarketHome = LazyLoadRootTabPage(
  () => import('../../../views/Market/MarketHome'),
);

const MarketDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketDetail'),
);

const MarketSwap = LazyLoadPage(
  () => import('../../../views/Market/MarketSwap'),
);

export const marketRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMarketRoutes.TabMarket,
    headerShown: !platformEnv.isNative,
    component: MarketHome,
  },
  {
    name: ETabMarketRoutes.MarketDetail,
    component: MarketDetail,
    rewrite: '/tokens/:token',
  },
  {
    name: ETabMarketV2Routes.MarketDetail,
    component: MarketDetail,
    rewrite: '/tokens/:networkName',
  },
  {
    name: ETabMarketV2Routes.MarketSwap,
    component: MarketSwap,
    rewrite: '/swap',
  },
];
