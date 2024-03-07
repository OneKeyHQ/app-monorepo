import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { ETabSwapRoutes } from './type';

const Swap = LazyLoadPage(() => import('../../../views/Swap'));

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    translationId: 'title__swap',
  },
];
