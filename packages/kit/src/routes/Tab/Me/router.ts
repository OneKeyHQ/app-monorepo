import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

// import TabMe from './TabMe';
import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { ETabMeRoutes } from './type';

const TabMe = LazyLoadPage(() => import('./TabMe'));

export const meRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMeRoutes.TabMe,
    component: TabMe,
    translationId: 'action__more',
  },
];
