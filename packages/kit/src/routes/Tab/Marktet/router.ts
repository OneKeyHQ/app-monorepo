import { createElement } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { MarketDetailV2 as MarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';
import { RootTabLoadingFallback } from '../RootTabLoadingFallback';

const MarketHome = LazyLoadRootTabPage(
  () => import(/* webpackPrefetch: true */ '../../../views/Market/MarketHome'),
  createElement(RootTabLoadingFallback, { tabRoute: ETabRoutes.Market }),
);

const MarketDetail = LazyLoadPage(
  () => import('../../../views/Market/MarketDetail'),
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
    component: MarketDetailV2Page,
    headerShown: !platformEnv.isNative,
    rewrite: '/token/:network/:tokenAddress',
  },
  {
    name: ETabMarketRoutes.MarketNativeDetail,
    component: MarketDetailV2Page,
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
