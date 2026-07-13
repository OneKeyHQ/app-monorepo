import { createElement } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes, ETabSwapRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';
import { RootTabLoadingFallback } from '../RootTabLoadingFallback';

const SWAP_LOADING_ENABLED_NUM = [0, 1];

const Swap = LazyLoadRootTabPage(
  () => import('../../../views/Swap'),
  createElement(RootTabLoadingFallback, {
    tabRoute: ETabRoutes.Swap,
    sceneName: EAccountSelectorSceneName.swap,
    enabledNum: SWAP_LOADING_ENABLED_NUM,
  }),
);

export const swapRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabSwapRoutes.TabSwap,
    component: Swap,
    rewrite: '/',
    headerShown: !platformEnv.isNative,
    // translationId: ETranslations.global_swap,
  },
];
