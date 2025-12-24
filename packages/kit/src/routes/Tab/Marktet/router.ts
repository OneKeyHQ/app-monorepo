import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';

const MarketHome = LazyLoadRootTabPage(() => {
  return import('../../../views/Market/MarketHome');
});

const MarketDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketDetail'),
);

const MarketDetailV2 = LazyLoadPage(
  () => import('../../../views/Market/MarketDetailV2'),
);

const MarketBannerDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketBannerDetail'),
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
    name: ETabMarketRoutes.MarketDetailV2,
    component: MarketDetailV2,
    headerShown: !platformEnv.isNative,
    rewrite: '/token/:network/:tokenAddress',
  },
  {
    name: ETabMarketRoutes.MarketNativeDetail,
    component: MarketDetailV2,
    headerShown: !platformEnv.isNative,
    rewrite: '/token/:network',
  },
  {
    name: ETabMarketRoutes.MarketBannerDetail,
    component: MarketBannerDetail,
    headerShown: !platformEnv.isNative,
    rewrite: '/banner/:tokenListId',
  },
];
