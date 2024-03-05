import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { ETabHomeRoutes } from './types';

export * from './types';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);
export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    translationId: 'wallet__wallet',
    rewrite: '/',
  },
];
