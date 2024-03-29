import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMeRoutes } from '@onekeyhq/shared/src/routes/tabMe';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const TabMe = LazyLoadPage(() => import('./TabMe'));

export const meRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMeRoutes.TabMe,
    component: TabMe,
    translationId: 'action__more',
  },
];
