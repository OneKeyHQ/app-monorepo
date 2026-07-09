import { createElement } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';
import { createMarketDetailV2Route } from '../../../views/Market/MarketDetailV2/MarketDetailV2Route';
import { RootTabLoadingFallback } from '../RootTabLoadingFallback';

import { MarketDetailV2LoadingFallback } from './MarketDetailV2LoadingFallback';

const MarketHome = LazyLoadRootTabPage(
  () => import(/* webpackPrefetch: true */ '../../../views/Market/MarketHome'),
  createElement(RootTabLoadingFallback, { tabRoute: ETabRoutes.Market }),
);

const MarketDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketDetail'),
);

const MarketDetailV2 = createMarketDetailV2Route(
  createElement(MarketDetailV2LoadingFallback),
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
