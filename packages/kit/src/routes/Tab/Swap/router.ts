import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { prefetchSwapColdStartIcons } from '@onekeyhq/components/src/primitives/Icon';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabSwapRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const Swap = LazyLoadRootTabPage(async () => {
  const [module] = await Promise.all([
    import(/* webpackPrefetch: true */ '../../../views/Swap'),
    prefetchSwapColdStartIcons(),
  ]);
  return module;
});

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    headerShown: !platformEnv.isNative,
    // translationId: ETranslations.global_swap,
  },
];
