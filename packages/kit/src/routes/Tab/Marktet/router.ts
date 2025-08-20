import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';

// Dynamic Market Home component that selects version based on dev settings
const DynamicMarketHome = LazyLoadRootTabPage(() => {
  return import('../../../views/Market/DynamicMarketHome');
});

const MarketDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketDetail'),
);

const MarketDetailV2 = LazyLoadPage(
  () => import('../../../views/Market/MarketDetailV2'),
);

export const marketRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMarketRoutes.TabMarket,
    headerShown: !platformEnv.isNative,
    component: DynamicMarketHome,
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
    rewrite: '/tokens/v2/:networkId',
  },
];
