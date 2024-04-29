import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMeRoutes } from '@onekeyhq/shared/src/routes/tabMe';

import { LazyTabHomePage } from '../../../components/LazyLoadPage';

const TabMe = LazyTabHomePage(() => import('./TabMe'));

export const meRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMeRoutes.TabMe,
    component: TabMe,
    translationId: 'action__more',
  },
];
