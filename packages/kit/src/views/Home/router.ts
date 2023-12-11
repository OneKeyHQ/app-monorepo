import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import HomePage from './pages/Home';
import { ETabHomeRoutes } from './type';

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePage,
    translationId: 'wallet__wallet',
  },
];
