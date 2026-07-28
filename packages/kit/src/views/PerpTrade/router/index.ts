import { createElement } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';
import { RootTabLoadingFallback } from '../../../routes/Tab/RootTabLoadingFallback';

const PageWebviewPerpTrade = LazyLoadRootTabPage(
  () => import('../pages/PageWebviewPerpTrade'),
  createElement(RootTabLoadingFallback, {
    tabRoute: ETabRoutes.WebviewPerpTrade,
  }),
);

export const perpTradeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabRoutes.WebviewPerpTrade,
    component: PageWebviewPerpTrade,
  },
];
