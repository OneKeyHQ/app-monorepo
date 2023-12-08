import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import HomePage from '../../../views/Tab/Home/HomePageTabs';

import { ETabHomeRoutes } from './type';

export const HomeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePage,
    translationId: 'wallet__wallet',
  },
];
