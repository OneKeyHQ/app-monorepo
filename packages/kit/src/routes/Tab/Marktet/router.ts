import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

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

export const marketRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMarketRoutes.TabMarket,
    component: MarketHome,
  },
  {
    name: ETabMarketRoutes.MarketDetail,
    component: MarketDetail,
    rewrite: '/market_detail',
  },
];
