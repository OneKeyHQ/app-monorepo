import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabPerpsRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const TabPerps = LazyLoadRootTabPage(() => import('./TabPerps'));

export const perpsRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabPerpsRoutes.TabPerps,
    component: TabPerps,
  },
];
