import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabSwapRoutes } from '@onekeyhq/shared/src/routes';

import { LazyTabHomePage } from '../../../components/LazyLoadPage';

const Swap = LazyTabHomePage(() => import('../../../views/Swap'));

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    // translationId: 'title__swap',
  },
];
