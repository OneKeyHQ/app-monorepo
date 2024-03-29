import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);
export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    // translationId: 'wallet__wallet',
    rewrite: '/',
  },
];
