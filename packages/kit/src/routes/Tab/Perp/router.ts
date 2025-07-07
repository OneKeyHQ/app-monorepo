import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabPerpRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const TabPerp = LazyLoadRootTabPage(() => import('./TabPerp'));

export const perpRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabPerpRoutes.TabPerp,
    component: TabPerp,
  },
];
