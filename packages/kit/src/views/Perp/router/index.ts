import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const PagePerp = LazyLoadRootTabPage(
  () => import('../pages/Perp'),
);

export const perpRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabRoutes.Perp,
    component: PagePerp,
  },
];
