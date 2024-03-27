import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabSwapRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const Swap = LazyLoadPage(() => import('../../../views/Swap'));

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    translationId: 'title__swap',
  },
];
