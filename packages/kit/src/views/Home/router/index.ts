import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { HomePageContainer } from '../container/HomePageContainer';

import { ETabHomeRoutes } from './types';

export * from './types';

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    translationId: 'wallet__wallet',
  },
];
