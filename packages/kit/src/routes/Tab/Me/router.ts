import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import TabMe from './TabMe';
import { ETabMeRoutes } from './type';

export const meRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMeRoutes.TabMe,
    component: TabMe,
    translationId: 'action__more',
  },
];
