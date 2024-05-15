import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const MarketHome = LazyLoadRootTabPage(
  () => import('../../../views/Market/MarketHome'),
);

export const marketRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMarketRoutes.TabMarket,
    component: MarketHome,
  },
];
