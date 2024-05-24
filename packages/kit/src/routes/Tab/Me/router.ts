import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMeRoutes } from '@onekeyhq/shared/src/routes/tabMe';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const TabMe = LazyLoadRootTabPage(() => import('./TabMe'));

export const meRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMeRoutes.TabMe,
    component: TabMe,
    translationId: 'action__more',
  },
];
