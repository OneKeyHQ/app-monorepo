import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import Swap from '../../../views/Swap';

import { ETabSwapRoutes } from './type';

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    translationId: 'title__swap',
  },
];
