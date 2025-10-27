import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const PageWebviewPerpTrade = LazyLoadRootTabPage(
  () => import('../pages/PageWebviewPerpTrade'),
);

export const perpTradeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabRoutes.WebviewPerpTrade,
    component: PageWebviewPerpTrade,
  },
];
