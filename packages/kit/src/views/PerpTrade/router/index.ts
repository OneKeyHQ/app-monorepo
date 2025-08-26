import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const PagePerpTrade = LazyLoadRootTabPage(
  () => import('../pages/PagePerpTrade'),
);

export const perpTradeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabRoutes.PerpTrade,
    component: PagePerpTrade,
  },
];
